import { useState, useMemo } from 'react';
import { RotateCcw, Clock, AlertTriangle, CheckCircle, Activity, Users } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import { ArchitectureGraph } from '@/components/ArchitectureGraph';
import type { Incident, IncidentEvent } from '@/types';

const SEVERITY_BADGE = {
  sev1: { label: 'SEV1', class: 'badge-error' },
  sev2: { label: 'SEV2', class: 'badge-warning' },
  sev3: { label: 'SEV3', class: 'badge-info' },
};

const EVENT_ICONS: Record<IncidentEvent['type'], typeof AlertTriangle> = {
  detection: AlertTriangle,
  degradation: AlertTriangle,
  recovery: CheckCircle,
  deploy: RotateCcw,
  mitigation: Activity,
  communication: Users,
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function IncidentReplayView() {
  const { state, dispatch } = useStore();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(state.incidents[0]?.id ?? null);
  const [timelineStep, setTimelineStep] = useState(0);

  const incident: Incident | null = useMemo(() => {
    return state.incidents.find((i) => i.id === selectedIncidentId) ?? null;
  }, [selectedIncidentId, state.incidents]);

  const highlightIds = useMemo(() => {
    if (!incident) return undefined;
    if (timelineStep === 0) return new Set(incident.affectedNodes);
    // Show nodes affected up to the current timeline step
    const affected = new Set<string>();
    for (let i = 0; i <= timelineStep && i < incident.timeline.length; i++) {
      const ev = incident.timeline[i];
      if (ev.nodeId) affected.add(ev.nodeId);
    }
    return affected;
  }, [incident, timelineStep]);

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <RotateCcw size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 className="text-lg font-semibold text-primary">Incident Replay</h2>
          <p className="text-sm text-muted">Review past incidents with timeline reconstruction</p>
        </div>
      </div>

      {/* Incident selector */}
      <div className="flex flex-wrap gap-2">
        {state.incidents.map((inc) => (
          <button
            key={inc.id}
            className={`btn !py-1.5 !text-xs ${selectedIncidentId === inc.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setSelectedIncidentId(inc.id); setTimelineStep(0); }}
          >
            <span className={`badge text-[10px] ${SEVERITY_BADGE[inc.severity].class}`}>{SEVERITY_BADGE[inc.severity].label}</span>
            <span className="ml-1">{inc.title.length > 40 ? inc.title.slice(0, 38) + '…' : inc.title}</span>
          </button>
        ))}
      </div>

      {incident && (
        <>
          {/* Incident summary */}
          <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted">Duration</p>
              <p className="text-sm font-semibold text-primary font-mono flex items-center gap-1.5">
                <Clock size={14} /> {incident.durationMin}min
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Severity</p>
              <span className={`badge ${SEVERITY_BADGE[incident.severity].class}`}>{SEVERITY_BADGE[incident.severity].label}</span>
            </div>
            <div>
              <p className="text-xs text-muted">Affected Services</p>
              <p className="text-sm font-semibold text-primary">{incident.affectedNodes.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Status</p>
              <span className={`badge ${incident.resolved ? 'badge-success' : 'badge-error'}`}>
                {incident.resolved ? 'Resolved' : 'Active'}
              </span>
            </div>
          </div>

          {/* Root cause + customer impact */}
          <div className="card p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Root Cause</h4>
                <p className="text-sm text-secondary leading-relaxed">{incident.rootCause}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Customer Impact</h4>
                <p className="text-sm text-secondary leading-relaxed">{incident.customerImpact}</p>
              </div>
            </div>
          </div>

          {/* Graph + Timeline */}
          <div className="flex-1 flex gap-4 min-h-0">
            <div className="flex-1 min-w-0">
              <ArchitectureGraph
                services={state.services}
                dependencies={state.dependencies}
                selectedNodeId={state.selectedNodeId}
                onSelectNode={(id) => dispatch({ type: 'SELECT_NODE', nodeId: id })}
                highlightNodeIds={highlightIds}
                dimNonHighlighted
              />
            </div>

            <div className="w-[380px] shrink-0 card flex flex-col overflow-hidden">
              <div className="p-3 border-b border-subtle flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Timeline</h3>
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min={0}
                    max={incident.timeline.length - 1}
                    value={timelineStep}
                    onChange={(e) => setTimelineStep(Number(e.target.value))}
                    className="w-24 accent-teal-500"
                  />
                  <span className="text-xs text-muted font-mono">{timelineStep + 1}/{incident.timeline.length}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-tertiary" />

                  {incident.timeline.map((ev, i) => {
                    const Icon = EVENT_ICONS[ev.type];
                    const isPast = i <= timelineStep;
                    const isCurrent = i === timelineStep;
                    const color = ev.type === 'recovery' ? 'var(--success)' :
                      ev.type === 'degradation' ? 'var(--error)' :
                      ev.type === 'detection' ? 'var(--warning)' :
                      ev.type === 'mitigation' ? 'var(--info)' :
                      ev.type === 'deploy' ? 'var(--accent)' : 'var(--text-muted)';

                    return (
                      <div
                        key={ev.id}
                        className={`relative pl-10 pb-4 transition-all ${isPast ? 'opacity-100' : 'opacity-40'} ${isCurrent ? 'scale-[1.02]' : ''}`}
                        onClick={() => setTimelineStep(i)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div
                          className="absolute left-[10px] top-1 w-3 h-3 rounded-full border-2 transition-all"
                          style={{
                            background: isPast ? color : 'var(--bg-secondary)',
                            borderColor: color,
                            boxShadow: isCurrent ? `0 0 0 3px ${color}33` : 'none',
                          }}
                        />
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-muted">{formatTime(ev.timestamp)}</span>
                          <Icon size={12} style={{ color }} />
                          {ev.nodeId && (
                            <span className="text-xs text-secondary">
                              {state.services.find((s) => s.id === ev.nodeId)?.name ?? ev.nodeId}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-primary font-medium">{ev.event}</p>
                        <p className="text-xs text-secondary mt-0.5">{ev.impact}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
