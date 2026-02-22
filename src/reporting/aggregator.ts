import type { Finding, FindingGroup, Severity } from '../core/types.js';

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

export function dedup(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    if (!seen.has(f.id)) {
      seen.set(f.id, f);
    }
  }
  return [...seen.values()];
}

export function groupFindings(findings: Finding[]): FindingGroup[] {
  const groupMap = new Map<string, FindingGroup>();

  for (const f of findings) {
    const key = `${f.wcagCriterion}|${f.description}|${f.route}`;
    const existing = groupMap.get(key);

    if (existing) {
      existing.count++;
      if (
        existing.exampleSelectors.length < 3 &&
        !existing.exampleSelectors.includes(f.selector)
      ) {
        existing.exampleSelectors.push(f.selector);
      }
    } else {
      groupMap.set(key, {
        wcagCriterion: f.wcagCriterion,
        description: f.description,
        severity: f.severity,
        route: f.route,
        count: 1,
        exampleSelectors: [f.selector],
        fixSuggestion: f.fixSuggestion,
      });
    }
  }

  return [...groupMap.values()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}
