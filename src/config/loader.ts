import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { ZodError } from 'zod';
import { sentinelConfigSchema, type ValidatedConfig } from './schema.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function formatZodErrors(error: ZodError, filePath: string): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `  → ${path}: ${issue.message}`;
  });
  return `Config error in ${filePath}:\n${lines.join('\n')}`;
}

export function loadConfig(filePath: string): ValidatedConfig {
  if (!existsSync(filePath)) {
    throw new ConfigError(`Config file not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch {
    throw new ConfigError(`Failed to parse YAML in ${filePath}`);
  }

  const result = sentinelConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(formatZodErrors(result.error, filePath));
  }

  return result.data;
}
