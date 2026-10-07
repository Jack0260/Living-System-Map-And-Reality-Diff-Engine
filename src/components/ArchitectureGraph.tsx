import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import {
  Server, Database, HardDrive, Cloud, Cpu, MessageSquare, Globe, Boxes,
} from 'lucide-react';
import type { ServiceNode, Dependency, HealthStatus, NodeKind } from '@/types';
import { buildGraph, forceLayout, nodeRadius, type GraphData } from '@/engines/graphEngine';

const KIND_ICON: Record<NodeKind, typeof Server> = {
  service: Server,
  database: Database,
  cache: Cpu,
  queue: MessageSquare,
  external: Globe,
  gateway: Boxes,
  storage: HardDrive,
  frontend: Globe,
};

const HEALTH_COLORS: Record<HealthStatus, { fill: string; stroke: string }> = {
  healthy: { fill: 'var(--success)', stroke: 'var(--success)' },
  degraded: { fill: 'var(--warning)', stroke: 'var(--warning)' },
  unhealthy: { fill: 'var(--error)', stroke: 'var(--error)' },
  unknown: { fill: 'var(--text-muted)', stroke: 'var(--text-muted)' },
};

const DEP_COLOR: Record<string, string> = {
  critical: 'var(--error)',
  high: 'var(--warning)',
  medium: 'var(--info)',
  low: 'var(--text-muted)',
};

interface GraphProps {
  services: ServiceNode[];
  dependencies: Dependency[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  highlightNodeIds?: Set<string>;
  dimNonHighlighted?: boolean;
  showUndocumentedOnly?: boolean;
  width?: number;
  height?: number;
  animateHealth?: Record<string, HealthStatus>;
}

export function ArchitectureGraph({
  services,
  dependencies,
  selectedNodeId,
  onSelectNode,
  highlightNodeIds,
  dimNonHighlighted = false,
  showUndocumentedOnly = false,
  width = 1000,
  height = 640,
  animateHealth,
}: GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const graphData: GraphData = useMemo(() => {
    const g = buildGraph(services, dependencies);
    return forceLayout(g, 80, width, height);
  }, [services, dependencies, width, height]);

  useEffect(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    for (const n of graphData.nodes) {
      pos[n.id] = { x: n.x, y: n.y };
    }
    setPositions(pos);
  }, [graphData]);

  const getNodePos = useCallback((id: string) => {
    if (positions[id]) return positions[id];
    const n = graphData.nodes.find((n) => n.id === id);
    return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
  }, [positions, graphData]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newScale = Math.max(0.3, Math.min(3, transform.scale + delta));
    setTransform((prev) => ({ ...prev, scale: newScale }));
  }, [transform.scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).tagName === 'rect') {
      setPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    }
  }, [transform.x, transform.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTransform((prev) => ({ ...prev, x: panStart.current.tx + dx, y: panStart.current.ty + dy }));
    } else if (draggingId) {
      const svg = svgRef.current;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const local = pt.matrixTransform(ctm.inverse());
      const x = (local.x - transform.x) / transform.scale - dragOffset.current.x;
      const y = (local.y - transform.y) / transform.scale - dragOffset.current.y;
      setPositions((prev) => ({ ...prev, [draggingId]: { x, y } }));
    }
  }, [panning, draggingId, transform.x, transform.y, transform.scale]);

  const handleMouseUp = useCallback(() => {
    setPanning(false);
    setDraggingId(null);
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const pos = getNodePos(nodeId);
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const x = (local.x - transform.x) / transform.scale;
    const y = (local.y - transform.y) / transform.scale;
    dragOffset.current = { x: x - pos.x, y: y - pos.y };
    setDraggingId(nodeId);
  }, [getNodePos, transform.x, transform.y, transform.scale]);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomIn = () => setTransform((p) => ({ ...p, scale: Math.min(3, p.scale + 0.2) }));
  const zoomOut = () => setTransform((p) => ({ ...p, scale: Math.max(0.3, p.scale - 0.2) }));

  const nodeMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const visibleEdges = useMemo(() => {
    if (!showUndocumentedOnly) return dependencies;
    return dependencies.filter((d) => d.observed && !d.declared);
  }, [dependencies, showUndocumentedOnly]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-subtle bg-secondary">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: panning ? 'grabbing' : 'default' }}
        className="select-none"
      >
        <defs>
          <marker id="arrow-critical" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 Z" fill="var(--error)" />
          </marker>
          <marker id="arrow-high" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 Z" fill="var(--warning)" />
          </marker>
          <marker id="arrow-medium" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 Z" fill="var(--info)" />
          </marker>
          <marker id="arrow-low" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 Z" fill="var(--text-muted)" />
          </marker>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={width} height={height} fill="transparent" />

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {visibleEdges.map((edge) => {
            const from = getNodePos(edge.from);
            const to = getNodePos(edge.to);
            if (!from || !to) return null;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1) return null;
            const fromR = nodeRadius(nodeMap.get(edge.from)?.kind ?? 'service') + 4;
            const toR = nodeRadius(nodeMap.get(edge.to)?.kind ?? 'service') + 6;
            const x1 = from.x + (dx / dist) * fromR;
            const y1 = from.y + (dy / dist) * fromR;
            const x2 = to.x - (dx / dist) * toR;
            const y2 = to.y - (dy / dist) * toR;

            const isHighlighted = highlightNodeIds?.has(edge.from) && highlightNodeIds?.has(edge.to);
            const isDimmed = dimNonHighlighted && !isHighlighted;
            const isUndoc = edge.observed && !edge.declared;
            const color = DEP_COLOR[edge.criticality] ?? 'var(--text-muted)';
            const markerId = `arrow-${edge.criticality}`;

            return (
              <g key={edge.id} opacity={isDimmed ? 0.12 : 1}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={color}
                  strokeWidth={isUndoc ? 2 : 1.5}
                  strokeDasharray={isUndoc ? '6,3' : 'none'}
                  markerEnd={`url(#${markerId})`}
                  opacity={isHighlighted ? 1 : 0.5}
                />
                {isUndoc && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    fill="var(--warning)"
                    fontSize="9"
                    textAnchor="middle"
                    className="font-mono"
                  >
                    undocumented
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {graphData.nodes.map((gn) => {
            const pos = getNodePos(gn.id);
            const r = nodeRadius(gn.kind);
            const isSelected = selectedNodeId === gn.id;
            const isHighlighted = highlightNodeIds?.has(gn.id);
            const isDimmed = dimNonHighlighted && !isHighlighted;
            const health = animateHealth?.[gn.id] ?? gn.health;
            const colors = HEALTH_COLORS[health];
            const Icon = KIND_ICON[gn.kind];

            return (
              <g
                key={gn.id}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: 'pointer', opacity: isDimmed ? 0.2 : 1 }}
                onMouseDown={(e) => handleNodeMouseDown(e, gn.id)}
                onClick={(e) => { e.stopPropagation(); onSelectNode(gn.id); }}
              >
                {/* Selection ring */}
                {isSelected && (
                  <circle r={r + 6} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4,2" filter="url(#glow)" />
                )}
                {isHighlighted && !isSelected && (
                  <circle r={r + 4} fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.6" />
                )}

                {/* Background circle */}
                <circle
                  r={r}
                  fill="var(--bg-elevated)"
                  stroke={colors.stroke}
                  strokeWidth={health === 'unhealthy' ? 3 : 2}
                  opacity={isDimmed ? 0.3 : 1}
                />

                {/* Health dot */}
                <circle cx={r * 0.65} cy={-r * 0.65} r={5} fill={colors.fill} opacity={isDimmed ? 0.3 : 1}>
                  {health !== 'healthy' && (
                    <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                  )}
                </circle>

                {/* Icon */}
                <g transform={`translate(${-10},${-10})`} opacity={isDimmed ? 0.3 : 0.85}>
                  <foreignObject width="20" height="20">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px' }}>
                      <Icon size={16} color="var(--text-primary)" />
                    </div>
                  </foreignObject>
                </g>

                {/* Label */}
                <text
                  y={r + 14}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="11"
                  fontWeight="500"
                  opacity={isDimmed ? 0.3 : 1}
                >
                  {gn.label.length > 22 ? gn.label.slice(0, 20) + '…' : gn.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button className="btn btn-outline !p-1.5 !rounded-md" onClick={zoomIn} title="Zoom in">+</button>
        <button className="btn btn-outline !p-1.5 !rounded-md" onClick={zoomOut} title="Zoom out">−</button>
        <button className="btn btn-outline !p-1.5 !rounded-md text-xs" onClick={resetView} title="Reset view">⤢</button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 card px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-2 text-secondary">
          <span className="w-3 h-0.5" style={{ background: 'var(--error)' }} /> Critical
          <span className="w-3 h-0.5 ml-2" style={{ background: 'var(--warning)' }} /> High
          <span className="w-3 h-0.5 ml-2" style={{ background: 'var(--info)' }} /> Medium
        </div>
        <div className="flex items-center gap-2 text-secondary">
          <span className="w-3 h-0.5 border-t border-dashed" style={{ borderColor: 'var(--warning)' }} /> Undocumented
        </div>
      </div>
    </div>
  );
}
