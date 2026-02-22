import { loadConfig, ConfigError } from '../../config/loader.js';
import * as logger from '../../utils/logger.js';

export function runValidateConfig(configPath: string) {
  try {
    const config = loadConfig(configPath);
    logger.success('Config is valid.');
    logger.info(`Base URL: ${config.baseUrl}`);
    logger.info(`Routes: ${config.routes.length}`);
    logger.info(`Output formats: ${config.output.formats.join(', ')}`);
  } catch (err) {
    if (err instanceof ConfigError) {
      logger.error(err.message);
      process.exit(2);
    }
    throw err;
  }
}
