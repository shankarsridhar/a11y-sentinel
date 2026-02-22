# a11y-sentinel

Multi-layer accessibility auditing CLI that combines axe-core scanning with browser interaction testing, then exports structured artifacts for AI-powered analysis.

## What it does

**Layer 1 — axe-core** runs WCAG 2.0/2.1 AA rules against live browser pages via Playwright, catching issues like missing alt text, contrast failures, and missing form labels.

**Layer 2 — Interaction testing** goes beyond static analysis:
- Keyboard navigation: trap detection, missing focus indicators, unreachable elements, undersized touch targets
- Forms: missing `aria-invalid`, `aria-required`, error message associations
- Modals: focus management, focus trapping, Escape key handling, focus return
- Dynamic content: `aria-live` / role semantics validation

**Layer 3 — Artifact export** saves clean screenshots, accessibility trees (YAML), and structural summaries to disk for analysis by Claude Code or other AI tools.

## Quick start

```bash
npm install
npm run build

# Single URL audit
npx a11y-sentinel audit --url https://example.com --format terminal

# Multi-route audit with config
npx a11y-sentinel init              # creates .a11y-sentinel.yml
npx a11y-sentinel audit --config .a11y-sentinel.yml --format terminal,json,html
```

## CLI commands

```
a11y-sentinel init                        Create starter config
a11y-sentinel validate-config             Validate config file
a11y-sentinel audit [options]             Run accessibility audit
```

### Audit options

| Flag | Description |
|------|-------------|
| `-u, --url <url>` | Single URL to audit |
| `-c, --config <path>` | Path to `.a11y-sentinel.yml` |
| `-f, --format <formats>` | Comma-separated: `terminal`, `json`, `html` |
| `-l, --layer <layer>` | Run specific layer: `axe-core` or `interaction` |
| `-o, --output-dir <path>` | Output directory (default: `./a11y-reports`) |
| `--open` | Open HTML report in browser after generation |
| `-v, --verbose` | Debug logging |

## Config format

```yaml
baseUrl: "https://www.w3.org/WAI/demos/bad/before"
routes:
  - path: "/home.html"
    name: "Home Page"
  - path: "/survey.html"
    name: "Survey Page"
    waitFor: "load"
output:
  dir: "./a11y-reports"
  formats: [terminal, json, html]
  embedScreenshots: true
thresholds:
  maxCritical: 0
  maxMajor: 5
```

## Reports

**Terminal** — grouped findings sorted by severity with selector examples:

```
┌────────────────────────────────────────────────────┐
│  a11y-sentinel v0.1.0 — Audit Results              │
│  https://www.w3.org — 1 route                      │
├────────────────────────────────────────────────────┤
│  ● 39 critical  ● 10 major  ● 1 minor             │
└────────────────────────────────────────────────────┘

▸ Home Page — 50 findings
  ✖ 1.1.1 Missing alt text — 33 instances (critical)
    img.hero-banner, img.logo, img.team-photo, +30 more
```

**HTML** — self-contained report with scorecard cards, annotated screenshots (red outlines on violating elements), grouped findings with expandable fix suggestions.

**JSON** — machine-readable report with individual `findings[]` and grouped `findingGroups[]` for programmatic use.

## Artifact export

Each audit exports to `a11y-reports/artifacts/{route-name}/`:

```
artifacts/
  home-page/
    screenshot-initial.png          # Clean page screenshot
    screenshot-annotated.png        # Red outlines on violations
    screenshot-after-tab-through.png
    a11y-tree-initial.yaml          # Full accessibility tree
    a11y-tree-after-tab-through.yaml
    summary.yaml                    # Heading outline, landmarks, interactive counts, tab order
```

After the CLI finishes, ask Claude Code to analyze the artifacts:

> "Analyze the artifacts in `a11y-reports/artifacts/` for semantic WCAG issues. Start with each route's `summary.yaml` for structural issues, then review screenshots and accessibility trees for naming quality, contrast, reading order, and ARIA patterns."

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Audit passed (thresholds met or no thresholds set) |
| `1` | Audit completed but thresholds exceeded |
| `2` | Fatal error (bad config, browser launch failure) |

## WCAG coverage

### Layer 1 (axe-core) — high confidence
All WCAG 2.0/2.1 AA rules supported by axe-core, including: 1.1.1 Non-text Content, 1.4.3 Contrast, 2.4.4 Link Purpose, 3.1.1 Language, 4.1.2 Name/Role/Value, and many more.

### Layer 2 (interaction testing)
| Check | WCAG | Severity |
|-------|------|----------|
| Missing focus indicator | 2.4.7 | major |
| Keyboard trap | 2.1.2 | critical |
| Unreachable interactive element | 2.1.1 | critical |
| Touch target < 24x24px | 2.5.8 | minor |
| Missing `aria-invalid` after submit | 3.3.1 | major |
| Missing error message association | 3.3.1 | major |
| Missing `aria-required` | 3.3.2 | minor |
| Focus not moved into modal | 2.4.3 | major |
| Focus not trapped in modal | 2.1.2 | critical |
| Escape doesn't close modal | 2.1.2 | major |
| Focus not returned after modal close | 2.4.3 | major |
| `aria-live` / role mismatch | 4.1.3 | minor |
| Empty live region | 4.1.3 | minor |

## Development

```bash
npm run build           # Compile TypeScript
npm run dev             # Watch mode
npm test                # Unit tests (18 tests)
npm run test:integration # Integration tests against W3C BAD pages (6 tests)
npm run lint            # ESLint
```

## Tech stack

TypeScript, Node.js (ES2022), Playwright, axe-core, Commander.js, Zod, Handlebars, Vitest

## License

MIT
