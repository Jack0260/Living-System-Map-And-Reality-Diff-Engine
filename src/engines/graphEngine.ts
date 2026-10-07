import type { ServiceNode, Dependency, NodeKind } from '@/types';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: NodeKind;
  health: ServiceNode['health'];
  label: string;
  service: ServiceNode;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  declared: boolean;
  observed: boolean;
  criticality: Dependency['criticality'];
  type: Dependency['type'];
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const KIND_RADIUS: Record<NodeKind, number> = {
  service: 28,
  database: 26,
  cache: 24,
  queue: 24,
  external: 26,
  gateway: 28,
  storage: 24,
  frontend: 30,
};

const LAYER_Y: Record<string, number> = {
  frontend: 80,
  gateway: 200,
  api: 200,
  service: 380,
  data: 560,
  infra: 560,
};

const LAYER_ORDER = ['frontend', 'api', 'service', 'data', 'infra'];

function layerForTier(tier: string): string {
  if (tier === 'frontend') return 'frontend';
  if (tier === 'api') return 'gateway';
  if (tier === 'service') return 'service';
  if (tier === 'data') return 'data';
  return 'infra';
}

export function buildGraph(services: ServiceNode[], deps: Dependency[]): GraphData {
  const width = 1000;
  const layerGroups = new Map<string, ServiceNode[]>();

  for (const s of services) {
    const layer = layerForTier(s.tier);
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(s);
  }

  const nodes: GraphNode[] = [];
  const presentLayers = LAYER_ORDER.filter((l) => layerGroups.has(l));

  for (const layer of presentLayers) {
    const group = layerGroups.get(layer)!;
    const y = LAYER_Y[layer] ?? 400;
    const spacing = width / (group.length + 1);
    group.forEach((s, i) => {
      nodes.push({
        id: s.id,
        x: spacing * (i + 1),
        y,
        vx: 0,
        vy: 0,
        kind: s.kind,
        health: s.health,
        label: s.name,
        service: s,
      });
    });
  }

  const edges: GraphEdge[] = deps.map((d) => ({
    id: d.id,
    from: d.from,
    to: d.to,
    declared: d.declared,
    observed: d.observed,
    criticality: d.criticality,
    type: d.type,
    label: d.label,
  }));

  return { nodes, edges };
}

export function forceLayout(data: GraphData, iterations: number, width: number, height: number): GraphData {
  const nodes = data.nodes.map((n) => ({ ...n }));
  const edges = data.edges;
  const k = 0.8;
  const repulsion = 12000;

  for (let iter = 0; iter < iterations; iter++) {
    const temperature = 1 - iter / iterations;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx += fx * temperature;
        nodes[i].vy += fy * temperature;
        nodes[j].vx -= fx * temperature;
        nodes[j].vy -= fy * temperature;
      }
    }

    // Attraction (springs) along edges
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) dist = 1;
      const idealDist = 160;
      const force = k * (dist - idealDist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx * temperature;
      a.vy += fy * temperature;
      b.vx -= fx * temperature;
      b.vy -= fy * temperature;
    }

    // Apply velocity with damping, keep in bounds
    for (const n of nodes) {
      n.x += Math.max(-15, Math.min(15, n.vx)) * temperature;
      n.y += Math.max(-15, Math.min(15, n.vy)) * temperature;
      n.vx *= 0.85;
      n.vy *= 0.85;
      const r = KIND_RADIUS[n.kind] + 10;
      n.x = Math.max(r, Math.min(width - r, n.x));
      n.y = Math.max(r, Math.min(height - r, n.y));
    }
  }

  return { nodes, edges };
}

export function nodeRadius(kind: NodeKind): number {
  return KIND_RADIUS[kind] ?? 26;
}

// Get neighbors (incoming + outgoing) for a node
export function getNeighbors(nodeId: string, edges: GraphEdge[]): { incoming: string[]; outgoing: string[]; all: Set<string> } {
  const incoming: string[] = [];
  const outgoing: string[] = [];
  for (const e of edges) {
    if (e.from === nodeId) outgoing.push(e.to);
    if (e.to === nodeId) incoming.push(e.from);
  }
  const all = new Set([...incoming, ...outgoing]);
  return { incoming, outgoing, all };
}

// Get all downstream dependents (things that depend on this node, transitively)
export function getDownstreamDependents(nodeId: string, edges: GraphEdge[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.to === cur && !result.has(e.from)) {
        result.add(e.from);
        queue.push(e.from);
      }
    }
  }
  return result;
}

// Get all upstream dependencies (things this node depends on, transitively)
export function getUpstreamDependencies(nodeId: string, edges: GraphEdge[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.from === cur && !result.has(e.to)) {
        result.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return result;
}
