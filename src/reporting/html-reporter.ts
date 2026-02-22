import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Handlebars from 'handlebars';
import type { Finding, FindingGroup, Scorecard, SentinelConfig } from '../core/types.js';
import { getArtifactDir } from './artifact-exporter.js';

// Register Handlebars helpers
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('percentage', (n: number) => `${(n * 100).toFixed(1)}%`);
Handlebars.registerHelper('severityColor', (severity: string) => {
  const map: Record<string, string> = {
    critical: '#e53e3e',
    major: '#dd6b20',
    minor: '#718096',
  };
  return map[severity] ?? '#718096';
});
Handlebars.registerHelper('truncate', (s: string, max: number) => {
  if (typeof s !== 'string') return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
});

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>a11y-sentinel Audit Report</title>
<style>
  :root { --red: #e53e3e; --orange: #dd6b20; --gray: #718096; --bg: #f7fafc; --card: #fff; --border: #e2e8f0; --text: #1a202c; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .meta { color: var(--gray); font-size: 0.875rem; margin-bottom: 2rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }
  .card-label { font-size: 0.75rem; text-transform: uppercase; color: var(--gray); letter-spacing: 0.05em; }
  .card-value { font-size: 1.75rem; font-weight: 700; }
  .card-value.critical { color: var(--red); }
  .card-value.major { color: var(--orange); }
  .card-value.minor { color: var(--gray); }
  .route-section { background: var(--card); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1.5rem; overflow: hidden; }
  .route-header { padding: 1rem 1.5rem; background: #edf2f7; font-weight: 600; border-bottom: 1px solid var(--border); }
  .route-body { padding: 1.5rem; }
  .screenshot { max-width: 100%; height: auto; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 1rem; }
  .finding-group { padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
  .finding-group:last-child { border-bottom: none; }
  .finding-header { display: flex; align-items: center; gap: 0.5rem; }
  .severity-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .criterion { font-weight: 600; min-width: 3rem; }
  .desc { flex: 1; }
  .count-badge { background: #edf2f7; border-radius: 4px; padding: 0.125rem 0.5rem; font-size: 0.75rem; color: var(--gray); }
  .selectors { font-size: 0.8rem; color: var(--gray); font-family: monospace; margin-top: 0.25rem; padding-left: 1.25rem; }
  details summary { cursor: pointer; color: var(--gray); font-size: 0.8rem; margin-top: 0.25rem; padding-left: 1.25rem; }
  details[open] summary { margin-bottom: 0.25rem; }
  .fix { font-size: 0.8rem; padding-left: 1.25rem; background: #f0fff4; border-left: 3px solid #48bb78; padding: 0.5rem 0.75rem; margin-top: 0.25rem; margin-left: 1.25rem; border-radius: 0 4px 4px 0; }
  .verdict { text-align: center; padding: 1rem; font-size: 1.25rem; font-weight: 700; border-radius: 8px; margin-top: 2rem; }
  .verdict.pass { background: #f0fff4; color: #276749; }
  .verdict.fail { background: #fff5f5; color: #c53030; }
  @media (max-width: 640px) { body { padding: 1rem; } .cards { grid-template-columns: 1fr 1fr; } }
  :focus-visible { outline: 2px solid #4299e1; outline-offset: 2px; }
</style>
</head>
<body>
<h1>a11y-sentinel Audit Report</h1>
<p class="meta">{{baseUrl}} &middot; {{date}} &middot; {{routeCount}} route{{#unless singleRoute}}s{{/unless}}</p>

<div class="cards">
  <div class="card"><div class="card-label">Critical</div><div class="card-value critical">{{scorecard.bySeverity.critical}}</div></div>
  <div class="card"><div class="card-label">Major</div><div class="card-value major">{{scorecard.bySeverity.major}}</div></div>
  <div class="card"><div class="card-label">Minor</div><div class="card-value minor">{{scorecard.bySeverity.minor}}</div></div>
  <div class="card"><div class="card-label">Pass Rate</div><div class="card-value">{{percentage scorecard.passRate}}</div></div>
</div>

{{#each routes}}
<section class="route-section">
  <div class="route-header">{{this.name}} — {{this.findingCount}} finding{{#unless this.singleFinding}}s{{/unless}}</div>
  <div class="route-body">
    {{#if this.screenshotBase64}}
    <img class="screenshot" src="data:image/png;base64,{{this.screenshotBase64}}" alt="Annotated screenshot of {{this.name}} showing accessibility violations highlighted in red">
    {{/if}}
    {{#each this.groups}}
    <div class="finding-group">
      <div class="finding-header">
        <span class="severity-dot" style="background:{{severityColor this.severity}}"></span>
        <span class="criterion">{{this.wcagCriterion}}</span>
        <span class="desc">{{truncate this.description 80}}</span>
        <span class="count-badge">{{this.count}}</span>
      </div>
      <div class="selectors">{{#each this.exampleSelectors}}{{#unless @first}}, {{/unless}}{{truncate this 60}}{{/each}}{{#if this.hasMore}}, +{{this.overflowCount}} more{{/if}}</div>
      <details>
        <summary>Fix suggestion</summary>
        <div class="fix">{{this.fixSuggestion}}</div>
      </details>
    </div>
    {{/each}}
  </div>
</section>
{{/each}}

{{#if hasThresholds}}
<div class="verdict {{verdictClass}}">
  {{#if passed}}PASS — {{scorecard.totalFindings}} findings within thresholds{{else}}FAIL — thresholds exceeded{{/if}}
</div>
{{else}}
<div class="verdict" style="background:#edf2f7;color:var(--text);">{{scorecard.totalFindings}} findings found</div>
{{/if}}
</body>
</html>`;

export async function writeHtmlReport(
  findings: Finding[],
  groups: FindingGroup[],
  scorecard: Scorecard,
  config: SentinelConfig,
  outputPath: string,
  outputDir: string,
) {
  const template = Handlebars.compile(TEMPLATE);

  // Group findings by route
  const routeData = config.routes.map((route) => {
    const routeGroups = groups
      .filter((g) => g.route === route.name)
      .map((g) => ({
        ...g,
        hasMore: g.count > g.exampleSelectors.length,
        overflowCount: g.count - g.exampleSelectors.length,
      }));

    const findingCount = routeGroups.reduce((s, g) => s + g.count, 0);

    // Load annotated screenshot as base64
    let screenshotBase64 = '';
    if (config.output?.embedScreenshots !== false) {
      const annotatedPath = join(
        getArtifactDir(outputDir, route.name),
        'screenshot-annotated.png',
      );
      if (existsSync(annotatedPath)) {
        screenshotBase64 = readFileSync(annotatedPath).toString('base64');
      }
    }

    return {
      name: route.name,
      groups: routeGroups,
      findingCount,
      singleFinding: findingCount === 1,
      screenshotBase64,
    };
  });

  const hasThresholds = !!config.thresholds;
  const passed = hasThresholds
    ? scorecard.bySeverity.critical <= (config.thresholds?.maxCritical ?? 0) &&
      scorecard.bySeverity.major <= (config.thresholds?.maxMajor ?? 0)
    : true;

  const html = template({
    baseUrl: config.baseUrl,
    date: new Date().toISOString().split('T')[0],
    routeCount: config.routes.length,
    singleRoute: config.routes.length === 1,
    scorecard,
    routes: routeData,
    hasThresholds,
    passed,
    verdictClass: passed ? 'pass' : 'fail',
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html, 'utf-8');
}
