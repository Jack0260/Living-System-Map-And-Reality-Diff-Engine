// ─── Core System Model Types ───────────────────────────────────────

export type NodeKind = 'service' | 'database' | 'queue' | 'cache' | 'external' | 'gateway' | 'storage';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export type Tier = 'frontend' | 'api' | 'service' | 'data' | 'infra';

export type Region = 'us-east-1' | 'us-west-2' | 'eu-west-1' | 'ap-southeast-1';

export interface ServiceNode {
  id: string;
  name: string;
  kind: NodeKind;
  tier: Tier;
  region: Region;
  owner: string;
  runtime: string;
  health: HealthStatus;
  description: string;
  tags: string[];
  slo: {
    availability: number;       // e.g. 99.9
    latencyMs: number;          // target p99 latency
    rpoMin: number;            // recovery point objective
    rtoMin: number;            // recovery time objective
  };
  errorBudgetRemaining: number; // 0-100
  config: Record<string, string>;
  metadata: Record<string, string>;
  exposedEndpoints: string[];
  replicas: number;
  scaleTarget: number;
}

export type DependencyType =
  | 'sync-http'
  | 'async-event'
  | 'db-read'
  | 'db-write'
  | 'cache-read'
  | 'cache-write'
  | 'queue-produce'
  | 'queue-consume';

export type Criticality = 'critical' | 'high' | 'medium' | 'low';

export interface Dependency {
  id: string;
  from: string;              // source node id
  to: string;                // target node id
  type: DependencyType;
  criticality: Criticality;
  declared: boolean;         // present in documented architecture
  observed: boolean;         // present in observed runtime traces
  label: string;
  avgLatencyMs: number;
  errorRate: number;         // 0-1
  rps: number;               // requests per second
}

// ─── Incident / Event Timeline ──────────────────────────────────────

export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3';

export interface IncidentEvent {
  id: string;
  timestamp: string;         // ISO
  nodeId?: string;
  event: string;
  type: 'detection' | 'degradation' | 'recovery' | 'deploy' | 'mitigation' | 'communication';
  impact: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  startTime: string;         // ISO
  endTime: string;           // ISO
  durationMin: number;
  rootCause: string;
  affectedNodes: string[];
  timeline: IncidentEvent[];
  customerImpact: string;
  resolved: boolean;
}

// ─── Deployment History ─────────────────────────────────────────────

export interface Deployment {
  id: string;
  nodeId: string;
  version: string;
  timestamp: string;         // ISO
  environment: 'production' | 'staging' | 'canary';
  changelog: string;
  status: 'success' | 'failed' | 'rolled-back' | 'in-progress';
  impactRadius: string[];
}

// ─── Runtime Metrics ────────────────────────────────────────────────

export interface RuntimeMetric {
  nodeId: string;
  timestamp: string;
  latencyMs: number;
  errorRate: number;
  rps: number;
  cpuPct: number;
  memPct: number;
}

// ─── What-If Simulation ─────────────────────────────────────────────

export type ScenarioPreset =
  | 'redis-down'
  | 'payment-degraded'
  | 'region-outage'
  | 'traffic-5x'
  | 'traffic-100x'
  | 'db-primary-fail'
  | 'custom';

export interface ScenarioConfig {
  preset: ScenarioPreset;
  targetNodeIds: string[];
  durationMin: number;
  severity: 'partial' | 'major' | 'total';
  description: string;
}

export interface SimStep {
  minute: number;
  nodeStates: Record<string, {
    health: HealthStatus;
    latencyMs: number;
    errorRate: number;
    queueDepth: number;
    rps: number;
    affected: boolean;
  }>;
  customerImpactPct: number;
  events: string[];
}

// ─── Diff Findings ──────────────────────────────────────────────────

export type DiffCategory =
  | 'undocumented-dependency'
  | 'unexpected-dependency'
  | 'unused-component'
  | 'risky-coupling'
  | 'missing-redundancy'
  | 'single-point-of-failure';

export interface DiffFinding {
  id: string;
  category: DiffCategory;
  severity: Criticality;
  nodeId?: string;
  edgeId?: string;
  title: string;
  description: string;
  recommendation: string;
}

// ─── Impact Analysis ────────────────────────────────────────────────

export interface ImpactResult {
  selectedNode: string;
  changeType: 'remove' | 'degrade' | 'upgrade' | 'config-change' | 'region-failover';
  directlyAffected: string[];
  downstreamAffected: string[];
  customerWorkflows: string[];
  failureZones: string[];
  rollbackPath: string[];
  criticality: Criticality;
  criticalityScore: number;
  affectedSubgraph: string[];
}

// ─── ADR / Senior Mode ──────────────────────────────────────────────

export interface ADR {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;
  decision: string;
  consequences: string;
  alternatives: string;
  date: string;
}

export interface ThreatSurface {
  nodeId: string;
  attackSurface: string;
  risk: Criticality;
  mitigation: string;
}

// ─── App Theme ──────────────────────────────────────────────────────

export type Theme = 'dark' | 'light';

// ─── View Routing ───────────────────────────────────────────────────

export type ViewId =
  | 'architecture'
  | 'reality-diff'
  | 'change-impact'
  | 'what-if'
  | 'incident-replay'
  | 'deployments'
  | 'service-health'
  | 'senior'
  | 'export';
