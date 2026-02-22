import { describe, it, expect } from 'vitest';
import { dedup, groupFindings } from '../../src/reporting/aggregator.js';
import type { Finding } from '../../src/core/types.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'abc123',
    wcagCriterion: '1.1.1',
    severity: 'critical',
    confidence: 'high',
    sourceLayer: 'axe-core',
    route: 'Home',
    selector: 'img.hero',
    accessibleName: '',
    description: 'Missing alt text',
    impact: 'critical',
    fixSuggestion: 'Add alt attribute',
    screenshotRef: null,
    stateContext: null,
    ...overrides,
  };
}

describe('dedup', () => {
  it('removes duplicates by id', () => {
    const findings = [
      makeFinding({ id: 'a' }),
      makeFinding({ id: 'a', stateContext: 'after modal open' }),
      makeFinding({ id: 'b' }),
    ];
    const result = dedup(findings);
    expect(result).toHaveLength(2);
    expect(result[0].stateContext).toBeNull(); // keeps first-seen
  });

  it('returns empty for empty input', () => {
    expect(dedup([])).toEqual([]);
  });
});

describe('groupFindings', () => {
  it('groups by wcagCriterion + description + route', () => {
    const findings = [
      makeFinding({ id: 'a', selector: 'img.hero' }),
      makeFinding({ id: 'b', selector: 'img.logo' }),
      makeFinding({ id: 'c', selector: 'img.team' }),
      makeFinding({ id: 'd', selector: 'img.footer' }),
    ];
    const groups = groupFindings(findings);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(4);
    expect(groups[0].exampleSelectors).toHaveLength(3); // max 3
  });

  it('separates different routes', () => {
    const findings = [
      makeFinding({ id: 'a', route: 'Home' }),
      makeFinding({ id: 'b', route: 'About' }),
    ];
    const groups = groupFindings(findings);
    expect(groups).toHaveLength(2);
  });

  it('sorts by severity (critical first)', () => {
    const findings = [
      makeFinding({ id: 'a', severity: 'minor', wcagCriterion: '2.5.8' }),
      makeFinding({ id: 'b', severity: 'critical', wcagCriterion: '1.1.1' }),
      makeFinding({ id: 'c', severity: 'major', wcagCriterion: '2.4.7' }),
    ];
    const groups = groupFindings(findings);
    expect(groups[0].severity).toBe('critical');
    expect(groups[1].severity).toBe('major');
    expect(groups[2].severity).toBe('minor');
  });
});
