import type { ServiceNode, Dependency, ImpactResult, Criticality } from '@/types';
import { getDownstreamDependents, getUpstreamDependencies } from './graphEngine';

export type ChangeType = 'remove' | 'degrade' | 'upgrade' | 'config-change' | 'region-failover';

export function computeImpact(
  nodeId: string,
  changeType: ChangeType,
  services: ServiceNode[],
  deps: Dependency[],
): ImpactResult {
  const nodeMap = new Map(services.map((s) => [s.id, s]));
  const selected = nodeMap.get(nodeId);

  // Directly affected: services that have an edge TO the changed node
  const directDependents = deps.filter((d) => d.to === nodeId).map((d) => d.from);
  const directlyAffected = [...new Set(directDependents)];

  // Downstream affected: transitively everything that depends on this node
  const downstreamSet = getDownstreamDependents(nodeId, deps);
  const downstreamAffected = [...downstreamSet];

  // Upstream: what this node depends on (for rollback path)
  const upstreamSet = getUpstreamDependencies(nodeId, deps);

  // Customer-facing workflows: trace from frontend/gateway nodes to this node
  const frontends = services.filter((s) => s.tier === 'frontend' || s.kind === 'gateway');
  const customerWorkflows: string[] = [];
  for (const fe of frontends) {
    const feDownstream = getDownstreamDependents(fe.id, deps);
    if (feDownstream.has(nodeId) || fe.id === nodeId) {
      const endpoint = fe.exposedEndpoints[0] ?? '/';
      customerWorkflows.push(`${fe.name}: ${endpoint}`);
    }
  }

  // Failure zones: services that will likely fail if this node is removed/degraded
  const failureZones: string[] = [];
  for (const depId of directlyAffected) {
    const dep = nodeMap.get(depId);
    if (!dep) continue;
    const criticalEdge = deps.find((d) => d.from === depId && d.to === nodeId && d.criticality === 'critical');
    if (criticalEdge) {
      failureZones.push(`${dep.name} (critical dependency)`);
    } else {
      failureZones.push(`${dep.name} (non-critical)`);
    }
  }

  // Rollback path: upstream dependencies in reverse topological order
  const rollbackPath = [...upstreamSet].reverse();
  const rollbackNames = rollbackPath.map((id) => nodeMap.get(id)?.name ?? id).filter(Boolean);

  // Criticality score: based on fan-out, tier, SLO, redundancy
  let score = 0;
  score += downstreamAffected.length * 10;
  score += directlyAffected.length * 15;
  score += customerWorkflows.length * 20;
  if (selected) {
    if (selected.kind === 'database' || selected.kind === 'cache') score += 30;
    if (selected.kind === 'gateway') score += 25;
    if (selected.replicas <= 1) score += 25;
    if (selected.slo.availability >= 99.95) score += 15;
  }
  if (changeType === 'remove') score += 20;
  if (changeType === 'region-failover') score += 15;

  let criticality: Criticality = 'low';
  if (score >= 100) criticality = 'critical';
  else if (score >= 60) criticality = 'high';
  else if (score >= 30) criticality = 'medium';

  const affectedSubgraph = [...new Set([nodeId, ...directlyAffected, ...downstreamAffected])];

  return {
    selectedNode: nodeId,
    changeType,
    directlyAffected,
    downstreamAffected,
    customerWorkflows,
    failureZones,
    rollbackPath: rollbackNames,
    criticality,
    criticalityScore: score,
    affectedSubgraph,
  };
}

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  'remove': 'Remove Service',
  'degrade': 'Degrade Performance',
  'upgrade': 'Deploy New Version',
  'config-change': 'Configuration Change',
  'region-failover': 'Region Failover',
};
