import { HeartPulse, TrendingUp, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import type { HealthStatus } from '@/types';

const HEALTH_BADGE: Record<HealthStatus, { label: string; class: string; color: string }> = {
  healthy: { label: 'Healthy', class: 'badge-success', color: 'var(--success)' },
  degraded: { label: 'Degraded', class: 'badge-warning', color: 'var(--warning)' },
  unhealthy: { label: 'Unhealthy', class: 'badge-error', color: 'var(--error)' },
  unknown: { label: 'Unknown', class: 'badge-muted', color: 'var(--text-muted)' },
};

function SLOBar({ value, label }: { value: number; label: string }) {
  const color = value < 30 ? 'var(--error)' : value < 60 ? 'var(--warning)' : 'var(--success)';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs font-mono text-primary">{value}%</span>
      </div>
      <div className="h-1.5 bg-tertiary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export function ServiceHealthView() {
  const { state, dispatch } = useStore();
  const metricMap = new Map(state.metrics.map((m) => [m.nodeId, m]));

  const sorted = [...state.services].sort((a, b) => {
    const healthOrder = { unhealthy: 0, degraded: 1, healthy: 2, unknown: 3 };
    return healthOrder[a.health] - healthOrder[b.health];
  });

  const avgAvailability = state.services.reduce((sum, s) => sum + s.slo.availability, 0) / state.services.length;
  const avgErrorBudget = state.services.reduce((sum, s) => sum + s.errorBudgetRemaining, 0) / state.services.length;

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HeartPulse size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 className="text-lg font-semibold text-primary">Service Health</h2>
          <p className="text-sm text-muted">SLO attainment, error budgets, and runtime metrics</p>
        </div>
      </div>

      {/* System-level SLOs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3">
          <p className="text-xs text-muted">System Availability Target</p>
          <p className="text-2xl font-bold text-primary font-mono">{avgAvailability.toFixed(2)}%</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-muted">Avg Error Budget Remaining</p>
          <p className="text-2xl font-bold font-mono" style={{ color: avgErrorBudget < 50 ? 'var(--warning)' : 'var(--success)' }}>
            {avgErrorBudget.toFixed(0)}%
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-muted">Services Tracked</p>
          <p className="text-2xl font-bold text-primary font-mono">{state.services.length}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-muted">Active Alerts</p>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--warning)' }}>
            {state.services.filter((s) => s.health === 'degraded').length}
          </p>
        </div>
      </div>

      {/* Service grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map((s) => {
            const m = metricMap.get(s.id);
            const hb = HEALTH_BADGE[s.health];
            return (
              <div
                key={s.id}
                className="card p-4 cursor-pointer hover:bg-tertiary transition-all"
                onClick={() => { dispatch({ type: 'SET_VIEW', view: 'architecture' }); dispatch({ type: 'SELECT_NODE', nodeId: s.id }); }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: hb.color }}>
                      {s.health !== 'healthy' && (
                        <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
                      )}
                    </span>
                    <span className="text-sm font-semibold text-primary">{s.name}</span>
                  </div>
                  <span className={`badge ${hb.class} text-[10px]`}>{hb.label}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <p className="text-[10px] text-muted uppercase">P99 Lat</p>
                    <p className="text-xs font-mono text-primary">{m?.latencyMs ?? s.slo.latencyMs}ms</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase">Error Rate</p>
                    <p className="text-xs font-mono" style={{ color: (m?.errorRate ?? 0) > 0.01 ? 'var(--error)' : 'var(--text-primary)' }}>
                      {((m?.errorRate ?? 0) * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase">RPS</p>
                    <p className="text-xs font-mono text-primary">{m?.rps ?? '—'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <SLOBar value={s.errorBudgetRemaining} label="Error Budget" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">SLO: {s.slo.availability}% · {s.slo.latencyMs}ms</span>
                    <span className="text-muted">{s.replicas}/{s.scaleTarget} replicas</span>
                  </div>
                </div>

                {s.health !== 'healthy' && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--warning)' }}>
                    <AlertTriangle size={12} />
                    <span>Requires attention</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
