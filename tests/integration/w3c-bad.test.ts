import { describe, it, expect, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CLI = 'node dist/cli/index.js';
const OUT_DIR = '/tmp/a11y-sentinel-integration-test';

function cleanOutput() {
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
}

function runAudit(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 90_000,
      cwd: process.cwd(),
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; status?: number };
    return {
      stdout: execErr.stdout ?? '',
      exitCode: execErr.status ?? 2,
    };
  }
}

afterAll(() => cleanOutput());

describe('W3C BAD pages', () => {
  it('detects findings on BAD "before" home page (axe-core layer)', () => {
    cleanOutput();
    const { stdout, exitCode } = runAudit(
      `audit --url https://www.w3.org/WAI/demos/bad/before/home.html --layer axe-core --format terminal,json --output-dir ${OUT_DIR}`,
    );

    expect(stdout).toContain('1.1.1');
    expect(stdout).toContain('critical');

    // JSON report should exist
    const jsonFiles = execSync(`ls ${OUT_DIR}/report-*.json`, { encoding: 'utf-8' }).trim().split('\n');
    expect(jsonFiles.length).toBeGreaterThan(0);

    const report = JSON.parse(readFileSync(jsonFiles[0], 'utf-8'));
    expect(report.findings.length).toBeGreaterThan(10);
    expect(report.scorecard.bySeverity.critical).toBeGreaterThan(0);
  });

  it('detects interaction issues on BAD survey page', () => {
    cleanOutput();
    const { stdout } = runAudit(
      `audit --url https://www.w3.org/WAI/demos/bad/before/survey.html --format terminal --output-dir ${OUT_DIR}`,
    );

    // Should detect keyboard traps or form issues
    expect(stdout).toContain('finding');
  });

  it('exports artifacts with screenshots and a11y trees', () => {
    cleanOutput();
    runAudit(
      `audit --url https://www.w3.org/WAI/demos/bad/before/home.html --format terminal --output-dir ${OUT_DIR}`,
    );

    // Check artifacts directory exists
    const artifactDirs = execSync(`ls ${OUT_DIR}/artifacts/`, { encoding: 'utf-8' }).trim().split('\n');
    expect(artifactDirs.length).toBeGreaterThan(0);

    const routeDir = join(OUT_DIR, 'artifacts', artifactDirs[0]);
    expect(existsSync(join(routeDir, 'screenshot-initial.png'))).toBe(true);
    expect(existsSync(join(routeDir, 'a11y-tree-initial.yaml'))).toBe(true);
    expect(existsSync(join(routeDir, 'summary.yaml'))).toBe(true);
  });

  it('generates HTML report with embedded screenshots', () => {
    cleanOutput();
    runAudit(
      `audit --url https://www.w3.org/WAI/demos/bad/before/home.html --format html --output-dir ${OUT_DIR}`,
    );

    const htmlFiles = execSync(`ls ${OUT_DIR}/report-*.html`, { encoding: 'utf-8' }).trim().split('\n');
    expect(htmlFiles.length).toBeGreaterThan(0);

    const html = readFileSync(htmlFiles[0], 'utf-8');
    expect(html).toContain('a11y-sentinel');
    expect(html).toContain('data:image/png;base64');
  });

  it('returns exit code 1 when thresholds are exceeded', () => {
    cleanOutput();
    // Create a config with strict thresholds
    const configPath = join(OUT_DIR, 'strict.yml');
    const config = `
baseUrl: "https://www.w3.org/WAI/demos/bad/before"
routes:
  - path: "/home.html"
    name: "Home"
thresholds:
  maxCritical: 0
  maxMajor: 0
output:
  dir: "${OUT_DIR}"
  formats: [terminal]
`;
    const { mkdirSync, writeFileSync } = require('node:fs');
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(configPath, config);

    const { exitCode } = runAudit(
      `audit --config ${configPath}`,
    );
    expect(exitCode).toBe(1);
  });

  it('returns exit code 2 for invalid config', () => {
    const { exitCode } = runAudit(
      'audit --config /tmp/nonexistent-config.yml',
    );
    expect(exitCode).toBe(2);
  });
});
