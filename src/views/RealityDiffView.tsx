import { useMemo, useState } from 'react';
import { GitCompare, ArrowRight, AlertTriangle, CircleDot, Unlink, Network, ShieldAlert, Boxes } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import { ArchitectureGraph } from '@/components/ArchitectureGraph';
import { computeDiff, DIFF_CATEGORY_LABELS, DIFF_SEVERITY_COLORS } from '@/engines/diffEngine';
import type { DiffCategory } from '@/types';

const CATEGORY_ICONS: Record<DiffCategory, typeof AlertTriangle> = {
  'undocumented-dependency': Unlink,
  'unexpected-dependency': AlertTriangle,
  'unused-component': CircleDot,
  'risky-coupling': Network,
  'missing-redundancy': Boxes,
  'single-point-of-failure': ShieldAlert,
};

export function RealityDiffView() {
  const { state, dispatch } = useStore();
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  const findings = useMemo(() => computeDiff(state.services, state.dependencies), [state.services, state.dependencies]);

  const highlightIds = useMemo(() => {
    if (!selectedFindingId) return undefined;
    const finding = findings.find((f) => f.id === selectedFindingId);
    if (!finding) return undefined;
    const ids = new Set<string>();
    if (finding.nodeId) ids.add(finding.nodeId);
    if (finding.edgeId) {
      const edge = state.dependencies.find((d) => d.id === finding.edgeId);
      if (edge) { ids.add(edge.from); ids.add(edge.to); }
    }
    return ids;
  }, [selectedFindingId, findings, state.dependencies]);

  // Documented path example
  const documentedPath = ['web-frontend', 'api-gateway', 'payment-service', 'postgres-primary'];
  const observedPath = ['web-frontend', 'api-gateway', 'redis-cache', 'event-queue', 'payment-service', 'fraud-service', 'postgres-primary'];
  const nodeMap = new Map(state.services.map((s) => [s.id, s]));

  const categoryCounts = useMemo(() => {
    const counts = new Map<DiffCategory, number>();
    for (const f of findings) {
      counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
    }
    return counts;
  }, [findings]);

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitCompare size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 className="text-lg font-semibold text-primary">Reality Diff</h2>
          <p className="text-sm text-muted">Declared architecture vs observed runtime behavior</p>
        </div>
      </div>

      {/* Path comparison */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Checkout Flow: Documented vs Observed</h3>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-muted mb-1.5 block">DOCUMENTED</span>
            <div className="flex items-center gap-2 flex-wrap">
              {documentedPath.map((id, i) => {
                const s = nodeMap.get(id);
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className="badge badge-info">{s?.name ?? id}</span>
                    {i < documentedPath.length - 1 && <ArrowRight size={14} className="text-muted" />}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted mb-1.5 block">OBSERVED</span>
            <div className="flex items-center gap-2 flex-wrap">
              {observedPath.map((id, i) => {
                const s = nodeMap.get(id);
                const isUndoc = !documentedPath.includes(id);
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className={`badge ${isUndoc ? 'badge-warning' : 'badge-info'}`}>
                      {s?.name ?? id}
                      {isUndoc && <span className="ml-1 text-[9px]">undocumented</span>}
                    </span>
                    {i < observedPath.length - 1 && <ArrowRight size={14} className="text-muted" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Category summary */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(DIFF_CATEGORY_LABELS) as DiffCategory[]).map((cat) => {
          const count = categoryCounts.get(cat) ?? 0;
          if (count === 0) return null;
          const Icon = CATEGORY_ICONS[cat];
          return (
            <div key={cat} className="card px-3 py-2 flex items-center gap-2">
              <Icon size={14} className="text-secondary" />
              <span className="text-xs text-secondary">{DIFF_CATEGORY_LABELS[cat]}</span>
              <span className="badge badge-muted">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Graph + findings list */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 min-w-0">
          <ArchitectureGraph
            services={state.services}
            dependencies={state.dependencies}
            selectedNodeId={state.selectedNodeId}
            onSelectNode={(id) => dispatch({ type: 'SELECT_NODE', nodeId: id })}
            highlightNodeIds={highlightIds}
            dimNonHighlighted={!!highlightIds}
            showUndocumentedOnly={false}
          />
        </div>

        <div className="w-[380px] shrink-0 card flex flex-col overflow-hidden">
          <div className="p-3 border-b border-subtle">
            <h3 className="text-sm font-semibold text-primary">Findings ({findings.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
            {findings.map((f) => {
              const Icon = CATEGORY_ICONS[f.category];
              const isSelected = selectedFindingId === f.id;
              return (
                <div
                  key={f.id}
                  className={`rounded-lg border p-3 cursor-pointer transition-all ${
                    isSelected ? 'border-accent bg-tertiary' : 'border-subtle bg-secondary'
                  }`}
                  style={isSelected ? { borderColor: 'var(--accent)' } : undefined}
                  onClick={() => setSelectedFindingId(isSelected ? null : f.id)}
                >
                  <div className="flex items-start gap-2">
                    <Icon size={16} className="mt-0.5 shrink-0" style={{ color: DIFF_SEVERITY_COLORS[f.severity] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono" style={{ color: DIFF_SEVERITY_COLORS[f.severity] }}>{f.severity}</span>
                        <span className="text-xs text-muted">{DIFF_CATEGORY_LABELS[f.category]}</span>
                      </div>
                      <p className="text-sm font-medium text-primary">{f.title}</p>
                      <p className="text-xs text-secondary mt-1 leading-relaxed">{f.description}</p>
                      <div className="mt-2 pt-2 border-t border-subtle">
                        <p className="text-xs text-muted">
                          <span className="font-semibold">Fix: </span>{f.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {findings.length === 0 && (
              <div className="text-center py-8 text-muted text-sm">No discrepancies found. Architecture matches reality.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
