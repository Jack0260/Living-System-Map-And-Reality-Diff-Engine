import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Theme, ViewId, ServiceNode, Dependency, Incident, Deployment, RuntimeMetric } from '@/types';
import { seedServices, seedDependencies, seedIncidents, seedDeployments, seedMetrics } from '@/data/seed';
import { supabase } from '@/lib/supabase';

export interface AppState {
  theme: Theme;
  view: ViewId;
  services: ServiceNode[];
  dependencies: Dependency[];
  incidents: Incident[];
  deployments: Deployment[];
  metrics: RuntimeMetric[];
  selectedNodeId: string | null;
  seniorMode: boolean;
  loading: boolean;
  dataSource: 'supabase' | 'local';
}

type Action =
  | { type: 'SET_THEME'; theme: Theme }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_VIEW'; view: ViewId }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'TOGGLE_SENIOR' }
  | { type: 'UPDATE_SERVICE'; service: ServiceNode }
  | { type: 'ADD_DEPENDENCY'; dep: Dependency }
  | { type: 'REMOVE_DEPENDENCY'; depId: string }
  | { type: 'RESET' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'LOAD_FROM_SUPABASE'; data: { services: ServiceNode[]; dependencies: Dependency[]; incidents: Incident[]; deployments: Deployment[]; metrics: RuntimeMetric[] } };

const STORAGE_KEY = 'systemxray-state-v1';

function loadPersisted(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AppState>;
  } catch {
    return null;
  }
}

function persist(state: AppState) {
  try {
    const toSave = {
      theme: state.theme,
      seniorMode: state.seniorMode,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

function initialState(): AppState {
  const persisted = loadPersisted();
  const prefersDark = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches;

  return {
    theme: persisted?.theme ?? (prefersDark ? 'dark' : 'dark'),
    view: 'architecture',
    services: seedServices,
    dependencies: seedDependencies,
    incidents: seedIncidents,
    deployments: seedDeployments,
    metrics: seedMetrics,
    selectedNodeId: null,
    seniorMode: persisted?.seniorMode ?? false,
    loading: true,
    dataSource: 'local',
  };
}

function mapServiceRow(row: Record<string, unknown>): ServiceNode {
  const slo = row.slo as ServiceNode['slo'];
  return {
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as ServiceNode['kind'],
    tier: row.tier as ServiceNode['tier'],
    region: row.region as ServiceNode['region'],
    owner: row.owner as string,
    runtime: row.runtime as string,
    health: row.health as ServiceNode['health'],
    description: row.description as string,
    tags: (row.tags as string[]) ?? [],
    slo: { availability: slo.availability, latencyMs: slo.latencyMs, rpoMin: slo.rpoMin, rtoMin: slo.rtoMin },
    errorBudgetRemaining: Number(row.error_budget_remaining ?? 100),
    config: (row.config as Record<string, string>) ?? {},
    metadata: (row.metadata as Record<string, string>) ?? {},
    exposedEndpoints: (row.exposed_endpoints as string[]) ?? [],
    replicas: Number(row.replicas ?? 1),
    scaleTarget: Number(row.scale_target ?? 1),
  };
}

function mapDependencyRow(row: Record<string, unknown>): Dependency {
  return {
    id: row.id as string,
    from: row.from_id as string,
    to: row.to_id as string,
    type: row.type as Dependency['type'],
    criticality: row.criticality as Dependency['criticality'],
    declared: Boolean(row.declared),
    observed: Boolean(row.observed),
    label: row.label as string,
    avgLatencyMs: Number(row.avg_latency_ms ?? 0),
    errorRate: Number(row.error_rate ?? 0),
    rps: Number(row.rps ?? 0),
  };
}

function mapIncidentRow(row: Record<string, unknown>): Incident {
  return {
    id: row.id as string,
    title: row.title as string,
    severity: row.severity as Incident['severity'],
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    durationMin: Number(row.duration_min),
    rootCause: row.root_cause as string,
    affectedNodes: (row.affected_nodes as string[]) ?? [],
    timeline: (row.timeline as Incident['timeline']) ?? [],
    customerImpact: row.customer_impact as string,
    resolved: Boolean(row.resolved),
  };
}

function mapDeploymentRow(row: Record<string, unknown>): Deployment {
  return {
    id: row.id as string,
    nodeId: row.node_id as string,
    version: row.version as string,
    timestamp: row.timestamp as string,
    environment: row.environment as Deployment['environment'],
    changelog: row.changelog as string,
    status: row.status as Deployment['status'],
    impactRadius: (row.impact_radius as string[]) ?? [],
  };
}

function mapMetricRow(row: Record<string, unknown>): RuntimeMetric {
  return {
    nodeId: row.node_id as string,
    timestamp: row.timestamp as string,
    latencyMs: Number(row.latency_ms),
    errorRate: Number(row.error_rate),
    rps: Number(row.rps),
    cpuPct: Number(row.cpu_pct),
    memPct: Number(row.mem_pct),
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };
    case 'SET_VIEW':
      return { ...state, view: action.view, selectedNodeId: null };
    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.nodeId };
    case 'TOGGLE_SENIOR':
      return { ...state, seniorMode: !state.seniorMode };
    case 'UPDATE_SERVICE':
      return {
        ...state,
        services: state.services.map((s) => (s.id === action.service.id ? action.service : s)),
      };
    case 'ADD_DEPENDENCY':
      return { ...state, dependencies: [...state.dependencies, action.dep] };
    case 'REMOVE_DEPENDENCY':
      return { ...state, dependencies: state.dependencies.filter((d) => d.id !== action.depId) };
    case 'RESET':
      return {
        ...state,
        services: seedServices,
        dependencies: seedDependencies,
        selectedNodeId: null,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'LOAD_FROM_SUPABASE':
      return {
        ...state,
        services: action.data.services,
        dependencies: action.data.dependencies,
        incidents: action.data.incidents,
        deployments: action.data.deployments,
        metrics: action.data.metrics,
        loading: false,
        dataSource: 'supabase',
      };
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    persist(state);
  }, [state.theme, state.seniorMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [svcRes, depRes, incRes, deploysRes, metricsRes] = await Promise.all([
          supabase.from('services').select('*'),
          supabase.from('dependencies').select('*'),
          supabase.from('incidents').select('*'),
          supabase.from('deployments').select('*'),
          supabase.from('runtime_metrics').select('*'),
        ]);

        if (cancelled) return;

        if (svcRes.error || depRes.error || incRes.error || deploysRes.error || metricsRes.error) {
          console.warn('Supabase load failed, falling back to local seed data');
          dispatch({ type: 'SET_LOADING', loading: false });
          return;
        }

        const services = (svcRes.data as Record<string, unknown>[]).map(mapServiceRow);
        const dependencies = (depRes.data as Record<string, unknown>[]).map(mapDependencyRow);
        const incidents = (incRes.data as Record<string, unknown>[]).map(mapIncidentRow);
        const deployments = (deploysRes.data as Record<string, unknown>[]).map(mapDeploymentRow);
        const allMetrics = (metricsRes.data as Record<string, unknown>[]).map(mapMetricRow);

        const latestMetrics = new Map<string, RuntimeMetric>();
        for (const m of allMetrics) {
          const existing = latestMetrics.get(m.nodeId);
          if (!existing || new Date(m.timestamp) > new Date(existing.timestamp)) {
            latestMetrics.set(m.nodeId, m);
          }
        }
        const metrics = [...latestMetrics.values()];

        if (services.length === 0) {
          dispatch({ type: 'SET_LOADING', loading: false });
          return;
        }

        dispatch({
          type: 'LOAD_FROM_SUPABASE',
          data: { services, dependencies, incidents, deployments, metrics },
        });
      } catch {
        if (!cancelled) {
          dispatch({ type: 'SET_LOADING', loading: false });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
