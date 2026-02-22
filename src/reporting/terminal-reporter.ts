import chalk from 'chalk';
import type { FindingGroup, Scorecard, Severity, SentinelConfig } from '../core/types.js';

const SEVERITY_ICON: Record<Severity, string> = {
  critical: chalk.red('●'),
  major: chalk.yellow('●'),
  minor: chalk.gray('●'),
};

const SEVERITY_LABEL: Record<Severity, (s: string) => string> = {
  critical: chalk.red,
  major: chalk.yellow,
  minor: chalk.gray,
};

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

export function printTerminalReport(
  groups: FindingGroup[],
  scorecard: Scorecard,
  config: SentinelConfig,
  reportPaths: string[],
) {
  const { bySeverity } = scorecard;

  // Header box
  console.log(chalk.cyan('┌' + '─'.repeat(52) + '┐'));
  console.log(
    chalk.cyan('│') +
    chalk.bold('  a11y-sentinel v0.1.0 — Audit Results') +
    ' '.repeat(14) +
    chalk.cyan('│'),
  );
  console.log(
    chalk.cyan('│') +
    `  ${config.baseUrl} — ${config.routes.length} route${config.routes.length > 1 ? 's' : ''}` +
    ' '.repeat(Math.max(0, 52 - config.baseUrl.length - String(config.routes.length).length - 12)) +
    chalk.cyan('│'),
  );
  console.log(chalk.cyan('├' + '─'.repeat(52) + '┤'));
  console.log(
    chalk.cyan('│') +
    `  ${SEVERITY_ICON.critical} ${bySeverity.critical} critical  ` +
    `${SEVERITY_ICON.major} ${bySeverity.major} major  ` +
    `${SEVERITY_ICON.minor} ${bySeverity.minor} minor` +
    ' '.repeat(Math.max(0, 52 -
      String(bySeverity.critical).length -
      String(bySeverity.major).length -
      String(bySeverity.minor).length - 35)) +
    chalk.cyan('│'),
  );
  console.log(chalk.cyan('└' + '─'.repeat(52) + '┘'));
  console.log();

  // Group by route
  const byRoute = new Map<string, FindingGroup[]>();
  for (const g of groups) {
    const list = byRoute.get(g.route) ?? [];
    list.push(g);
    byRoute.set(g.route, list);
  }

  for (const [route, routeGroups] of byRoute) {
    const total = routeGroups.reduce((sum, g) => sum + g.count, 0);
    console.log(chalk.bold(`▸ ${route}`) + chalk.gray(` — ${total} finding${total !== 1 ? 's' : ''}`));

    for (const g of routeGroups) {
      const selectors = g.exampleSelectors
        .map((s) => truncate(s, 60))
        .join(', ');
      const overflow = g.count > g.exampleSelectors.length
        ? `, +${g.count - g.exampleSelectors.length} more`
        : '';

      console.log(
        `  ${SEVERITY_LABEL[g.severity]('✖')} ${g.wcagCriterion} ${g.description}` +
        chalk.gray(` — ${g.count} instance${g.count !== 1 ? 's' : ''} (${g.severity})`),
      );
      console.log(chalk.gray(`    ${selectors}${overflow}`));
    }
    console.log();
  }

  // Bottom line
  console.log(chalk.gray('─'.repeat(52)));
  const { thresholds } = config;
  if (thresholds) {
    const critFail = bySeverity.critical > thresholds.maxCritical;
    const majFail = bySeverity.major > thresholds.maxMajor;
    const passed = !critFail && !majFail;

    if (passed) {
      console.log(chalk.green.bold('PASS') + chalk.gray(` — ${scorecard.totalFindings} findings within thresholds`));
    } else {
      const parts: string[] = [];
      if (critFail) parts.push(`${bySeverity.critical} critical (threshold: ${thresholds.maxCritical})`);
      if (majFail) parts.push(`${bySeverity.major} major (threshold: ${thresholds.maxMajor})`);
      console.log(chalk.red.bold('FAIL') + ` — ${parts.join(', ')}`);
    }
  } else {
    console.log(chalk.bold(`${scorecard.totalFindings} finding${scorecard.totalFindings !== 1 ? 's' : ''} found`));
  }

  if (reportPaths.length > 0) {
    console.log(chalk.gray(`Reports: ${reportPaths.join(', ')}`));
  }
  console.log();
}
