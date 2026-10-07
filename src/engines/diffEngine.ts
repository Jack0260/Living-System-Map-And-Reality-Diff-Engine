import type { ServiceNode, Dependency, DiffFinding, DiffCategory, Criticality } from '@/types';

export function computeDiff(services: ServiceNode[], deps: Dependency[]): DiffFinding[] {
  const findings: DiffFinding[] = [];
  const nodeMap = new Map(services.map((s) => [s.id, s]));
  let findingIdx = 0;

  const undocEdges = deps.filter((d) => d.observed && !d.declared);
  for (const e of undocEdges) {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (!from || !to) continue;
    const severity: Criticality = e.criticality === 'critical' ? 'critical' : e.criticality === 'high' ? 'high' : 'medium';
    findings.push({
      id: `diff-${findingIdx++}`,
      category: 'undocumented-dependency',
      severity,
      edgeId: e.id,
      nodeId: e.from,
      title: `Undocumented dependency: ${from.name} → ${to.name}`,
      description: `${from.name} calls ${to.name} (${e.label}) at runtime, but this dependency is not in the documented architecture. ${e.rps} req/s, ${e.avgLatencyMs}ms avg latency.`,
      recommendation: `Document this dependency in the architecture diagram and update the runbook for ${from.name}.`,
    });
  }

  const unusedEdges = deps.filter((d) => d.declared && !d.observed);
  for (const e of unusedEdges) {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (!from || !to) continue;
    findings.push({
      id: `diff-${findingIdx++}`,
      category: 'unused-component',
      severity: 'low',
      edgeId: e.id,
      nodeId: e.to,
      title: `Declared but unobserved: ${from.name} → ${to.name}`,
      description: `The architecture docs list a dependency from ${from.name} to ${to.name}, but no runtime traces show traffic on this path.`,
      recommendation: `Verify whether this path is still needed or can be removed from the documentation.`,
    });
  }

  // Single point of failure: nodes with no redundancy (replicas <= 1) that are critical
  const criticalSPOF = services.filter((s) => s.replicas <= 1 && (s.kind === 'database' || s.kind === 'cache' || s.kind === 'queue'));
  for (const s of criticalSPOF) {
    const incoming = deps.filter((d) => d.to === s.id);
    const dependents = incoming.length;
    if (dependents === 0) continue;
    findings.push({
      id: `diff-${findingIdx++}`,
      category: 'single-point-of-failure',
      severity: s.kind === 'database' ? 'critical' : 'high',
      nodeId: s.id,
      title: `Single point of failure: ${s.name}`,
      description: `${s.name} has ${s.replicas} replica(s) but ${dependents} service(s) depend on it. No redundancy means a single failure cascades.`,
      recommendation: `Add read replicas or a failover instance. Consider multi-AZ deployment for ${s.name}.`,
    });
  }

  // Missing redundancy: services with replicas < scaleTarget/2
  const missingRedundancy = services.filter((s) => s.replicas > 0 && s.replicas < s.scaleTarget / 2 && s.scaleTarget > 4);
  for (const s of missingRedundancy) {
    findings.push({
      id: `diff-${findingIdx++}`,
      category: 'missing-redundancy',
      severity: 'medium',
      nodeId: s.id,
      title: `Missing redundancy: ${s.name}`,
      description: `${s.name} runs ${s.replicas} replicas but its scale target is ${s.scaleTarget}. Under load it may not have enough capacity to handle traffic.`,
      recommendation: `Increase replicas or configure aggressive autoscaling to reach the target of ${s.scaleTarget}.`,
    });
  }

  // Risky coupling: a service with many critical dependencies to the same downstream
  const depCounts = new Map<string, number>();
  for (const d of deps) {
    if (d.criticality === 'critical') {
      depCounts.set(d.to, (depCounts.get(d.to) ?? 0) + 1);
    }
  }
  for (const [nodeId, count] of depCounts) {
    if (count >= 3) {
      const s = nodeMap.get(nodeId);
      if (!s) continue;
      findings.push({
        id: `diff-${findingIdx++}`,
        category: 'risky-coupling',
        severity: 'high',
        nodeId,
        title: `Risky coupling: ${count} critical dependencies on ${s.name}`,
        description: `${count} services have critical-tier dependencies on ${s.name}. A degradation here cascades widely.`,
        recommendation: `Introduce circuit breakers, bulkheads, and graceful degradation in all callers of ${s.name}.`,
      });
    }
  }

  // Unexpected dependency: services with undocumented critical edges to external systems
  const unexpectedExternal = deps.filter((d) => {
    const to = nodeMap.get(d.to);
    return d.observed && !d.declared && to?.kind === 'external' && d.criticality === 'critical';
  });
  for (const e of unexpectedExternal) {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (!from || !to) continue;
    findings.push({
      id: `diff-${findingIdx++}`,
      category: 'unexpected-dependency',
      severity: 'critical',
      edgeId: e.id,
      nodeId: e.from,
      title: `Unexpected external dependency: ${from.name} → ${to.name}`,
      description: `${from.name} has an undocumented critical dependency on external system ${to.name}. Outages in ${to.name} will directly impact ${from.name}.`,
      recommendation: `Add an explicit fallback/degradation strategy. Document the dependency and create a vendor SLA monitoring alert.`,
    });
  }

  return findings.sort((a, b) => {
    const sevOrder: Record<Criticality, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}

export const DIFF_CATEGORY_LABELS: Record<DiffCategory, string> = {
  'undocumented-dependency': 'Undocumented Dependency',
  'unexpected-dependency': 'Unexpected Dependency',
  'unused-component': 'Unused Component',
  'risky-coupling': 'Risky Coupling',
  'missing-redundancy': 'Missing Redundancy',
  'single-point-of-failure': 'Single Point of Failure',
};

export const DIFF_SEVERITY_COLORS: Record<Criticality, string> = {
  critical: '#f43f5e',
  high: '#f59e0b',
  medium: '#eab308',
  low: '#84cc16',
};
