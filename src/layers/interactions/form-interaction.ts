import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import type { Finding } from '../../core/types.js';

function findingId(wcag: string, selector: string, route: string): string {
  return createHash('sha256')
    .update(`${wcag}|${selector}|${route}|interaction`)
    .digest('hex')
    .slice(0, 12);
}

export async function testForms(page: Page, route: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  const forms = await page.$$('form');
  if (forms.length === 0) return findings;

  for (const form of forms) {
    const formSelector = await form.evaluate((el) => {
      let sel = 'form';
      if (el.id) sel += `#${el.id}`;
      else if (el.className && typeof el.className === 'string') {
        sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
      }
      return sel;
    });

    // Check for aria-required on required fields
    const requiredInputs = await form.$$('[required], [aria-required="true"]');
    for (const input of requiredInputs) {
      const hasAriaRequired = await input.evaluate(
        (el) => el.getAttribute('aria-required') === 'true',
      );
      const inputSelector = await input.evaluate((el) => {
        let sel = el.tagName.toLowerCase();
        if (el.id) sel += `#${el.id}`;
        else if ((el as HTMLInputElement).name) sel += `[name="${(el as HTMLInputElement).name}"]`;
        return sel;
      });

      if (!hasAriaRequired) {
        findings.push({
          id: findingId('3.3.2', inputSelector, route),
          wcagCriterion: '3.3.2',
          severity: 'minor',
          confidence: 'medium',
          sourceLayer: 'interaction',
          route,
          selector: inputSelector,
          accessibleName: '',
          description: 'Required field missing aria-required="true"',
          impact: 'minor',
          fixSuggestion: 'Add aria-required="true" to required form fields.',
          screenshotRef: null,
          stateContext: 'form validation',
        });
      }
    }

    // Intercept form navigation to prevent navigating away
    await page.route('**/*', (route) => {
      if (route.request().isNavigationRequest() && route.request().url() !== page.url()) {
        route.fulfill({ status: 200, body: '' });
      } else {
        route.continue();
      }
    });

    // Submit empty form
    try {
      await form.evaluate((el) => {
        const submitBtn =
          el.querySelector('[type="submit"]') ??
          el.querySelector('button:not([type])');
        if (submitBtn) (submitBtn as HTMLElement).click();
        else el.requestSubmit();
      });

      // Wait for potential validation UI
      await page.waitForTimeout(500);

      // Check aria-invalid on invalid inputs after submit
      const invalidInputs = await form.$$(':invalid');
      for (const input of invalidInputs) {
        const hasAriaInvalid = await input.evaluate(
          (el) => el.getAttribute('aria-invalid') === 'true',
        );
        const inputSelector = await input.evaluate((el) => {
          let sel = el.tagName.toLowerCase();
          if (el.id) sel += `#${el.id}`;
          else if ((el as HTMLInputElement).name) sel += `[name="${(el as HTMLInputElement).name}"]`;
          return sel;
        });

        if (!hasAriaInvalid) {
          findings.push({
            id: findingId('3.3.1-invalid', inputSelector, route),
            wcagCriterion: '3.3.1',
            severity: 'major',
            confidence: 'medium',
            sourceLayer: 'interaction',
            route,
            selector: inputSelector,
            accessibleName: '',
            description: 'Invalid field missing aria-invalid="true" after form submission',
            impact: 'serious',
            fixSuggestion: 'Set aria-invalid="true" on fields that fail validation.',
            screenshotRef: null,
            stateContext: 'after form submit',
          });
        }

        // Check error message association
        const hasErrorMsg = await input.evaluate((el) => {
          return !!(
            el.getAttribute('aria-describedby') ||
            el.getAttribute('aria-errormessage')
          );
        });

        if (!hasErrorMsg) {
          findings.push({
            id: findingId('3.3.1-errmsg', inputSelector, route),
            wcagCriterion: '3.3.1',
            severity: 'major',
            confidence: 'medium',
            sourceLayer: 'interaction',
            route,
            selector: inputSelector,
            accessibleName: '',
            description: 'Invalid field has no error message association (aria-describedby or aria-errormessage)',
            impact: 'serious',
            fixSuggestion: 'Link error messages to inputs via aria-describedby or aria-errormessage.',
            screenshotRef: null,
            stateContext: 'after form submit',
          });
        }
      }
    } catch {
      // Form submission may fail — that's acceptable
    }

    // Clean up route intercept
    await page.unroute('**/*');
  }

  return findings;
}
