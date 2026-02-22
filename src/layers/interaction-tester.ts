import { join } from 'node:path';
import type { Page } from 'playwright';
import type { Finding } from '../core/types.js';
import { testKeyboardNav } from './interactions/keyboard-nav.js';
import { testForms } from './interactions/form-interaction.js';
import { testModals } from './interactions/modal-dialog.js';
import { testDynamicContent } from './interactions/dynamic-content.js';
import { runAxeScan } from './axe-scanner.js';
import { captureClean } from '../utils/screenshot.js';
import { extractA11yTree, saveA11yTree } from '../utils/a11y-tree.js';
import * as logger from '../utils/logger.js';

export async function runInteractionTests(
  page: Page,
  route: string,
  artifactDir: string,
  excludeRules: string[],
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Keyboard navigation
  try {
    const { findings: kbFindings, tabOrder } = await testKeyboardNav(page, route);
    findings.push(...kbFindings);

    // Capture post-tab-through state
    await captureClean(page, join(artifactDir, 'screenshot-after-tab-through.png'));
    const tree = await extractA11yTree(page);
    saveA11yTree(tree, join(artifactDir, 'a11y-tree-after-tab-through.yaml'));
  } catch (err) {
    logger.debug(`Keyboard nav test failed for ${route}: ${(err as Error).message}`);
  }

  // Form interaction
  try {
    const formFindings = await testForms(page, route);
    findings.push(...formFindings);

    if (formFindings.length > 0) {
      await captureClean(page, join(artifactDir, 'screenshot-after-form-submit.png'));
      const tree = await extractA11yTree(page);
      saveA11yTree(tree, join(artifactDir, 'a11y-tree-after-form-submit.yaml'));

      // Re-run axe after form state change
      const { findings: postFormAxe } = await runAxeScan(
        page, route, excludeRules, 'after form submit',
      );
      findings.push(...postFormAxe);
    }
  } catch (err) {
    logger.debug(`Form test failed for ${route}: ${(err as Error).message}`);
  }

  // Modal dialog
  try {
    const modalFindings = await testModals(page, route);
    findings.push(...modalFindings);
  } catch (err) {
    logger.debug(`Modal test failed for ${route}: ${(err as Error).message}`);
  }

  // Dynamic content
  try {
    const dynFindings = await testDynamicContent(page, route);
    findings.push(...dynFindings);
  } catch (err) {
    logger.debug(`Dynamic content test failed for ${route}: ${(err as Error).message}`);
  }

  return findings;
}
