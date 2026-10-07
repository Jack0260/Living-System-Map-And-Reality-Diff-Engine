import { useState, useMemo } from 'react';
import {
  GraduationCap, FileText, Gauge, Server, Shield, Globe, TrendingUp,
  AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';
import { useStore } from '@/store/AppStore';
import { computeDiff } from '@/engines/diffEngine';
import { computeImpact } from '@/engines/impactEngine';
import { runSimulation, presetToConfig } from '@/engines/simulationEngine';
import type { Criticality } from '@/types';

type SeniorTab = 'adr' | 'slo' | 'capacity' | 'dr' | 'threat' | 'tradeoff';

const TABS: { id: SeniorTab; label: string; icon: typeof FileText }[] = [
  { id: 'adr', label: 'ADR Generation', icon: FileText },
  { id: 'slo', label: 'SLO/SLA Modeling', icon: Gauge },
  { id: 'capacity', label: 'Capacity & Scaling', icon: Server },
  { id: 'dr', label: 'Disaster Recovery', icon: Globe },
  { id: 'threat', label: 'Threat Model', icon: Shield },
  { id: 'tradeoff', label: 'Architecture Tradeoff Report', icon: TrendingUp },
];

function CriticalityBadge({ level }: { level: Criticality }) {
  const map: Record<Criticality, string> = {
    critical: 'badge-error',
    high: 'badge-warning',
    medium: 'badge-info',
    low: 'badge-muted',
  };
  return <span className={`badge ${map[level]}`}>{level}</span>;
}

export function SeniorModeView() {
  const { state } = useStore();
  const [tab, setTab] = useState<SeniorTab>('adr');

  const findings = useMemo(() => computeDiff(state.services, state.dependencies), [state.services, state.dependencies]);
  const nodeMap = new Map(state.services.map((s) => [s.id, s]));

  // ADR generation
  const adrContent = useMemo(() => {
    const topFindings = findings.slice(0, 5);
    return {
      title: 'Architecture Decision Record: Reality Diff Remediation',
      status: 'proposed' as const,
      context: `The living system map has identified ${findings.length} discrepancies between the documented and observed architecture. Key findings include ${topFindings.length} high-priority issues that require architectural decisions.\n\n${topFindings.map((f) => `- ${f.title}: ${f.description}`).join('\n')}`,
      decision: `1. Document all undocumented dependencies in the architecture diagram.\n2. Add circuit breakers and bulkheads for risky couplings.\n3. Implement redundancy for single points of failure.\n4. Create runbooks for all observed-but-undeclared paths.\n5. Establish quarterly architecture review cycles.`,
      consequences: 'Positive: Reduced mean-time-to-resolution, improved system understanding, better onboarding. Negative: Requires engineering investment (~2 sprints), potential temporary complexity as remediation is applied.',
      alternatives: 'A. Ignore discrepancies and accept risk — not recommended given customer impact.\nB. Rewrite affected services to remove undocumented paths — higher cost, longer timeline.\nC. Incremental remediation with prioritized findings — recommended approach.',
      date: new Date().toISOString().split('T')[0],
    };
  }, [findings]);

  // SLO modeling
  const sloData = useMemo(() => {
    return state.services.map((s) => {
      const compositeAvailability = s.slo.availability;
      const errorBudgetPct = s.errorBudgetRemaining;
      const burnRate = (100 - errorBudgetPct) / 30; // simplified monthly burn
      return { ...s, compositeAvailability, errorBudgetPct, burnRate };
    });
  }, [state.services]);

  // Capacity analysis
  const capacityAnalysis = useMemo(() => {
    const baseTraffic = state.metrics.reduce((sum, m) => sum + m.rps, 0);
    return [
      { multiplier: 1, label: 'Current', traffic: baseTraffic, status: 'ok', bottlenecks: [] as string[] },
      {
        multiplier: 10, label: '10x', traffic: baseTraffic * 10, status: 'risk',
        bottlenecks: state.services
          .filter((s) => s.scaleTarget < 30 && s.kind !== 'external')
          .map((s) => `${s.name}: max ${s.scaleTarget} replicas may be insufficient`)
      },
      {
        multiplier: 100, label: '100x', traffic: baseTraffic * 100, status: 'critical',
        bottlenecks: state.services
          .filter((s) => s.kind !== 'external')
          .map((s) => `${s.name}: scale target ${s.scaleTarget} insufficient for 100x; needs horizontal sharding or CDN offload`)
      },
    ];
  }, [state.metrics, state.services]);

  // DR analysis
  const drAnalysis = useMemo(() => {
    const dbFailover = state.services.find((s) => s.id === 'postgres-primary');
    const redisFailover = state.services.find((s) => s.id === 'redis-cache');
    const regionServices = state.services.filter((s) => s.region === 'us-east-1');

    const dbFailoverSim = runSimulation(state.services, state.dependencies, state.metrics, presetToConfig('db-primary-fail', state.services));
    const maxImpact = Math.max(...dbFailoverSim.map((s) => s.customerImpactPct));
    const recoveryMin = dbFailoverSim.findLastIndex((s) => s.customerImpactPct > 1);

    return {
      singleRegion: regionServices.length,
      dbRto: dbFailover?.slo.rtoMin ?? 0,
      dbRpo: dbFailover?.slo.rpoMin ?? 0,
      redisRto: redisFailover?.slo.rtoMin ?? 0,
      maxImpactPct: maxImpact,
      recoveryMin: recoveryMin + 1,
      failoverPaths: [
        { from: 'postgres-primary', to: 'read-replica-1', type: 'Automatic (Patroni)', rto: dbFailover?.slo.rtoMin ?? 0 },
        { from: 'redis-cache', to: 'replica-shard', type: 'Cluster auto-failover', rto: redisFailover?.slo.rtoMin ?? 0 },
      ],
      gaps: [
        'No multi-region deployment — all services in us-east-1',
        'No cross-region replication for PostgreSQL',
        'Object storage has no multi-region bucket replication',
      ],
    };
  }, [state.services, state.metrics, state.dependencies]);

  // Threat model
  const threatModel = useMemo(() => {
    const surfaces: { nodeId: string; surface: string; risk: Criticality; mitigation: string }[] = [];
    for (const s of state.services) {
      if (s.exposedEndpoints.length > 0 && s.tier !== 'frontend') {
        surfaces.push({
          nodeId: s.id,
          surface: `${s.exposedEndpoints.length} exposed endpoints (${s.exposedEndpoints.slice(0, 2).join(', ')}...)`,
          risk: s.kind === 'gateway' ? 'critical' : 'high',
          mitigation: 'Enforce RBAC, rate limiting, and input validation. Use API gateway auth for all endpoints.',
        });
      }
      if (s.kind === 'database') {
        surfaces.push({
          nodeId: s.id,
          surface: 'Direct database access — data exfiltration risk',
          risk: 'critical',
          mitigation: 'Network policies, connection pooling, audit logging, and encrypted at rest.',
        });
      }
      if (s.kind === 'external') {
        surfaces.push({
          nodeId: s.id,
          surface: 'External third-party dependency — supply chain risk',
          risk: 'high',
          mitigation: 'Vendor SLA monitoring, circuit breakers, fallback payment providers.',
        });
      }
      if (s.config.tokenTTL || s.config.auth) {
        surfaces.push({
          nodeId: s.id,
          surface: 'Authentication token management',
          risk: 'high',
          mitigation: 'Short-lived tokens, key rotation, MFA enforcement.',
        });
      }
    }
    return surfaces;
  }, [state.services]);

  // Tradeoff report
  const tradeoffReport = useMemo(() => {
    const criticalFindings = findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    const impactResults = state.services.slice(0, 5).map((s) => computeImpact(s.id, 'remove', state.services, state.dependencies));
    return {
      findings: criticalFindings,
      topRisks: impactResults.sort((a, b) => b.criticalityScore - a.criticalityScore).slice(0, 5),
      recommendations: [
        'Prioritize single-point-of-failure remediation for PostgreSQL primary — add read replicas with automated failover.',
        'Document all 6 undocumented dependencies and add them to the architecture diagram.',
        'Add circuit breakers between payment-service and fraud-service to prevent cascade failures.',
        'Implement multi-region deployment for at least the API gateway and payment service.',
        'Increase Redis cluster memory to prevent OOM during traffic spikes (per incident inc-002).',
      ],
    };
  }, [findings, state.services, state.dependencies]);

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GraduationCap size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 className="text-lg font-semibold text-primary">Senior Mode</h2>
          <p className="text-sm text-muted">Advanced architecture analysis and reporting</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`btn !py-1.5 !text-xs ${tab === t.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tab === 'adr' && (
          <div className="card p-6 max-w-4xl animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={18} style={{ color: 'var(--accent)' }} />
              <h3 className="text-lg font-semibold text-primary">{adrContent.title}</h3>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="badge badge-warning">{adrContent.status}</span>
              <span className="text-xs text-muted">{adrContent.date}</span>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Context</h4>
                <p className="text-secondary leading-relaxed whitespace-pre-line">{adrContent.context}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Decision</h4>
                <p className="text-secondary leading-relaxed whitespace-pre-line">{adrContent.decision}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Consequences</h4>
                <p className="text-secondary leading-relaxed whitespace-pre-line">{adrContent.consequences}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Alternatives</h4>
                <p className="text-secondary leading-relaxed whitespace-pre-line">{adrContent.alternatives}</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'slo' && (
          <div className="space-y-3 animate-fade-in">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">Composite System Availability</h3>
              <p className="text-sm text-secondary mb-2">
                Theoretical composite availability (assuming independent failures):
              </p>
              <p className="text-2xl font-bold text-primary font-mono">
                {(state.services.reduce((p, s) => p * (s.slo.availability / 100), 1) * 100).toFixed(3)}%
              </p>
              <p className="text-xs text-muted mt-1">
                This is the upper bound — real availability is lower due to shared dependencies and correlated failures.
              </p>
            </div>
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">Per-Service SLO & Error Budget</h3>
              <div className="space-y-2">
                {sloData.map((s) => (
                  <div key={s.id} className="bg-secondary rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-primary">{s.name}</span>
                      <span className="text-xs font-mono text-muted">SLO: {s.slo.availability}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-muted">Error Budget</p>
                        <div className="h-1.5 bg-tertiary rounded-full overflow-hidden mt-0.5">
                          <div className="h-full rounded-full" style={{ width: `${s.errorBudgetPct}%`, background: s.errorBudgetPct < 30 ? 'var(--error)' : s.errorBudgetPct < 60 ? 'var(--warning)' : 'var(--success)' }} />
                        </div>
                        <p className="text-[10px] font-mono text-primary mt-0.5">{s.errorBudgetPct}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted">Burn Rate</p>
                        <p className="text-xs font-mono" style={{ color: s.burnRate > 2 ? 'var(--error)' : 'var(--text-primary)' }}>
                          {s.burnRate.toFixed(1)}x
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted">Target Latency</p>
                        <p className="text-xs font-mono text-primary">{s.slo.latencyMs}ms</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'capacity' && (
          <div className="space-y-3 animate-fade-in">
            {capacityAnalysis.map((c) => (
              <div key={c.multiplier} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary">{c.label} Traffic Scenario</h3>
                  <span className={`badge ${c.status === 'ok' ? 'badge-success' : c.status === 'risk' ? 'badge-warning' : 'badge-error'}`}>
                    {c.status === 'ok' ? 'OK' : c.status === 'risk' ? 'At Risk' : 'Critical'}
                  </span>
                </div>
                <p className="text-sm text-secondary mb-2">
                  Total traffic: <span className="font-mono text-primary">{c.traffic.toLocaleString()} rps</span>
                </p>
                {c.bottlenecks.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">Bottlenecks</p>
                    {c.bottlenecks.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-secondary bg-secondary rounded px-3 py-1.5">
                        <AlertTriangle size={14} style={{ color: c.status === 'critical' ? 'var(--error)' : 'var(--warning)' }} />
                        {b}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted flex items-center gap-2">
                    <CheckCircle size={14} style={{ color: 'var(--success)' }} /> No bottlenecks identified
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'dr' && (
          <div className="space-y-3 animate-fade-in">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">Disaster Recovery Strategy</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted">DB RTO</p>
                  <p className="text-lg font-bold text-primary font-mono">{drAnalysis.dbRto}min</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted">DB RPO</p>
                  <p className="text-lg font-bold text-primary font-mono">{drAnalysis.dbRpo}min</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted">Sim Max Impact</p>
                  <p className="text-lg font-bold font-mono" style={{ color: 'var(--error)' }}>{drAnalysis.maxImpactPct.toFixed(1)}%</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted">Recovery Time</p>
                  <p className="text-lg font-bold text-primary font-mono">{drAnalysis.recoveryMin}min</p>
                </div>
              </div>
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Failover Paths</h4>
                <div className="space-y-1.5">
                  {drAnalysis.failoverPaths.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-secondary rounded px-3 py-2 text-sm">
                      <span className="text-primary">{nodeMap.get(f.from)?.name ?? f.from} → {f.to}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">{f.type}</span>
                        <span className="badge badge-accent text-[10px]">{f.rto}min RTO</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Gaps</h4>
                <div className="space-y-1.5">
                  {drAnalysis.gaps.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-secondary bg-secondary rounded px-3 py-2">
                      <XCircle size={14} style={{ color: 'var(--error)' }} />
                      {g}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-primary mb-2">Multi-Region Scenario</h3>
              <p className="text-sm text-secondary">
                Currently {drAnalysis.singleRegion} services run in us-east-1 with no multi-region deployment.
                A region outage would cause total system failure. Recommended: deploy API gateway and payment service
                to us-west-2 with cross-region data replication.
              </p>
            </div>
          </div>
        )}

        {tab === 'threat' && (
          <div className="space-y-3 animate-fade-in">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">Threat Model — Attack Surfaces</h3>
              <div className="space-y-2">
                {threatModel.map((t, i) => {
                  const s = nodeMap.get(t.nodeId);
                  return (
                    <div key={i} className="bg-secondary rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-primary">{s?.name ?? t.nodeId}</span>
                        <CriticalityBadge level={t.risk} />
                      </div>
                      <p className="text-xs text-secondary mb-1">{t.surface}</p>
                      <p className="text-xs text-muted"><span className="font-semibold">Mitigation: </span>{t.mitigation}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'tradeoff' && (
          <div className="space-y-3 animate-fade-in">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">Architecture Tradeoff Report</h3>
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Top Risks by Impact Score</h4>
                <div className="space-y-1.5">
                  {tradeoffReport.topRisks.map((r, i) => {
                    const s = nodeMap.get(r.selectedNode);
                    return (
                      <div key={i} className="flex items-center justify-between bg-secondary rounded px-3 py-2">
                        <span className="text-sm text-primary">{s?.name ?? r.selectedNode}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">Score: {r.criticalityScore}</span>
                          <CriticalityBadge level={r.criticality} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Critical Findings</h4>
                <div className="space-y-1.5">
                  {tradeoffReport.findings.map((f) => (
                    <div key={f.id} className="bg-secondary rounded px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 mb-0.5">
                        <CriticalityBadge level={f.severity} />
                        <span className="text-primary">{f.title}</span>
                      </div>
                      <p className="text-xs text-muted">{f.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Prioritized Recommendations</h4>
                <div className="space-y-1.5">
                  {tradeoffReport.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-secondary bg-secondary rounded px-3 py-2">
                      <span className="text-xs font-mono text-accent shrink-0 mt-0.5">{i + 1}.</span>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
