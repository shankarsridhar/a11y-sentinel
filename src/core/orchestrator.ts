import { join } from 'node:path';
import { exec } from 'node:child_process';
import { platform } from 'node:os';
import type { SentinelConfig, SourceLayer, Finding, FindingGroup } from './types.js';
import { launchBrowser, createContext, navigateToRoute, closeBrowser } from './browser.js';
import { runAxeScan } from '../layers/axe-scanner.js';
import { dedup, groupFindings } from '../reporting/aggregator.js';
import { computeScorecard } from '../reporting/scorecard.js';
import { printTerminalReport } from '../reporting/terminal-reporter.js';
import { getArtifactDir, saveSummary } from '../reporting/artifact-exporter.js';
import { captureClean, captureAnnotated } from '../utils/screenshot.js';
import { extractA11yTree, saveA11yTree, extractSummary } from '../utils/a11y-tree.js';
import { createSpinner } from '../cli/ui.js';
import * as logger from '../utils/logger.js';

interface PipelineOptions {
  layers?: SourceLayer[];
  open?: boolean;
}

export async function runAuditPipeline(
  config: SentinelConfig,
  options: PipelineOptions,
): Promise<number> {
  const runAxe = !options.layers || options.layers.includes('axe-core');
  const runInteraction = !options.layers || options.layers.includes('interaction');
  const outputDir = config.output?.dir ?? './a11y-reports';
  const formats = config.output?.formats ?? ['terminal'];

  let allFindings: Finding[] = [];
  let totalPassed = 0;
  let totalRules = 0;
  const reportPaths: string[] = [];

  const spinner = createSpinner('Starting audit...');
  spinner.start();

  let browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    spinner.fail('Failed to launch browser.');
    logger.error((err as Error).message);
    return 2;
  }

  try {
    const context = await createContext(browser, config);
    const page = await context.newPage();

    for (let i = 0; i < config.routes.length; i++) {
      const route = config.routes[i];
      const routeLabel = `${route.name} (${i + 1}/${config.routes.length})`;
      const artifactDir = getArtifactDir(outputDir, route.name);

      // Navigate
      spinner.text = `Auditing ${routeLabel} — loading page...`;
      try {
        await navigateToRoute(page, config.baseUrl, route);
      } catch {
        logger.warn(`Skipping ${route.name}: failed to load ${route.path}`);
        continue;
      }

      // Capture initial artifacts
      spinner.text = `Auditing ${routeLabel} — capturing artifacts...`;
      await captureClean(page, join(artifactDir, 'screenshot-initial.png'));

      const tree = await extractA11yTree(page);
      saveA11yTree(tree, join(artifactDir, 'a11y-tree-initial.yaml'));

      const summary = extractSummary(tree);
      saveSummary(artifactDir, summary);

      // Layer 1: axe-core
      if (runAxe) {
        spinner.text = `Auditing ${routeLabel} — axe-core scan...`;
        try {
          const { findings, passedCount, totalCount } = await runAxeScan(
            page,
            route.name,
            config.excludeRules,
          );
          allFindings.push(...findings);
          totalPassed += passedCount;
          totalRules += totalCount;
        } catch (err) {
          logger.warn(`axe-core scan failed for ${route.name}: ${(err as Error).message}`);
        }
      }

      // Layer 2: interaction tests (Phase 3)
      if (runInteraction) {
        spinner.text = `Auditing ${routeLabel} — interaction tests...`;
        try {
          const { runInteractionTests } = await import('../layers/interaction-tester.js');
          const interactionFindings = await runInteractionTests(
            page,
            route.name,
            artifactDir,
            config.excludeRules ?? [],
          );
          allFindings.push(...interactionFindings);
        } catch {
          logger.debug('Interaction tests not yet available.');
        }
      }

      // Capture annotated screenshot for HTML report
      const violatingSelectors = allFindings
        .filter((f) => f.route === route.name)
        .map((f) => f.selector)
        .filter((s) => s && !s.includes(','));
      const uniqueSelectors = [...new Set(violatingSelectors)];
      if (uniqueSelectors.length > 0) {
        await captureAnnotated(
          page,
          uniqueSelectors,
          join(artifactDir, 'screenshot-annotated.png'),
        );
      }
    }

    await page.close();
    await context.close();
  } finally {
    await closeBrowser(browser);
  }

  spinner.stop();

  // Dedup + group
  allFindings = dedup(allFindings);
  const groups: FindingGroup[] = groupFindings(allFindings);
  const scorecard = computeScorecard(allFindings, totalPassed, totalRules);

  // Terminal report
  if (formats.includes('terminal')) {
    printTerminalReport(groups, scorecard, config, reportPaths);
  }

  // JSON report
  if (formats.includes('json')) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const jsonPath = join(outputDir, `report-${timestamp}.json`);
    const { writeJsonReport } = await import('../reporting/json-reporter.js');
    writeJsonReport(allFindings, groups, scorecard, config, jsonPath);
    reportPaths.push(jsonPath);
  }

  // HTML report
  if (formats.includes('html')) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const htmlPath = join(outputDir, `report-${timestamp}.html`);
    try {
      const { writeHtmlReport } = await import('../reporting/html-reporter.js');
      await writeHtmlReport(allFindings, groups, scorecard, config, htmlPath, outputDir);
      reportPaths.push(htmlPath);
    } catch {
      logger.debug('HTML reporter not yet available.');
    }
  }

  // Re-print report paths if terminal was included (they weren't ready during initial print)
  if (formats.includes('terminal') && reportPaths.length > 0) {
    console.log(chalk.gray(`Reports: ${reportPaths.join(', ')}\n`));
  }

  // Open HTML report
  if (options.open && reportPaths.some((p) => p.endsWith('.html'))) {
    const htmlPath = reportPaths.find((p) => p.endsWith('.html'))!;
    const cmd = platform() === 'darwin' ? 'open' : 'xdg-open';
    exec(`${cmd} ${htmlPath}`);
  }

  // Exit code
  if (config.thresholds) {
    const { maxCritical, maxMajor } = config.thresholds;
    if (
      scorecard.bySeverity.critical > maxCritical ||
      scorecard.bySeverity.major > maxMajor
    ) {
      return 1;
    }
  }

  return 0;
}

// chalk is used late in function — import at top level
import chalk from 'chalk';
