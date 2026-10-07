import { useMemo, useState } from 'react';
import { Zap, Target, TrendingDown, ShieldAlert, Undo, Workflow } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import { ArchitectureGraph } from '@/components/ArchitectureGraph';
import { computeImpact, CHANGE_TYPE_LABELS, type ChangeType } from '@/engines/impactEngine';
import type { Criticality } from '@/types';

const CRITICALITY_BADGE: Record<Criticality, { label: string; class: string }> = {
  critical: { label: 'Critical', class: 'badge-error' },
  high: { label: 'High', class: 'badge-warning' },
  medium: { label: 'Medium', class: 'badge-info' },
  low: { label: 'Low', class: 'badge-muted' },
};

export function ChangeImpactView() {
  const { state, dispatch } = useStore();
  const [changeType, setChangeType] = useState<ChangeType>('remove');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const impact = useMemo(() => {
    if (!selectedNode) return null;
    return computeImpact(selectedNode, changeType, state.services, state.dependencies);
  }, [selectedNode, changeType, state.services, state.dependencies]);

  const highlightIds = useMemo(() => {
    if (!impact) return undefined;
    return new Set(impact.affectedSubgraph);
  }, [impact]);

  const nodeMap = new Map(state.services.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 className="text-lg font-semibold text-primary">Change Impact Analysis</h2>
          <p className="text-sm text-muted">What breaks if this changes?</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-muted" />
          <select
            className="input min-w-[200px]"
            value={selectedNode ?? ''}
            onChange={(e) => setSelectedNode(e.target.value || null)}
          >
            <option value="">Select a component...</option>
            {state.services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          {(Object.keys(CHANGE_TYPE_LABELS) as ChangeType[]).map((ct) => (
            <button
              key={ct}
              className={`btn !py-1.5 !text-xs ${changeType === ct ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setChangeType(ct)}
            >
              {CHANGE_TYPE_LABELS[ct]}
            </button>
          ))}
        </div>
      </div>

      {/* Graph + Impact report */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 min-w-0">
          <ArchitectureGraph
            services={state.services}
            dependencies={state.dependencies}
            selectedNodeId={selectedNode}
            onSelectNode={(id) => { setSelectedNode(id); dispatch({ type: 'SELECT_NODE', nodeId: id }); }}
            highlightNodeIds={highlightIds}
            dimNonHighlighted={!!highlightIds}
          />
        </div>

        <div className="w-[380px] shrink-0 overflow-y-auto scrollbar-thin">
          {!impact ? (
            <div className="card p-6 text-center">
              <Target size={32} className="mx-auto text-muted mb-3" />
              <p className="text-sm text-secondary">Select a component and change type to see the blast radius.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Criticality score */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">Criticality</span>
                  <span className={`badge ${CRITICALITY_BADGE[impact.criticality].class}`}>
                    {CRITICALITY_BADGE[impact.criticality].label}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary font-mono">{impact.criticalityScore}</span>
                  <span className="text-xs text-muted">impact score</span>
                </div>
                <div className="mt-2 h-2 bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, impact.criticalityScore)}%`,
                      background: impact.criticality === 'critical' ? 'var(--error)' : impact.criticality === 'high' ? 'var(--warning)' : 'var(--info)',
                    }}
                  />
                </div>
              </div>

              {/* Directly affected */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={15} className="text-error" style={{ color: 'var(--error)' }} />
                  <h3 className="text-sm font-semibold text-primary">Directly Affected ({impact.directlyAffected.length})</h3>
                </div>
                <div className="space-y-1">
                  {impact.directlyAffected.map((id) => {
                    const s = nodeMap.get(id);
                    return (
                      <div key={id} className="text-sm text-secondary bg-secondary rounded px-2.5 py-1.5">
                        {s?.name ?? id}
                      </div>
                    );
                  })}
                  {impact.directlyAffected.length === 0 && <p className="text-xs text-muted">None</p>}
                </div>
              </div>

              {/* Downstream affected */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={15} style={{ color: 'var(--warning)' }} />
                  <h3 className="text-sm font-semibold text-primary">Downstream Cascade ({impact.downstreamAffected.length})</h3>
                </div>
                <div className="space-y-1">
                  {impact.downstreamAffected.map((id) => {
                    const s = nodeMap.get(id);
                    return (
                      <div key={id} className="text-sm text-secondary bg-secondary rounded px-2.5 py-1.5">
                        {s?.name ?? id}
                      </div>
                    );
                  })}
                  {impact.downstreamAffected.length === 0 && <p className="text-xs text-muted">No cascade</p>}
                </div>
              </div>

              {/* Customer-facing workflows */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Workflow size={15} style={{ color: 'var(--info)' }} />
                  <h3 className="text-sm font-semibold text-primary">Customer-Facing Workflows ({impact.customerWorkflows.length})</h3>
                </div>
                <div className="space-y-1">
                  {impact.customerWorkflows.map((w, i) => (
                    <div key={i} className="text-sm text-secondary bg-secondary rounded px-2.5 py-1.5 font-mono text-xs">
                      {w}
                    </div>
                  ))}
                  {impact.customerWorkflows.length === 0 && <p className="text-xs text-muted">No direct customer impact</p>}
                </div>
              </div>

              {/* Failure zones */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-primary mb-2">Likely Failure Zones</h3>
                <div className="space-y-1">
                  {impact.failureZones.map((z, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-secondary bg-secondary rounded px-2.5 py-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--error)' }} />
                      {z}
                    </div>
                  ))}
                  {impact.failureZones.length === 0 && <p className="text-xs text-muted">None identified</p>}
                </div>
              </div>

              {/* Rollback path */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Undo size={15} style={{ color: 'var(--accent)' }} />
                  <h3 className="text-sm font-semibold text-primary">Rollback Path</h3>
                </div>
                {impact.rollbackPath.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    {impact.rollbackPath.map((name, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="badge badge-accent text-xs">{name}</span>
                        {i < impact.rollbackPath.length - 1 && <span className="text-muted">→</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">No upstream dependencies — safe to roll back directly.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
