import { useState, useMemo, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, FlaskConical, Clock, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import { ArchitectureGraph } from '@/components/ArchitectureGraph';
import { runSimulation, presetToConfig, SCENARIO_PRESETS } from '@/engines/simulationEngine';
import type { ScenarioConfig, HealthStatus, SimStep } from '@/types';

function MiniChart({ data, label, color, max }: { data: number[]; label: string; color: string; max: number }) {
  const width = 320;
  const height = 80;
  if (data.length === 0) return null;
  const stepW = width / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * stepW},${height - (v / max) * height}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs font-mono text-primary">{data[data.length - 1]?.toFixed(1) ?? '0'}</span>
      </div>
      <svg width={width} height={height} className="w-full">
        <polygon points={areaPoints} fill={color} opacity="0.15" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function WhatIfSimulatorView() {
  const { state } = useStore();
  const [preset, setPreset] = useState<ScenarioConfig['preset']>('redis-down');
  const [config, setConfig] = useState<ScenarioConfig>(() => presetToConfig('redis-down', state.services));
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const steps = useMemo(() => {
    return runSimulation(state.services, state.dependencies, state.metrics, config);
  }, [state.services, state.dependencies, state.metrics, config]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, steps.length]);

  const handlePresetChange = (newPreset: ScenarioConfig['preset']) => {
    setPreset(newPreset);
    const newConfig = presetToConfig(newPreset, state.services);
    setConfig(newConfig);
    setCurrentStep(0);
    setPlaying(false);
  };

  const step: SimStep | undefined = steps[currentStep];

  const animateHealth = useMemo(() => {
    if (!step) return undefined;
    const result: Record<string, HealthStatus> = {};
    for (const [id, ns] of Object.entries(step.nodeStates)) {
      result[id] = ns.health;
    }
    return result;
  }, [step]);

  const highlightIds = useMemo(() => {
    if (!step) return undefined;
    return new Set(Object.entries(step.nodeStates).filter(([, ns]) => ns.affected).map(([id]) => id));
  }, [step]);

  const latencyData = steps.map((s) => {
    let total = 0, count = 0;
    for (const ns of Object.values(s.nodeStates)) { total += ns.latencyMs; count++; }
    return count > 0 ? total / count : 0;
  });
  const errorData = steps.map((s) => {
    let total = 0, count = 0;
    for (const ns of Object.values(s.nodeStates)) { total += ns.errorRate; count++; }
    return count > 0 ? (total / count) * 100 : 0;
  });
  const queueData = steps.map((s) => {
    let total = 0;
    for (const ns of Object.values(s.nodeStates)) { total += ns.queueDepth; }
    return total;
  });
  const impactData = steps.map((s) => s.customerImpactPct);

  const maxLatency = Math.max(...latencyData, 100);
  const maxError = Math.max(...errorData, 1);
  const maxQueue = Math.max(...queueData, 100);
  const maxImpact = Math.max(...impactData, 1);

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 className="text-lg font-semibold text-primary">System What-If Simulator</h2>
          <p className="text-sm text-muted">Simulate failures and predict blast radius, latency, and customer impact</p>
        </div>
      </div>

      {/* Scenario picker */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {SCENARIO_PRESETS.map((p) => (
            <button
              key={p.preset}
              className={`btn !py-1.5 !text-xs ${preset === p.preset ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handlePresetChange(p.preset)}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-secondary">{config.description}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted">
          <span><Clock size={12} className="inline mr-1" />Duration: {config.durationMin}min</span>
          <span>Severity: <span className="badge badge-warning text-[10px]">{config.severity}</span></span>
          <span>Targets: {config.targetNodeIds.length}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="card p-3 flex items-center gap-3">
        <button className="btn btn-outline !p-2" onClick={() => { setCurrentStep(0); setPlaying(false); }} title="Restart">
          <SkipBack size={16} />
        </button>
        <button
          className={`btn ${playing ? 'btn-primary' : 'btn-outline'} !px-4`}
          onClick={() => { if (currentStep >= steps.length - 1) setCurrentStep(0); setPlaying(!playing); }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          <span className="text-sm">{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button className="btn btn-outline !p-2" onClick={() => { setCurrentStep(steps.length - 1); setPlaying(false); }} title="Skip to end">
          <SkipForward size={16} />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={steps.length - 1}
            value={currentStep}
            onChange={(e) => { setCurrentStep(Number(e.target.value)); setPlaying(false); }}
            className="flex-1 accent-teal-500"
          />
          <span className="text-sm font-mono text-primary whitespace-nowrap">t={step?.minute ?? 0}min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Customer Impact:</span>
          <span className="text-lg font-bold font-mono" style={{ color: (step?.customerImpactPct ?? 0) > 20 ? 'var(--error)' : (step?.customerImpactPct ?? 0) > 5 ? 'var(--warning)' : 'var(--success)' }}>
            {step?.customerImpactPct.toFixed(1) ?? '0.0'}%
          </span>
        </div>
      </div>

      {/* Graph + metrics */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <ArchitectureGraph
            services={state.services}
            dependencies={state.dependencies}
            selectedNodeId={null}
            onSelectNode={() => {}}
            animateHealth={animateHealth}
            highlightNodeIds={highlightIds}
            dimNonHighlighted={false}
          />
          {/* Event log */}
          {step && step.events.length > 0 && (
            <div className="card p-3 max-h-32 overflow-y-auto scrollbar-thin">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertCircle size={14} style={{ color: 'var(--warning)' }} />
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Event Log</span>
              </div>
              <div className="space-y-1">
                {step.events.map((ev, i) => (
                  <div key={i} className="text-xs text-secondary font-mono">
                    <span className="text-muted">t={step.minute}m</span> {ev}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Metrics charts */}
        <div className="w-[360px] shrink-0 overflow-y-auto scrollbar-thin space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
            Simulation Metrics
          </div>
          <MiniChart data={impactData} label="Customer Impact (%)" color="var(--error)" max={maxImpact} />
          <MiniChart data={latencyData} label="Avg Latency (ms)" color="var(--warning)" max={maxLatency} />
          <MiniChart data={errorData} label="Avg Error Rate (%)" color="var(--error)" max={maxError} />
          <MiniChart data={queueData} label="Total Queue Depth" color="var(--info)" max={maxQueue} />

          {/* Affected services summary */}
          {step && (
            <div className="card p-3">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Affected Services</h4>
              <div className="space-y-1">
                {Object.entries(step.nodeStates)
                  .filter(([, ns]) => ns.affected)
                  .map(([id, ns]) => {
                    const s = state.services.find((s) => s.id === id);
                    return (
                      <div key={id} className="flex items-center justify-between text-xs">
                        <span className="text-secondary">{s?.name ?? id}</span>
                        <div className="flex items-center gap-2">
                          <span className={`badge text-[10px] ${
                            ns.health === 'unhealthy' ? 'badge-error' : ns.health === 'degraded' ? 'badge-warning' : 'badge-success'
                          }`}>{ns.health}</span>
                          <span className="text-muted font-mono">{ns.errorRate.toFixed(3)} err</span>
                        </div>
                      </div>
                    );
                  })}
                {Object.entries(step.nodeStates).filter(([, ns]) => ns.affected).length === 0 && (
                  <p className="text-xs text-muted">All systems nominal</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
