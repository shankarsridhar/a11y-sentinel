import { describe, it, expect } from 'vitest';
import { computeScorecard } from '../../src/reporting/scorecard.js';
import type { Finding } from '../../src/core/types.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'abc',
    wcagCriterion: '1.1.1',
    severity: 'critical',
    confidence: 'high',
    sourceLayer: 'axe-core',
    route: 'Home',
    selector: 'img',
    accessibleName: '',
    description: 'test',
    impact: 'critical',
    fixSuggestion: 'fix',
    screenshotRef: null,
    stateContext: null,
    ...overrides,
  };
}

describe('computeScorecard', () => {
  it('counts by severity', () => {
    const findings = [
      makeFinding({ severity: 'critical' }),
      makeFinding({ severity: 'critical' }),
      makeFinding({ severity: 'major' }),
      makeFinding({ severity: 'minor' }),
    ];
    const sc = computeScorecard(findings, 10, 14);
    expect(sc.bySeverity.critical).toBe(2);
    expect(sc.bySeverity.major).toBe(1);
    expect(sc.bySeverity.minor).toBe(1);
    expect(sc.totalFindings).toBe(4);
  });

  it('counts by WCAG principle', () => {
    const findings = [
      makeFinding({ wcagCriterion: '1.1.1' }),
      makeFinding({ wcagCriterion: '2.4.7' }),
      makeFinding({ wcagCriterion: '3.3.1' }),
      makeFinding({ wcagCriterion: '4.1.3' }),
    ];
    const sc = computeScorecard(findings, 0, 4);
    expect(sc.byPrinciple.perceivable).toBe(1);
    expect(sc.byPrinciple.operable).toBe(1);
    expect(sc.byPrinciple.understandable).toBe(1);
    expect(sc.byPrinciple.robust).toBe(1);
  });

  it('counts by route and layer', () => {
    const findings = [
      makeFinding({ route: 'Home', sourceLayer: 'axe-core' }),
      makeFinding({ route: 'Home', sourceLayer: 'interaction' }),
      makeFinding({ route: 'About', sourceLayer: 'axe-core' }),
    ];
    const sc = computeScorecard(findings, 5, 8);
    expect(sc.byRoute['Home']).toBe(2);
    expect(sc.byRoute['About']).toBe(1);
    expect(sc.byLayer['axe-core']).toBe(2);
    expect(sc.byLayer.interaction).toBe(1);
  });

  it('computes pass rate', () => {
    const sc = computeScorecard([], 8, 10);
    expect(sc.passRate).toBeCloseTo(0.8);
  });

  it('handles zero total rules', () => {
    const sc = computeScorecard([], 0, 0);
    expect(sc.passRate).toBe(1);
  });
});
