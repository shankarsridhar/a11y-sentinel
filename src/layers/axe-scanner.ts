import { AxeBuilder } from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import type { Finding, Severity } from '../core/types.js';

const SEVERITY_MAP: Record<string, Severity> = {
  critical: 'critical',
  serious: 'major',
  moderate: 'minor',
  minor: 'minor',
};

function makeFindingId(
  wcagCriterion: string,
  selector: string,
  route: string,
  sourceLayer: string,
): string {
  return createHash('sha256')
    .update(`${wcagCriterion}|${selector}|${route}|${sourceLayer}`)
    .digest('hex')
    .slice(0, 12);
}

function extractWcagCriterion(tags: string[]): string {
  for (const tag of tags) {
    const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
    if (match) return `${match[1]}.${match[2]}.${match[3]}`;
  }
  return 'unknown';
}

export async function runAxeScan(
  page: Page,
  route: string,
  excludeRules: string[] = [],
  stateContext: string | null = null,
): Promise<{ findings: Finding[]; passedCount: number; totalCount: number }> {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (excludeRules.length > 0) {
    builder = builder.disableRules(excludeRules);
  }

  const results = await builder.analyze();

  const findings: Finding[] = [];

  for (const violation of results.violations) {
    const wcag = extractWcagCriterion(violation.tags);
    const severity = SEVERITY_MAP[violation.impact ?? 'minor'] ?? 'minor';

    for (const node of violation.nodes) {
      const selector = node.target.join(' ');
      findings.push({
        id: makeFindingId(wcag, selector, route, 'axe-core'),
        wcagCriterion: wcag,
        severity,
        confidence: 'high',
        sourceLayer: 'axe-core',
        route,
        selector,
        accessibleName: '',
        description: violation.description,
        impact: violation.impact ?? 'minor',
        fixSuggestion: node.failureSummary ?? violation.help,
        screenshotRef: null,
        stateContext,
      });
    }
  }

  const passedCount = results.passes.length;
  const totalCount = passedCount + results.violations.length + results.incomplete.length;

  return { findings, passedCount, totalCount };
}
