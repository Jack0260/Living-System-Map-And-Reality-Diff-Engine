import type { ServiceNode, Dependency, ScenarioConfig, SimStep, HealthStatus } from '@/types';
import { getDownstreamDependents } from './graphEngine';

interface NodeSimState {
  health: HealthStatus;
  latencyMs: number;
  errorRate: number;
  queueDepth: number;
  rps: number;
  affected: boolean;
}

function initialNodeStates(services: ServiceNode[], metrics: { nodeId: string; latencyMs: number; errorRate: number; rps: number }[]): Map<string, NodeSimState> {
  const states = new Map<string, NodeSimState>();
  for (const s of services) {
    const m = metrics.find((m) => m.nodeId === s.id);
    states.set(s.id, {
      health: s.health,
      latencyMs: m?.latencyMs ?? 80,
      errorRate: m?.errorRate ?? 0.002,
      queueDepth: 0,
      rps: m?.rps ?? 500,
      affected: false,
    });
  }
  return states;
}

function degradeHealth(health: HealthStatus): HealthStatus {
  if (health === 'healthy') return 'degraded';
  if (health === 'degraded') return 'unhealthy';
  return 'unhealthy';
}

function recoveryHealth(health: HealthStatus): HealthStatus {
  if (health === 'unhealthy') return 'degraded';
  if (health === 'degraded') return 'healthy';
  return 'healthy';
}

export function runSimulation(
  services: ServiceNode[],
  deps: Dependency[],
  metrics: { nodeId: string; latencyMs: number; errorRate: number; rps: number }[],
  config: ScenarioConfig,
): SimStep[] {
  const steps: SimStep[] = [];
  const nodeMap = new Map(services.map((s) => [s.id, s]));
  const states = initialNodeStates(services, metrics);

  const totalMin = config.durationMin;
  const downStart = 1;
  const downEnd = Math.max(2, Math.floor(totalMin * 0.6));

  for (let minute = 0; minute <= totalMin; minute++) {
    const events: string[] = [];

    if (minute === downStart) {
      for (const targetId of config.targetNodeIds) {
        const s = states.get(targetId);
        if (!s) continue;
        const sevFactor = config.severity === 'total' ? 1 : config.severity === 'major' ? 0.6 : 0.3;
        s.health = config.severity === 'total' ? 'unhealthy' : 'degraded';
        s.errorRate = Math.min(0.9, s.errorRate + 0.3 * sevFactor);
        s.latencyMs = Math.round(s.latencyMs * (1 + 4 * sevFactor));
        s.affected = true;
        const svc = nodeMap.get(targetId);
        events.push(`${svc?.name ?? targetId} ${config.severity} failure — health: ${s.health}, error rate: ${(s.errorRate * 100).toFixed(1)}%`);
      }
    }

    // Cascade degradation to downstream dependents
    if (minute >= downStart && minute <= downEnd) {
      for (const targetId of config.targetNodeIds) {
        const cascade = getDownstreamDependents(targetId, deps);
        for (const depId of cascade) {
          const s = states.get(depId);
          if (!s || !s.affected) {
            const newState = states.get(depId);
            if (!newState) continue;
            const edge = deps.find((d) => d.from === depId && d.to === targetId);
            if (edge && minute >= downStart + 1) {
              const targetState = states.get(targetId);
              if (targetState && targetState.errorRate > 0.05) {
                if (!newState.affected) {
                  newState.affected = true;
                  newState.health = degradeHealth(newState.health);
                  newState.errorRate = Math.min(0.5, newState.errorRate + 0.05);
                  newState.latencyMs = Math.round(newState.latencyMs * 1.5);
                  const svc = nodeMap.get(depId);
                  events.push(`${svc?.name ?? depId} degrading — cascading from target`);
                }
              }
            }
          }
        }

        // Queue buildup for queue nodes
        for (const d of deps) {
          if (d.type === 'queue-produce' && d.to === targetId) {
            const qState = states.get(d.to);
            if (qState && qState.affected) {
              qState.queueDepth += Math.round(qState.rps * 0.6);
            }
          }
        }
      }
    }

    // Recovery phase
    if (minute === downEnd) {
      for (const targetId of config.targetNodeIds) {
        const s = states.get(targetId);
        if (s) {
          s.health = recoveryHealth(s.health);
          s.errorRate = Math.max(0.002, s.errorRate * 0.3);
          s.latencyMs = Math.round(s.latencyMs * 0.4);
          s.affected = false;
          const svc = nodeMap.get(targetId);
          events.push(`${svc?.name ?? targetId} recovering — health improving`);
        }
      }
    }

    if (minute > downEnd) {
      for (const s of states.values()) {
        if (s.affected) {
          s.health = recoveryHealth(s.health);
          s.errorRate = Math.max(0.002, s.errorRate * 0.5);
          s.latencyMs = Math.round(s.latencyMs * 0.7);
          s.queueDepth = Math.round(s.queueDepth * 0.5);
          if (s.health === 'healthy' && s.errorRate < 0.005) {
            s.affected = false;
            s.errorRate = 0.002;
          }
        }
      }
      // Clear queues gradually
      for (const s of states.values()) {
        if (s.queueDepth > 0) {
          s.queueDepth = Math.max(0, s.queueDepth - Math.round(s.rps * 0.8));
        }
      }
    }

    // Customer impact: % of requests affected
    let totalRps = 0;
    let affectedRps = 0;
    for (const s of states.values()) {
      totalRps += s.rps;
      if (s.affected || s.errorRate > 0.02) {
        affectedRps += s.rps * Math.min(1, s.errorRate * 2);
      }
    }
    const customerImpactPct = totalRps > 0 ? (affectedRps / totalRps) * 100 : 0;

    const nodeStates: Record<string, NodeSimState> = {};
    for (const [id, s] of states) {
      nodeStates[id] = { ...s };
    }

    steps.push({
      minute,
      nodeStates,
      customerImpactPct: Math.round(customerImpactPct * 10) / 10,
      events,
    });
  }

  return steps;
}

export const SCENARIO_PRESETS: { preset: ScenarioConfig['preset']; label: string; description: string }[] = [
  { preset: 'redis-down', label: 'Redis Unavailable (10 min)', description: 'Redis cache cluster goes down for 10 minutes. Simulates cache misses, cart data loss, and service degradation.' },
  { preset: 'payment-degraded', label: 'Payment Service Degraded', description: 'Payment service experiences 5x latency increase. Simulates checkout failures and order queue buildup.' },
  { preset: 'region-outage', label: 'Primary Region Outage', description: 'Entire us-east-1 region goes down. Simulates multi-service failure and failover requirements.' },
  { preset: 'traffic-5x', label: '5x Traffic Surge', description: 'Black Friday level traffic. Simulates capacity strain, latency increase, and autoscaling response.' },
  { preset: 'traffic-100x', label: '100x Traffic Surge', description: 'Viral event traffic. Simulates extreme capacity failure across all tiers.' },
  { preset: 'db-primary-fail', label: 'Database Primary Failure', description: 'PostgreSQL primary fails. Simulates failover to replica, write outage, and cascading service errors.' },
];

export function presetToConfig(preset: ScenarioConfig['preset'], services: ServiceNode[]): ScenarioConfig {
  const findId = (name: string) => services.find((s) => s.id === name)?.id ?? '';

  switch (preset) {
    case 'redis-down':
      return { preset, targetNodeIds: [findId('redis-cache')], durationMin: 10, severity: 'total', description: 'Redis cache cluster unavailable for 10 minutes.' };
    case 'payment-degraded':
      return { preset, targetNodeIds: [findId('payment-service')], durationMin: 15, severity: 'major', description: 'Payment service experiencing major degradation.' };
    case 'region-outage':
      return { preset, targetNodeIds: services.filter((s) => s.region === 'us-east-1').map((s) => s.id), durationMin: 20, severity: 'total', description: 'Complete region outage affecting all us-east-1 services.' };
    case 'traffic-5x':
      return { preset, targetNodeIds: [findId('api-gateway')], durationMin: 15, severity: 'partial', description: '5x normal traffic volume hitting the API gateway.' };
    case 'traffic-100x':
      return { preset, targetNodeIds: [findId('api-gateway')], durationMin: 20, severity: 'total', description: '100x normal traffic — extreme viral load.' };
    case 'db-primary-fail':
      return { preset, targetNodeIds: [findId('postgres-primary')], durationMin: 12, severity: 'total', description: 'PostgreSQL primary node failure.' };
    default:
      return { preset: 'custom', targetNodeIds: [], durationMin: 10, severity: 'partial', description: 'Custom scenario.' };
  }
}
