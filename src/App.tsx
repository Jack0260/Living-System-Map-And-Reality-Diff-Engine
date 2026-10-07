import { useStore } from '@/store/AppStore';
import { Sidebar, TopBar } from '@/components/Shell';
import { ArchitectureView } from '@/views/ArchitectureView';
import { RealityDiffView } from '@/views/RealityDiffView';
import { ChangeImpactView } from '@/views/ChangeImpactView';
import { WhatIfSimulatorView } from '@/views/WhatIfSimulatorView';
import { IncidentReplayView } from '@/views/IncidentReplayView';
import { DeploymentsView } from '@/views/DeploymentsView';
import { ServiceHealthView } from '@/views/ServiceHealthView';
import { SeniorModeView } from '@/views/SeniorModeView';
import { ExportView } from '@/views/ExportView';

function App() {
  const { state } = useStore();

  const renderView = () => {
    switch (state.view) {
      case 'architecture': return <ArchitectureView />;
      case 'reality-diff': return <RealityDiffView />;
      case 'change-impact': return <ChangeImpactView />;
      case 'what-if': return <WhatIfSimulatorView />;
      case 'incident-replay': return <IncidentReplayView />;
      case 'deployments': return <DeploymentsView />;
      case 'service-health': return <ServiceHealthView />;
      case 'senior': return state.seniorMode ? <SeniorModeView /> : <ArchitectureView />;
      case 'export': return <ExportView />;
      default: return <ArchitectureView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-subtle bg-panel flex flex-col">
        <div className="p-3 border-b border-subtle">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'var(--accent-light)' }}>
              <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>SX</span>
            </div>
            <div>
              <p className="text-sm font-bold text-primary">SystemXray</p>
              <p className="text-[10px] text-muted">Living System Map</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <Sidebar />
        </div>
        <div className="p-3 border-t border-subtle">
          <div className="flex items-center justify-between text-xs text-muted px-2">
            <span>v1.0.0</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: 'var(--success)' }} />
              Simulation Mode
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          {state.loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-2 border-tertiary rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
                <p className="text-sm text-muted mt-3">Loading system map...</p>
              </div>
            </div>
          ) : (
            renderView()
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
