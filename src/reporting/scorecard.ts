import type { Finding, Scorecard, Severity, WcagPrinciple, SourceLayer } from '../core/types.js';

const PRINCIPLE_MAP: Record<string, WcagPrinciple> = {
  '1': 'perceivable',
  '2': 'operable',
  '3': 'understandable',
  '4': 'robust',
};

export function computeScorecard(
  findings: Finding[],
  passedCount: number,
  totalCount: number,
): Scorecard {
  const bySeverity: Record<Severity, number> = { critical: 0, major: 0, minor: 0 };
  const byPrinciple: Record<WcagPrinciple, number> = {
    perceivable: 0, operable: 0, understandable: 0, robust: 0,
  };
  const byRoute: Record<string, number> = {};
  const byLayer: Record<SourceLayer, number> = { 'axe-core': 0, interaction: 0 };

  for (const f of findings) {
    bySeverity[f.severity]++;

    const principleKey = f.wcagCriterion.charAt(0);
    const principle = PRINCIPLE_MAP[principleKey];
    if (principle) byPrinciple[principle]++;

    byRoute[f.route] = (byRoute[f.route] ?? 0) + 1;
    byLayer[f.sourceLayer]++;
  }

  const passRate = totalCount > 0 ? passedCount / totalCount : 1;

  return {
    totalFindings: findings.length,
    bySeverity,
    byPrinciple,
    byRoute,
    byLayer,
    passRate,
  };
}
