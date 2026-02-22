import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { loadConfig, ConfigError } from '../../src/config/loader.js';

const TMP_CONFIG = '/tmp/test-a11y-sentinel.yml';

function writeConfig(content: string) {
  writeFileSync(TMP_CONFIG, content, 'utf-8');
}

afterEach(() => {
  if (existsSync(TMP_CONFIG)) unlinkSync(TMP_CONFIG);
});

describe('loadConfig', () => {
  it('parses a valid config', () => {
    writeConfig(`
baseUrl: "https://example.com"
routes:
  - path: "/home"
    name: "Home"
output:
  dir: "./reports"
  formats: [terminal, json]
  embedScreenshots: true
`);
    const config = loadConfig(TMP_CONFIG);
    expect(config.baseUrl).toBe('https://example.com');
    expect(config.routes).toHaveLength(1);
    expect(config.routes[0].path).toBe('/home');
    expect(config.output.formats).toEqual(['terminal', 'json']);
  });

  it('applies defaults for optional fields', () => {
    writeConfig(`
baseUrl: "https://example.com"
routes:
  - path: "/"
    name: "Home"
`);
    const config = loadConfig(TMP_CONFIG);
    expect(config.output.dir).toBe('./a11y-reports');
    expect(config.output.formats).toEqual(['terminal']);
    expect(config.output.embedScreenshots).toBe(true);
    expect(config.excludeRules).toEqual([]);
  });

  it('throws ConfigError for missing file', () => {
    expect(() => loadConfig('/tmp/nonexistent.yml')).toThrow(ConfigError);
    expect(() => loadConfig('/tmp/nonexistent.yml')).toThrow('not found');
  });

  it('throws ConfigError for invalid YAML', () => {
    writeConfig('{ invalid yaml :::');
    expect(() => loadConfig(TMP_CONFIG)).toThrow(ConfigError);
  });

  it('throws ConfigError with readable messages for validation failures', () => {
    writeConfig(`
baseUrl: "not-a-url"
routes: []
`);
    try {
      loadConfig(TMP_CONFIG);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const msg = (err as ConfigError).message;
      expect(msg).toContain('Config error');
      expect(msg).toContain('baseUrl');
      expect(msg).toContain('routes');
    }
  });

  it('validates route waitFor enum', () => {
    writeConfig(`
baseUrl: "https://example.com"
routes:
  - path: "/"
    name: "Home"
    waitFor: "invalid"
`);
    expect(() => loadConfig(TMP_CONFIG)).toThrow(ConfigError);
  });

  it('parses thresholds', () => {
    writeConfig(`
baseUrl: "https://example.com"
routes:
  - path: "/"
    name: "Home"
thresholds:
  maxCritical: 0
  maxMajor: 5
`);
    const config = loadConfig(TMP_CONFIG);
    expect(config.thresholds?.maxCritical).toBe(0);
    expect(config.thresholds?.maxMajor).toBe(5);
  });

  it('parses auth config', () => {
    writeConfig(`
baseUrl: "https://example.com"
auth:
  type: cookie
  name: session
  value: abc123
routes:
  - path: "/"
    name: "Home"
`);
    const config = loadConfig(TMP_CONFIG);
    expect(config.auth?.type).toBe('cookie');
    expect(config.auth?.name).toBe('session');
  });
});
