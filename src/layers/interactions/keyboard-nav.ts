import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import type { Finding } from '../../core/types.js';

function findingId(wcag: string, selector: string, route: string): string {
  return createHash('sha256')
    .update(`${wcag}|${selector}|${route}|interaction`)
    .digest('hex')
    .slice(0, 12);
}

interface TabStop {
  selector: string;
  tagName: string;
  role: string;
  name: string;
  boundingBox: { width: number; height: number } | null;
  focusStyles: Record<string, string>;
  blurStyles: Record<string, string>;
}

async function getElementInfo(page: Page): Promise<TabStop | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;

    const cs = getComputedStyle(el);
    const focusStyles: Record<string, string> = {
      outline: cs.outline,
      outlineColor: cs.outlineColor,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
      border: cs.border,
      borderColor: cs.borderColor,
    };

    const rect = el.getBoundingClientRect();

    // Build a CSS selector
    let selector = el.tagName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
    } else if (el.className && typeof el.className === 'string') {
      selector += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }

    return {
      selector,
      tagName: el.tagName.toLowerCase(),
      role: el.getAttribute('role') ?? '',
      name: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 50) ?? '',
      boundingBox: rect.width > 0 ? { width: rect.width, height: rect.height } : null,
      focusStyles,
      blurStyles: {} as Record<string, string>, // will be populated after blur
    };
  });
}

async function getBlurStyles(page: Page, selector: string): Promise<Record<string, string>> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { outline: '', outlineColor: '', outlineWidth: '', boxShadow: '', border: '', borderColor: '' };
    (el as HTMLElement).blur();
    const cs = getComputedStyle(el);
    return {
      outline: cs.outline,
      outlineColor: cs.outlineColor,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
      border: cs.border,
      borderColor: cs.borderColor,
    };
  }, selector);
}

function hasFocusIndicator(focused: Record<string, string>, blurred: Record<string, string>): boolean {
  return Object.keys(focused).some((key) => focused[key] !== blurred[key]);
}

export async function testKeyboardNav(
  page: Page,
  route: string,
): Promise<{ findings: Finding[]; tabOrder: string[] }> {
  const findings: Finding[] = [];
  const tabOrder: string[] = [];
  const tabStops: TabStop[] = [];
  const consecutiveSame: string[] = [];

  const MAX_TABS = 100;

  // Focus the body first
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    document.body.focus();
  });

  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    const info = await getElementInfo(page);
    if (!info) continue;

    // Keyboard trap detection: same element 3x consecutively
    consecutiveSame.push(info.selector);
    if (consecutiveSame.length >= 3) {
      const last3 = consecutiveSame.slice(-3);
      if (last3[0] === last3[1] && last3[1] === last3[2]) {
        findings.push({
          id: findingId('2.1.2', info.selector, route),
          wcagCriterion: '2.1.2',
          severity: 'critical',
          confidence: 'medium',
          sourceLayer: 'interaction',
          route,
          selector: info.selector,
          accessibleName: info.name,
          description: 'Keyboard trap detected — element focused 3 times consecutively',
          impact: 'critical',
          fixSuggestion: 'Ensure Tab moves focus to the next interactive element without trapping.',
          screenshotRef: null,
          stateContext: 'keyboard navigation',
        });
        break; // stop — we're trapped
      }
    }

    // Loop detection: if we see the first element again, we've looped
    if (tabStops.length > 0 && info.selector === tabStops[0].selector && i > 2) {
      break;
    }

    // Get blur styles for focus indicator check
    const blurStyles = await getBlurStyles(page, info.selector);
    info.blurStyles = blurStyles;

    // Re-focus the element
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) (el as HTMLElement).focus();
    }, info.selector);

    tabStops.push(info);
    tabOrder.push(info.selector);

    // Focus indicator check
    if (!hasFocusIndicator(info.focusStyles, blurStyles)) {
      findings.push({
        id: findingId('2.4.7', info.selector, route),
        wcagCriterion: '2.4.7',
        severity: 'major',
        confidence: 'medium',
        sourceLayer: 'interaction',
        route,
        selector: info.selector,
        accessibleName: info.name,
        description: 'No visible focus indicator — no visual change on focus',
        impact: 'serious',
        fixSuggestion: 'Add a visible focus style (outline, box-shadow, or border change).',
        screenshotRef: null,
        stateContext: 'keyboard navigation',
      });
    }

    // Touch target size check
    if (info.boundingBox) {
      const { width, height } = info.boundingBox;
      if (width < 24 || height < 24) {
        findings.push({
          id: findingId('2.5.8', info.selector, route),
          wcagCriterion: '2.5.8',
          severity: 'minor',
          confidence: 'high',
          sourceLayer: 'interaction',
          route,
          selector: info.selector,
          accessibleName: info.name,
          description: `Touch target too small: ${Math.round(width)}x${Math.round(height)}px (minimum 24x24)`,
          impact: 'minor',
          fixSuggestion: 'Increase the element size to at least 24x24 CSS pixels.',
          screenshotRef: null,
          stateContext: 'keyboard navigation',
        });
      }
    }
  }

  // Unreachable element detection
  const reachable = new Set(tabStops.map((s) => s.selector));
  const interactiveSelectors = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    return Array.from(elements).map((el) => {
      let sel = el.tagName.toLowerCase();
      if (el.id) sel += `#${el.id}`;
      else if (el.className && typeof el.className === 'string') {
        sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
      }
      return sel;
    });
  });

  const uniqueInteractive = [...new Set(interactiveSelectors)];
  for (const sel of uniqueInteractive) {
    if (!reachable.has(sel)) {
      // Only report if the element is visible
      const isVisible = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          cs.display !== 'none' &&
          cs.visibility !== 'hidden'
        );
      }, sel);

      if (isVisible) {
        findings.push({
          id: findingId('2.1.1', sel, route),
          wcagCriterion: '2.1.1',
          severity: 'critical',
          confidence: 'medium',
          sourceLayer: 'interaction',
          route,
          selector: sel,
          accessibleName: '',
          description: 'Interactive element not reachable via keyboard Tab',
          impact: 'critical',
          fixSuggestion: 'Ensure all interactive elements are reachable via keyboard navigation.',
          screenshotRef: null,
          stateContext: 'keyboard navigation',
        });
      }
    }
  }

  return { findings, tabOrder };
}
