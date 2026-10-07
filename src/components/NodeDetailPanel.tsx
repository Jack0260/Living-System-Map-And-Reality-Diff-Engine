import { Server, Database, Cpu, MessageSquare, Globe, Boxes, HardDrive } from 'lucide-react';
import type { ServiceNode, Dependency, NodeKind } from '@/types';
import { useStore } from '@/store/AppStore';

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

const HEALTH_BADGE: Record<string, { label: string; class: string }> = {
  healthy: { label: 'Healthy', class: 'badge-success' },
  degraded: { label: 'Degraded', class: 'badge-warning' },
  unhealthy: { label: 'Unhealthy', class: 'badge-error' },
  unknown: { label: 'Unknown', class: 'badge-muted' },
};

interface Props {
  node: ServiceNode;
  dependencies: Dependency[];
  onClose: () => void;
}

export function NodeDetailPanel({ node, dependencies, onClose }: Props) {
  const { state } = useStore();
  const Icon = KIND_ICON[node.kind];
  const healthBadge = HEALTH_BADGE[node.health];

  const outgoing = dependencies.filter((d) => d.from === node.id);
  const incoming = dependencies.filter((d) => d.to === node.id);

  const nodeMap = new Map(state.services.map((s) => [s.id, s]));

  const recentDeploys = state.deployments.filter((d) => d.nodeId === node.id).slice(0, 3);
  const recentIncidents = state.incidents.filter((i) => i.affectedNodes.includes(node.id)).slice(0, 3);

  return (
    <div className="card animate-slide-in h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-subtle">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-tertiary">
            <Icon size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-primary">{node.name}</h3>
            <p className="text-xs text-muted">{node.runtime} · {node.region}</p>
          </div>
        </div>
        <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close detail panel">
          <span className="text-lg">×</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* Status row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${healthBadge.class}`}>{healthBadge.label}</span>
          <span className="badge badge-muted">{node.kind}</span>
          <span className="badge badge-muted">{node.tier}</span>
          <span className="badge badge-accent">{node.owner}</span>
        </div>

        {/* Description */}
        <p className="text-sm text-secondary leading-relaxed">{node.description}</p>

        {/* SLO */}
        <div>
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">SLO Targets</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary rounded-lg p-2.5">
              <p className="text-xs text-muted">Availability</p>
              <p className="text-sm font-semibold text-primary font-mono">{node.slo.availability}%</p>
            </div>
            <div className="bg-secondary rounded-lg p-2.5">
              <p className="text-xs text-muted">P99 Latency</p>
              <p className="text-sm font-semibold text-primary font-mono">{node.slo.latencyMs}ms</p>
            </div>
            <div className="bg-secondary rounded-lg p-2.5">
              <p className="text-xs text-muted">RPO</p>
              <p className="text-sm font-semibold text-primary font-mono">{node.slo.rpoMin}min</p>
            </div>
            <div className="bg-secondary rounded-lg p-2.5">
              <p className="text-xs text-muted">RTO</p>
              <p className="text-sm font-semibold text-primary font-mono">{node.slo.rtoMin}min</p>
            </div>
          </div>
        </div>

        {/* Error budget */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Error Budget</h4>
            <span className="text-xs font-mono text-primary">{node.errorBudgetRemaining}%</span>
          </div>
          <div className="h-2 bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${node.errorBudgetRemaining}%`,
                background: node.errorBudgetRemaining < 30 ? 'var(--error)' : node.errorBudgetRemaining < 60 ? 'var(--warning)' : 'var(--success)',
              }}
            />
          </div>
        </div>

        {/* Replicas */}
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="text-xs text-muted">Replicas</p>
            <p className="font-semibold text-primary font-mono">{node.replicas}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Scale Target</p>
            <p className="font-semibold text-primary font-mono">{node.scaleTarget}</p>
          </div>
        </div>

        {/* Outgoing dependencies */}
        {outgoing.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Depends On ({outgoing.length})</h4>
            <div className="space-y-1.5">
              {outgoing.map((d) => {
                const target = nodeMap.get(d.to);
                if (!target) return null;
                const isUndoc = d.observed && !d.declared;
                return (
                  <div key={d.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-primary">{target.name}</span>
                      {isUndoc && <span className="badge badge-warning text-[10px]">undocumented</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted font-mono">{d.label}</span>
                      <span className={`badge text-[10px] ${
                        d.criticality === 'critical' ? 'badge-error' :
                        d.criticality === 'high' ? 'badge-warning' :
                        d.criticality === 'medium' ? 'badge-info' : 'badge-muted'
                      }`}>{d.criticality}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Incoming dependencies */}
        {incoming.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Depended On By ({incoming.length})</h4>
            <div className="space-y-1.5">
              {incoming.map((d) => {
                const source = nodeMap.get(d.from);
                if (!source) return null;
                return (
                  <div key={d.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
                    <span className="text-sm text-primary">{source.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted font-mono">{d.rps} rps</span>
                      <span className="text-xs text-muted font-mono">{d.avgLatencyMs}ms</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Exposed endpoints */}
        {node.exposedEndpoints.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Exposed Endpoints</h4>
            <div className="flex flex-wrap gap-1.5">
              {node.exposedEndpoints.map((ep) => (
                <code key={ep} className="text-xs bg-secondary rounded px-2 py-1 text-accent font-mono">{ep}</code>
              ))}
            </div>
          </div>
        )}

        {/* Config */}
        <div>
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Configuration</h4>
          <div className="bg-secondary rounded-lg p-3 space-y-1">
            {Object.entries(node.config).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-muted">{k}</span>
                <span className="text-primary font-mono">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        {node.tags.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1.5">
              {node.tags.map((t) => (
                <span key={t} className="badge badge-muted">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Recent deployments */}
        {recentDeploys.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Recent Deployments</h4>
            <div className="space-y-1.5">
              {recentDeploys.map((d) => (
                <div key={d.id} className="bg-secondary rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary font-mono">{d.version}</span>
                    <span className={`badge text-[10px] ${
                      d.status === 'success' ? 'badge-success' :
                      d.status === 'rolled-back' ? 'badge-error' :
                      d.status === 'in-progress' ? 'badge-warning' : 'badge-muted'
                    }`}>{d.status}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{d.changelog}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent incidents */}
        {recentIncidents.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Recent Incidents</h4>
            <div className="space-y-1.5">
              {recentIncidents.map((i) => (
                <div key={i.id} className="bg-secondary rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary">{i.title}</span>
                    <span className={`badge text-[10px] ${
                      i.severity === 'sev1' ? 'badge-error' :
                      i.severity === 'sev2' ? 'badge-warning' : 'badge-info'
                    }`}>{i.severity}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{i.durationMin}min · {i.customerImpact.slice(0, 60)}…</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
