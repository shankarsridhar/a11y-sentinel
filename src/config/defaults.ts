export const DEFAULT_CONFIG_FILENAME = '.a11y-sentinel.yml';

export const STARTER_CONFIG = `# a11y-sentinel configuration
baseUrl: "https://example.com"
routes:
  - path: "/"
    name: "Home Page"
output:
  dir: "./a11y-reports"
  formats: [terminal, json, html]
  embedScreenshots: true
# thresholds:
#   maxCritical: 0
#   maxMajor: 5
# excludeRules: []
`;
