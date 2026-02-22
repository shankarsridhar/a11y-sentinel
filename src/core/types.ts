export type Severity = 'critical' | 'major' | 'minor';
export type Confidence = 'high' | 'medium' | 'low';
export type SourceLayer = 'axe-core' | 'interaction';
export type WcagPrinciple = 'perceivable' | 'operable' | 'understandable' | 'robust';

export interface RouteConfig {
  path: string;
  name: string;
  waitFor?: 'domcontentloaded' | 'load' | 'networkidle';
}

export interface Finding {
  id: string;
  wcagCriterion: string;
  severity: Severity;
  confidence: Confidence;
  sourceLayer: SourceLayer;
  route: string;
  selector: string;
  accessibleName: string;
  description: string;
  impact: string;
  fixSuggestion: string;
  screenshotRef: string | null;
  stateContext: string | null;
}

export interface FindingGroup {
  wcagCriterion: string;
  description: string;
  severity: Severity;
  route: string;
  count: number;
  exampleSelectors: string[];
  fixSuggestion: string;
}

export interface Scorecard {
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byPrinciple: Record<WcagPrinciple, number>;
  byRoute: Record<string, number>;
  byLayer: Record<SourceLayer, number>;
  passRate: number;
}

export interface RouteSummary {
  headings: { level: number; text: string }[];
  landmarks: { role: string }[];
  interactiveElements: Record<string, number>;
  tabOrder: string[];
}

export interface AuditReport {
  metadata: {
    toolVersion: string;
    auditDate: string;
    baseUrl: string;
    routesAudited: string[];
    layersRun: SourceLayer[];
  };
  scorecard: Scorecard;
  findings: Finding[];
  findingGroups: FindingGroup[];
  artifacts: {
    route: string;
    screenshotPath: string;
    a11yTreePath: string;
    summaryPath: string;
  }[];
}

export interface SentinelConfig {
  baseUrl: string;
  auth?: { type: 'cookie' | 'header'; name: string; value: string };
  routes: RouteConfig[];
  thresholds?: { maxCritical: number; maxMajor: number };
  output?: {
    dir: string;
    formats: ('json' | 'html' | 'terminal')[];
    embedScreenshots: boolean;
  };
  excludeRules?: string[];
}
