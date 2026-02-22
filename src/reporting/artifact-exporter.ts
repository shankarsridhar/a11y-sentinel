import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import type { RouteSummary } from '../core/types.js';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function getArtifactDir(outputDir: string, routeName: string): string {
  return join(outputDir, 'artifacts', slugify(routeName));
}

export function saveSummary(dir: string, summary: RouteSummary) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'summary.yaml'), yamlStringify(summary), 'utf-8');
}
