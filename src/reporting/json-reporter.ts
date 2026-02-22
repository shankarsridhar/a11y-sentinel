import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Finding, FindingGroup, Scorecard, SentinelConfig, AuditReport } from '../core/types.js';

export function writeJsonReport(
  findings: Finding[],
  groups: FindingGroup[],
  scorecard: Scorecard,
  config: SentinelConfig,
  outputPath: string,
) {
  const report: AuditReport = {
    metadata: {
      toolVersion: '0.1.0',
      auditDate: new Date().toISOString(),
      baseUrl: config.baseUrl,
      routesAudited: config.routes.map((r) => r.name),
      layersRun: ['axe-core'],
    },
    scorecard,
    findings,
    findingGroups: groups,
    artifacts: [],
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}
