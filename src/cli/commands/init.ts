import { writeFileSync, existsSync } from 'node:fs';
import { DEFAULT_CONFIG_FILENAME, STARTER_CONFIG } from '../../config/defaults.js';
import * as logger from '../../utils/logger.js';

export function runInit() {
  if (existsSync(DEFAULT_CONFIG_FILENAME)) {
    logger.warn(`${DEFAULT_CONFIG_FILENAME} already exists. Skipping.`);
    return;
  }

  writeFileSync(DEFAULT_CONFIG_FILENAME, STARTER_CONFIG, 'utf-8');
  logger.success(`Created ${DEFAULT_CONFIG_FILENAME}`);
  logger.info('Edit the config file with your base URL and routes, then run:');
  console.log(`  npx a11y-sentinel audit --config ${DEFAULT_CONFIG_FILENAME}\n`);
}
