# a11y-sentinel

**Multi-layer accessibility auditing CLI** that catches WCAG issues static analysis tools miss.

Standard axe-core-in-JSDOM testing catches roughly 30-40% of WCAG violations. It can't detect keyboard traps, missing focus indicators, broken modal behavior, or semantic problems that only surface in a real browser. a11y-sentinel runs axe-core against live Chromium pages, then goes further with automated interaction testing and exports structured artifacts for AI-powered semantic analysis.

---

**Table of contents**: [Who is this for](#who-is-this-for) | [Why a11y-sentinel](#why-a11y-sentinel) | [Getting started](#getting-started) | [How-to guides](#how-to-guides) | [Reference](#reference) | [How it works](#how-it-works) | [Development](#development) | [License](#license)

---

## Who is this for

- Frontend developers who want deeper a11y coverage than axe-core alone
- QA engineers auditing WCAG AA compliance on server-rendered pages
- Teams using AI tools (Claude Code, etc.) for accessibility review

### Prerequisites

- Node.js 18+
- npm

---

## Why a11y-sentinel

### Most axe-core setups miss real-browser issues

The typical approach — axe-core in JSDOM via jest-axe — runs against a simulated DOM that doesn't render CSS, compute layout, or execute media queries. Axe-core rules that depend on computed styles, bounding boxes, or visibility silently skip.

a11y-sentinel runs axe-core against a live Chromium page, so rules like color contrast, visibility-dependent checks, and focus-related rules actually execute.

| Capability | axe-core in JSDOM | axe-core in this CLI |
|--|--|--|
| Computed CSS styles | No | Yes |
| Layout and bounding boxes | No | Yes |
| Color contrast checking | Broken (no computed colors) | Works |
| Media queries / responsive | No | Yes |
| Focus-related rules | Can't focus in JSDOM | Works |
| iframes / shadow DOM | Limited | Full |

### Interaction testing catches what axe-core cannot

Axe-core — in any context — analyzes the DOM at a single point in time. It cannot test what happens when a user interacts with the page. These issues only surface through behavioral testing:

- **Keyboard traps** — A user Tabs into a widget and can never Tab out. The DOM is valid; the trap only manifests through sequential keyboard interaction.
- **Missing focus indicators** — A button has `outline: none` and no replacement style. Axe-core can check that an element *is* focusable, but not that focus is *visible*.
- **Unreachable elements** — An interactive element has correct ARIA but the Tab order skips it entirely due to DOM order or `tabindex` conflicts.
- **Modal focus failures** — A dialog opens but focus stays behind it. A screen reader user has no idea the dialog appeared.
- **Post-interaction violations** — Submitting an empty form reveals validation UI that itself has accessibility issues (missing `aria-invalid`, no error message association).

These are the issues that typically require manual QA — someone tabbing through pages, opening modals, submitting forms. Layer 2 automates that manual testing.

### Zero test authoring

Even teams that already run `@axe-core/playwright` in their test suite need to write a test file per route, handle browser setup/teardown, manage auth and navigation, and maintain those tests as routes change. a11y-sentinel replaces all of that with a YAML config and one command — you declare routes, not write tests.

---

## Getting started

Install dependencies and build:

```bash
git clone https://github.com/shankarsridhar/a11y-sentinel.git
cd a11y-sentinel
npm install
npm run build
```

Run your first audit against a page with known accessibility issues:

```bash
npx a11y-sentinel audit --url https://www.w3.org/WAI/demos/bad/before/home.html
```

You should see grouped findings in your terminal:

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
  ✖ 2.1.2 Keyboard trap — 1 instance (critical)
    a
  ...
```

Now generate all three report formats and export artifacts:

```bash
npx a11y-sentinel audit \
  --url https://www.w3.org/WAI/demos/bad/before/home.html \
  --format terminal,json,html
```

Check `./a11y-reports/` for:
- An HTML report with annotated screenshots and expandable fix suggestions
- A JSON report for programmatic use
- An `artifacts/` directory with clean screenshots, accessibility trees, and structural summaries

---

## How-to guides

### Audit multiple routes with a config file

Generate a starter config:

```bash
npx a11y-sentinel init
```

Edit `.a11y-sentinel.yml` with your routes:

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

Run the audit:

```bash
npx a11y-sentinel audit --config .a11y-sentinel.yml
```

### Run only a specific layer

Skip interaction testing (faster, axe-core only):

```bash
npx a11y-sentinel audit --url https://example.com --layer axe-core
```

Skip axe-core (interaction testing only):

```bash
npx a11y-sentinel audit --url https://example.com --layer interaction
```

### Set pass/fail thresholds

Add thresholds to your config. The CLI exits with code `1` when exceeded:

```yaml
thresholds:
  maxCritical: 0    # Fail if any critical findings
  maxMajor: 5       # Fail if more than 5 major findings
```

### Feed artifacts into Claude Code for deeper analysis

After an audit completes, the `artifacts/` directory contains clean screenshots, accessibility trees, and route summaries. Point Claude Code at them:

> Analyze the artifacts in `a11y-reports/artifacts/` for semantic WCAG issues. Start with each route's `summary.yaml` for structural problems (heading hierarchy gaps, missing landmarks). Then review the screenshots and accessibility trees for naming quality, reading order, and ARIA pattern correctness.

### Authenticate with a session cookie

```yaml
baseUrl: "https://your-app.com"
auth:
  type: cookie
  name: session
  value: "your-session-token"
routes:
  - path: "/dashboard"
    name: "Dashboard"
```

---

## Reference

### CLI commands

| Command | Description |
|---------|-------------|
| `a11y-sentinel init` | Create a starter `.a11y-sentinel.yml` config |
| `a11y-sentinel validate-config` | Validate a config file |
| `a11y-sentinel audit` | Run accessibility audit |

### Audit flags

| Flag | Description |
|------|-------------|
| `-u, --url <url>` | Single URL to audit |
| `-c, --config <path>` | Path to `.a11y-sentinel.yml` |
| `-f, --format <formats>` | Comma-separated: `terminal`, `json`, `html` |
| `-l, --layer <layer>` | `axe-core` or `interaction` |
| `-o, --output-dir <path>` | Output directory (default: `./a11y-reports`) |
| `--open` | Open HTML report in default browser |
| `-v, --verbose` | Debug logging |

### Config schema

```yaml
baseUrl: string               # Required. Base URL for all routes.
auth:                          # Optional. Static auth.
  type: cookie | header
  name: string
  value: string
routes:                        # Required. At least one.
  - path: string               # URL path appended to baseUrl
    name: string               # Human-readable label (used in reports)
    waitFor: domcontentloaded | load | networkidle   # Default: domcontentloaded
output:
  dir: string                  # Default: ./a11y-reports
  formats: [terminal, json, html]
  embedScreenshots: boolean    # Default: true
thresholds:
  maxCritical: number          # Exit code 1 if exceeded
  maxMajor: number             # Exit code 1 if exceeded
excludeRules: string[]         # axe-core rule IDs to skip
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Audit passed (thresholds met or no thresholds set) |
| `1` | Audit completed, thresholds exceeded |
| `2` | Fatal error (invalid config, browser launch failure, all routes unreachable) |

### Report formats

**Terminal** — Grouped findings sorted by severity. Shows WCAG criterion, description, instance count, and up to 3 example selectors per group. Prints PASS/FAIL verdict when thresholds are set.

**JSON** — Machine-readable `AuditReport` object containing both individual `findings[]` (for programmatic filtering) and `findingGroups[]` (pre-grouped for display), plus a `scorecard` with counts by severity, WCAG principle, route, and layer.

**HTML** — Self-contained single-file report with inline CSS. Includes scorecard cards, annotated screenshots (red outlines on violating elements), and findings with expandable fix suggestions. Responsive layout, accessible design.

### Artifact export structure

Every audit exports to `{output.dir}/artifacts/{route-name}/`:

```
artifacts/
  home-page/
    screenshot-initial.png            # Clean page capture
    screenshot-annotated.png          # Violations highlighted in red
    screenshot-after-tab-through.png  # State after keyboard traversal
    a11y-tree-initial.yaml            # Full accessibility tree (CDP)
    a11y-tree-after-tab-through.yaml  # Tree after interaction
    summary.yaml                      # Heading outline, landmarks, interactive element counts, tab order
```

### WCAG coverage

**Layer 1 (axe-core)** — All WCAG 2.0/2.1 AA rules in axe-core's rule set, run against a live Chromium page. Findings are `confidence: high`.

**Layer 2 (interaction testing)**:

| Check | WCAG criterion | Severity | Confidence |
|-------|----------------|----------|------------|
| Missing focus indicator | 2.4.7 Focus Visible | major | medium |
| Keyboard trap (element focused 3x consecutively) | 2.1.2 No Keyboard Trap | critical | medium |
| Unreachable interactive element | 2.1.1 Keyboard | critical | medium |
| Touch target < 24x24 CSS px | 2.5.8 Target Size Minimum | minor | high |
| Missing `aria-invalid` after form submit | 3.3.1 Error Identification | major | medium |
| Missing error message association | 3.3.1 Error Identification | major | medium |
| Missing `aria-required` on required field | 3.3.2 Labels or Instructions | minor | medium |
| Focus not moved into modal | 2.4.3 Focus Order | major | medium |
| Focus not trapped in modal | 2.1.2 No Keyboard Trap | critical | medium |
| Escape doesn't close modal | 2.1.2 No Keyboard Trap | major | medium |
| Focus not returned after modal close | 2.4.3 Focus Order | major | medium |
| `aria-live` / role mismatch | 4.1.3 Status Messages | minor | medium |
| Empty live region | 4.1.3 Status Messages | minor | medium |

### Project structure

```
a11y-sentinel/
├── src/
│   ├── cli/              # Commander.js entry + commands (audit, init, validate-config)
│   ├── config/           # Zod schema, YAML loader, default template
│   ├── core/             # Types, orchestrator, Playwright browser lifecycle
│   ├── layers/           # axe-scanner + interaction tests (keyboard, forms, modals, dynamic)
│   ├── reporting/        # Aggregator, scorecard, terminal/JSON/HTML reporters, artifact exporter
│   └── utils/            # Logger, screenshot capture, accessibility tree extraction
├── tests/
│   ├── unit/             # Config loader, aggregator, scorecard (18 tests)
│   └── integration/      # W3C BAD page audits, exit codes, artifact verification (6 tests)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## How it works

### Three-layer architecture

a11y-sentinel audits pages sequentially through up to three layers:

1. **axe-core scan** — Runs `AxeBuilder` with WCAG 2.0/2.1 AA tags against the live page. Each violation maps to a `Finding` with severity derived from axe's impact rating (critical/serious/moderate/minor).

2. **Interaction testing** — Tabs through the page recording focus order, then tests forms (empty submit, validation state), modals (focus movement, trapping, Escape, focus return), and dynamic content (live region semantics). After state changes, axe re-runs to catch issues only visible in altered DOM states.

3. **Artifact export** — Captures clean screenshots and full accessibility trees (via CDP `Accessibility.getFullAXTree`) at each state. Generates a `summary.yaml` per route with heading hierarchy, landmark inventory, interactive element counts, and tab order — giving AI analysis tools a structural overview before diving into the full tree.

### Finding deduplication and grouping

Findings are deduplicated by a SHA-256 hash of `(wcagCriterion, selector, route, sourceLayer)`. The `stateContext` field (e.g., "after modal open") is intentionally excluded — the same element with the same violation is one finding regardless of when it was discovered.

After dedup, findings are grouped by `(wcagCriterion, description, route)` into `FindingGroup` objects for display. Terminal and HTML reports render groups (e.g., "33 instances of missing alt text"). JSON reports include both individual findings and groups.

### Known limitations

| Limitation | Detail |
|------------|--------|
| Server-rendered pages only | No SPA support (hash routes, pushState) |
| Chromium only | No Firefox or WebKit |
| Single viewport (1280x720) | No responsive/mobile testing |
| Static auth only | Cookies/headers; no OAuth or login forms |
| Heuristic modal detection | Only `[aria-haspopup="dialog"]`, `<dialog>`, `[data-toggle="modal"]`, `button[aria-controls]` |
| Focus indicator check is visual-diff only | Cannot assess contrast ratio or minimum area |

---

## Development

```bash
npm run build             # Compile TypeScript
npm run dev               # Watch mode
npm test                  # Unit tests
npm run test:integration  # Integration tests (requires network access)
npm run lint              # ESLint
```

**Tech stack**: TypeScript (ES2022/NodeNext), Playwright, axe-core, Commander.js, Zod, Handlebars, chalk, ora, Vitest

---

## License

MIT
