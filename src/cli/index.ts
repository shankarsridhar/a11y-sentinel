#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runValidateConfig } from './commands/validate-config.js';
import { runAudit } from './commands/audit.js';
import { DEFAULT_CONFIG_FILENAME } from '../config/defaults.js';
import { banner } from './ui.js';

const program = new Command();

program
  .name('a11y-sentinel')
  .version('0.1.0')
  .description('Multi-layer accessibility auditing CLI');

program
  .command('init')
  .description(`Create a starter ${DEFAULT_CONFIG_FILENAME} config file`)
  .action(() => {
    banner();
    runInit();
  });

program
  .command('validate-config')
  .description('Validate an a11y-sentinel config file')
  .option('-c, --config <path>', 'Path to config file', DEFAULT_CONFIG_FILENAME)
  .action((opts) => {
    banner();
    runValidateConfig(opts.config);
  });

program
  .command('audit')
  .description('Run accessibility audit')
  .option('-u, --url <url>', 'Single URL to audit')
  .option('-c, --config <path>', 'Path to config file')
  .option('-f, --format <formats>', 'Output formats (comma-separated: terminal,json,html)')
  .option('-l, --layer <layer>', 'Run specific layer only (axe-core, interaction)')
  .option('-o, --output-dir <path>', 'Output directory')
  .option('--open', 'Open HTML report in browser after generation')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((opts) => {
    banner();
    runAudit(opts);
  });

program.parse();
