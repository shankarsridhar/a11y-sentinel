import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import type { Finding } from '../../core/types.js';

function findingId(wcag: string, selector: string, route: string): string {
  return createHash('sha256')
    .update(`${wcag}|${selector}|${route}|interaction`)
    .digest('hex')
    .slice(0, 12);
}

async function getActiveSelector(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';
    let sel = el.tagName.toLowerCase();
    if (el.id) sel += `#${el.id}`;
    else if (el.className && typeof el.className === 'string') {
      sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    return sel;
  });
}

export async function testModals(page: Page, route: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Find modal triggers
  const triggerSelectors = [
    '[aria-haspopup="dialog"]',
    '[data-toggle="modal"]',
    'button[aria-controls]',
  ];

  for (const triggerSel of triggerSelectors) {
    const triggers = await page.$$(triggerSel);

    for (const trigger of triggers) {
      const triggerSelector = await trigger.evaluate((el) => {
        let sel = el.tagName.toLowerCase();
        if (el.id) sel += `#${el.id}`;
        else if (el.className && typeof el.className === 'string') {
          sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
        }
        return sel;
      });

      // Click the trigger
      try {
        await trigger.click();
        await page.waitForTimeout(500);
      } catch {
        continue;
      }

      // Check: is there an open dialog/modal?
      const dialogSelector = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open], [role="dialog"]:not([aria-hidden="true"])');
        if (!dialog) return null;
        let sel = dialog.tagName.toLowerCase();
        if (dialog.id) sel += `#${dialog.id}`;
        return sel;
      });

      if (!dialogSelector) continue;

      // Check: focus moved into dialog?
      const focusInDialog = await page.evaluate((dlgSel) => {
        const dialog = document.querySelector(dlgSel);
        if (!dialog) return false;
        return dialog.contains(document.activeElement);
      }, dialogSelector);

      if (!focusInDialog) {
        findings.push({
          id: findingId('2.4.3', dialogSelector, route),
          wcagCriterion: '2.4.3',
          severity: 'major',
          confidence: 'medium',
          sourceLayer: 'interaction',
          route,
          selector: dialogSelector,
          accessibleName: '',
          description: 'Focus not moved into opened modal dialog',
          impact: 'serious',
          fixSuggestion: 'Move focus to the first focusable element inside the modal when opened.',
          screenshotRef: null,
          stateContext: 'after modal open',
        });
      }

      // Check: focus trapped within dialog (Tab should stay inside)
      const focusableInDialog = await page.evaluate((dlgSel) => {
        const dialog = document.querySelector(dlgSel);
        if (!dialog) return 0;
        return dialog.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ).length;
      }, dialogSelector);

      if (focusableInDialog > 1) {
        // Tab through all focusable elements + 1 to check if focus stays
        for (let i = 0; i <= focusableInDialog; i++) {
          await page.keyboard.press('Tab');
        }
        const stillInDialog = await page.evaluate((dlgSel) => {
          const dialog = document.querySelector(dlgSel);
          if (!dialog) return false;
          return dialog.contains(document.activeElement);
        }, dialogSelector);

        if (!stillInDialog) {
          findings.push({
            id: findingId('2.1.2-modal', dialogSelector, route),
            wcagCriterion: '2.1.2',
            severity: 'critical',
            confidence: 'medium',
            sourceLayer: 'interaction',
            route,
            selector: dialogSelector,
            accessibleName: '',
            description: 'Focus not trapped within modal — Tab escapes the dialog',
            impact: 'critical',
            fixSuggestion: 'Implement focus trap: Tab should cycle through focusable elements within the modal.',
            screenshotRef: null,
            stateContext: 'after modal open',
          });
        }
      }

      // Check: Escape closes modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      const stillOpen = await page.evaluate((dlgSel) => {
        const dialog = document.querySelector(dlgSel);
        if (!dialog) return false;
        if (dialog.tagName === 'DIALOG') return (dialog as HTMLDialogElement).open;
        return dialog.getAttribute('aria-hidden') !== 'true';
      }, dialogSelector);

      if (stillOpen) {
        findings.push({
          id: findingId('2.1.2-esc', dialogSelector, route),
          wcagCriterion: '2.1.2',
          severity: 'major',
          confidence: 'medium',
          sourceLayer: 'interaction',
          route,
          selector: dialogSelector,
          accessibleName: '',
          description: 'Modal not closed by Escape key',
          impact: 'serious',
          fixSuggestion: 'Add keyboard handler to close the modal when Escape is pressed.',
          screenshotRef: null,
          stateContext: 'after Escape in modal',
        });

        // Try to close manually for cleanup
        await page.evaluate((dlgSel) => {
          const dialog = document.querySelector(dlgSel);
          if (dialog?.tagName === 'DIALOG') (dialog as HTMLDialogElement).close();
          else if (dialog) dialog.setAttribute('aria-hidden', 'true');
        }, dialogSelector);
      } else {
        // Check: focus returned to trigger
        const activeAfterClose = await getActiveSelector(page);
        if (activeAfterClose !== triggerSelector) {
          findings.push({
            id: findingId('2.4.3-return', triggerSelector, route),
            wcagCriterion: '2.4.3',
            severity: 'major',
            confidence: 'medium',
            sourceLayer: 'interaction',
            route,
            selector: triggerSelector,
            accessibleName: '',
            description: 'Focus not returned to trigger after modal close',
            impact: 'serious',
            fixSuggestion: 'Return focus to the element that opened the modal after closing it.',
            screenshotRef: null,
            stateContext: 'after modal close',
          });
        }
      }
    }
  }

  return findings;
}
