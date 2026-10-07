import { useMemo } from 'react';
import { Rocket, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useStore } from '@/store/AppStore';

const STATUS_ICONS = {
  success: CheckCircle,
  failed: XCircle,
  'rolled-back': AlertCircle,
  'in-progress': Clock,
};

const STATUS_COLORS = {
  success: 'var(--success)',
  failed: 'var(--error)',
  'rolled-back': 'var(--warning)',
  'in-progress': 'var(--info)',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function DeploymentsView() {
  const { state, dispatch } = useStore();
  const sorted = useMemo(() => [...state.deployments].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [state.deployments]);

  const nodeMap = new Map(state.services.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Rocket size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 className="text-lg font-semibold text-primary">Deployment History</h2>
          <p className="text-sm text-muted">Recent deployments and their impact radius</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3">
          <p className="text-xs text-muted">Total Deployments</p>
          <p className="text-2xl font-bold text-primary font-mono">{state.deployments.length}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-muted">Successful</p>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--success)' }}>
            {state.deployments.filter((d) => d.status === 'success').length}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-muted">Rolled Back</p>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--warning)' }}>
            {state.deployments.filter((d) => d.status === 'rolled-back').length}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-muted">In Progress</p>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--info)' }}>
            {state.deployments.filter((d) => d.status === 'in-progress').length}
          </p>
        </div>
      </div>

      {/* Timeline list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
        {sorted.map((d) => {
          const Icon = STATUS_ICONS[d.status];
          const color = STATUS_COLORS[d.status];
          const service = nodeMap.get(d.nodeId);

          return (
            <div
              key={d.id}
              className="card p-4 flex items-start gap-4 cursor-pointer hover:bg-tertiary transition-all"
              onClick={() => dispatch({ type: 'SELECT_NODE', nodeId: d.nodeId })}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0" style={{ background: `${color}20` }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-primary">{service?.name ?? d.nodeId}</span>
                  <span className="text-sm font-mono text-accent">{d.version}</span>
                  <span className="badge badge-muted text-[10px]">{d.environment}</span>
                  <span className="badge text-[10px]" style={{ background: `${color}20`, color }}>{d.status}</span>
                </div>
                <p className="text-sm text-secondary mt-1">{d.changelog}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                  <span className="font-mono">{formatDate(d.timestamp)}</span>
                  {d.impactRadius.length > 1 && (
                    <span>Impact: {d.impactRadius.map((id) => nodeMap.get(id)?.name ?? id).join(', ')}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
