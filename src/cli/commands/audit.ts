import { loadConfig, ConfigError } from '../../config/loader.js';
import { setVerbose } from '../../utils/logger.js';
import * as logger from '../../utils/logger.js';
import type { SentinelConfig } from '../../core/types.js';

interface AuditOptions {
  url?: string;
  config?: string;
  format?: string;
  layer?: string;
  outputDir?: string;
  open?: boolean;
  verbose?: boolean;
}

function deriveRouteName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.replace(/^\//, '').replace(/\.\w+$/, '') || 'home';
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Page';
  }
}

function buildConfigFromUrl(url: string, opts: AuditOptions): SentinelConfig {
  const urlObj = new URL(url);
  return {
    baseUrl: `${urlObj.protocol}//${urlObj.host}`,
    routes: [{ path: urlObj.pathname, name: deriveRouteName(url) }],
    output: {
      dir: opts.outputDir ?? './a11y-reports',
      formats: opts.format
        ? (opts.format.split(',') as NonNullable<SentinelConfig['output']>['formats'])
        : ['terminal'],
      embedScreenshots: true,
    },
  };
}

export async function runAudit(opts: AuditOptions) {
  if (opts.verbose) setVerbose(true);

  let config: SentinelConfig;

  if (opts.url) {
    try {
      config = buildConfigFromUrl(opts.url, opts);
    } catch {
      logger.error('Invalid URL provided.');
      process.exit(2);
    }
  } else if (opts.config) {
    try {
      config = loadConfig(opts.config);
    } catch (err) {
      if (err instanceof ConfigError) {
        logger.error(err.message);
        process.exit(2);
      }
      throw err;
    }
  } else {
    logger.error('Provide --url or --config.');
    process.exit(2);
  }

  if (opts.format) {
    config.output = {
      ...config.output!,
      formats: opts.format.split(',') as NonNullable<SentinelConfig['output']>['formats'],
    };
  }
  if (opts.outputDir) {
    config.output = { ...config.output!, dir: opts.outputDir };
  }

  const layers = opts.layer
    ? [opts.layer as 'axe-core' | 'interaction']
    : undefined;

  // Dynamically import orchestrator to avoid circular deps at module load
  const { runAuditPipeline } = await import('../../core/orchestrator.js');
  const exitCode = await runAuditPipeline(config, { layers, open: opts.open });
  process.exit(exitCode);
}
