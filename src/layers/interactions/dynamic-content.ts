import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import type { Finding } from '../../core/types.js';

function findingId(wcag: string, selector: string, route: string): string {
  return createHash('sha256')
    .update(`${wcag}|${selector}|${route}|interaction`)
    .digest('hex')
    .slice(0, 12);
}

const ROLE_LIVE_MAP: Record<string, string> = {
  alert: 'assertive',
  status: 'polite',
  log: 'polite',
};

export async function testDynamicContent(page: Page, route: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  const liveRegions = await page.$$('[aria-live], [role="alert"], [role="status"], [role="log"]');

  for (const region of liveRegions) {
    const info = await region.evaluate((el) => {
      let sel = el.tagName.toLowerCase();
      if (el.id) sel += `#${el.id}`;
      else if (el.className && typeof el.className === 'string') {
        sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
      }

      return {
        selector: sel,
        role: el.getAttribute('role') ?? '',
        ariaLive: el.getAttribute('aria-live') ?? '',
        textContent: el.textContent?.trim() ?? '',
        ariaLabel: el.getAttribute('aria-label') ?? '',
      };
    });

    // Check aria-live value matches role semantics
    const expectedLive = ROLE_LIVE_MAP[info.role];
    if (expectedLive && info.ariaLive && info.ariaLive !== expectedLive) {
      findings.push({
        id: findingId('4.1.3-mismatch', info.selector, route),
        wcagCriterion: '4.1.3',
        severity: 'minor',
        confidence: 'medium',
        sourceLayer: 'interaction',
        route,
        selector: info.selector,
        accessibleName: info.ariaLabel,
        description: `aria-live="${info.ariaLive}" mismatches role="${info.role}" (expected "${expectedLive}")`,
        impact: 'minor',
        fixSuggestion: `Set aria-live="${expectedLive}" for role="${info.role}", or remove aria-live to use the implicit value.`,
        screenshotRef: null,
        stateContext: null,
      });
    }

    // Check live region has content or aria-label
    if (!info.textContent && !info.ariaLabel) {
      findings.push({
        id: findingId('4.1.3-empty', info.selector, route),
        wcagCriterion: '4.1.3',
        severity: 'minor',
        confidence: 'medium',
        sourceLayer: 'interaction',
        route,
        selector: info.selector,
        accessibleName: '',
        description: 'Live region has no text content or aria-label',
        impact: 'minor',
        fixSuggestion: 'Ensure live regions contain meaningful text or have an aria-label.',
        screenshotRef: null,
        stateContext: null,
      });
    }
  }

  return findings;
}
