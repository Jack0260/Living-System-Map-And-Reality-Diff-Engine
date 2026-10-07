import { useMemo } from 'react';
import { Download, FileJson, FileText, FileImage } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import { computeDiff } from '@/engines/diffEngine';
import { computeImpact } from '@/engines/impactEngine';

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportView() {
  const { state } = useStore();

  const findings = useMemo(() => computeDiff(state.services, state.dependencies), [state.services, state.dependencies]);

  const fullExport = useMemo(() => {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      systemName: 'SystemXray — e-commerce platform',
      services: state.services,
      dependencies: state.dependencies,
      incidents: state.incidents,
      deployments: state.deployments,
      metrics: state.metrics,
      diffFindings: findings,
    }, null, 2);
  }, [state, findings]);

  const reportExport = useMemo(() => {
    const topFindings = findings.slice(0, 10);
    const impactResults = state.services.map((s) => computeImpact(s.id, 'remove', state.services, state.dependencies));
    const topRisks = impactResults.sort((a, b) => b.criticalityScore - a.criticalityScore).slice(0, 5);

    let report = `# SystemXray Architecture Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**System:** e-commerce platform (${state.services.length} services)\n\n`;
    report += `## Executive Summary\n\n`;
    report += `This report compares the documented architecture against observed runtime behavior.\n`;
    report += `${findings.length} discrepancies were identified, with ${findings.filter((f) => f.severity === 'critical').length} critical and ${findings.filter((f) => f.severity === 'high').length} high-severity findings.\n\n`;
    report += `## Reality Diff Findings\n\n`;
    for (const f of topFindings) {
      report += `### [${f.severity.toUpperCase()}] ${f.title}\n\n`;
      report += `- **Category:** ${f.category}\n`;
      report += `- **Description:** ${f.description}\n`;
      report += `- **Recommendation:** ${f.recommendation}\n\n`;
    }
    report += `## Top Risk Components (by impact score)\n\n`;
    for (const r of topRisks) {
      const s = state.services.find((s) => s.id === r.selectedNode);
      report += `| Component | Score | Criticality | Downstream |\n`;
      report += `|-----------|-------|-------------|------------|\n`;
      report += `| ${s?.name ?? r.selectedNode} | ${r.criticalityScore} | ${r.criticality} | ${r.downstreamAffected.length} services |\n`;
    }
    report += `\n## Service Inventory\n\n`;
    for (const s of state.services) {
      report += `- **${s.name}** (${s.kind}): ${s.health} — SLO ${s.slo.availability}%, replicas ${s.replicas}/${s.scaleTarget}\n`;
    }
    report += `\n## Recent Incidents\n\n`;
    for (const inc of state.incidents) {
      report += `- **[${inc.severity}]** ${inc.title} (${inc.durationMin}min) — ${inc.customerImpact}\n`;
    }
    return report;
  }, [state, findings]);

  const svgExport = () => {
    const svg = document.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    downloadFile('systemxray-graph.svg', source, 'image/svg+xml');
  };

  const impactReport = useMemo(() => {
    let report = `# Change Impact Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    const results = state.services.map((s) => computeImpact(s.id, 'remove', state.services, state.dependencies));
    const sorted = results.sort((a, b) => b.criticalityScore - a.criticalityScore);
    for (const r of sorted) {
      const s = state.services.find((s) => s.id === r.selectedNode);
      report += `## ${s?.name ?? r.selectedNode} (Score: ${r.criticalityScore})\n\n`;
      report += `- Criticality: ${r.criticality}\n`;
      report += `- Directly affected: ${r.directlyAffected.length} services\n`;
      report += `- Downstream cascade: ${r.downstreamAffected.length} services\n`;
      report += `- Customer workflows: ${r.customerWorkflows.length}\n`;
      report += `- Rollback path: ${r.rollbackPath.length > 0 ? r.rollbackPath.join(' → ') : 'Direct rollback'}\n\n`;
    }
    return report;
  }, [state.services, state.dependencies]);

  const exports = [
    {
      icon: FileJson,
      title: 'Full Architecture (JSON)',
      description: 'Complete system model: services, dependencies, incidents, metrics, and diff findings.',
      action: () => downloadFile('systemxray-architecture.json', fullExport, 'application/json'),
    },
    {
      icon: FileText,
      title: 'Architecture Report (Markdown)',
      description: 'Formatted report with executive summary, diff findings, risk rankings, and service inventory.',
      action: () => downloadFile('systemxray-report.md', reportExport, 'text/markdown'),
    },
    {
      icon: FileText,
      title: 'Change Impact Report (Markdown)',
      description: 'Per-component blast radius analysis with criticality scores and rollback paths.',
      action: () => downloadFile('systemxray-impact-report.md', impactReport, 'text/markdown'),
    },
    {
      icon: FileImage,
      title: 'Graph Export (SVG)',
      description: 'Export the current architecture graph as a vector image.',
      action: svgExport,
    },
  ];

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Download size={20} style={{ color: 'var(--accent)' }} />
        <div>
          <h2 className="text-lg font-semibold text-primary">Architecture Export</h2>
          <p className="text-sm text-muted">Export system model, reports, and graph images</p>
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {exports.map((e) => {
          const Icon = e.icon;
          return (
            <div key={e.title} className="card p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-tertiary shrink-0">
                  <Icon size={20} className="text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-primary">{e.title}</h3>
                  <p className="text-xs text-secondary mt-1 leading-relaxed">{e.description}</p>
                </div>
              </div>
              <button className="btn btn-primary w-full" onClick={e.action}>
                <Download size={15} />
                Download
              </button>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-primary mb-3">Export Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-muted">Services</p><p className="font-mono text-primary">{state.services.length}</p></div>
          <div><p className="text-xs text-muted">Dependencies</p><p className="font-mono text-primary">{state.dependencies.length}</p></div>
          <div><p className="text-xs text-muted">Diff Findings</p><p className="font-mono text-primary">{findings.length}</p></div>
          <div><p className="text-xs text-muted">Incidents</p><p className="font-mono text-primary">{state.incidents.length}</p></div>
        </div>
      </div>
    </div>
  );
}
