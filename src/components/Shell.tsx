import {
  Network,
  GitCompare,
  Zap,
  FlaskConical,
  RotateCcw,
  Rocket,
  HeartPulse,
  GraduationCap,
  Download,
  Sun,
  Moon,
  Activity,
} from 'lucide-react';
import { useStore } from '@/store/AppStore';
import type { ViewId } from '@/types';
import type { ComponentType } from 'react';

interface NavItem {
  id: ViewId;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  description: string;
  seniorOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'architecture', label: 'Architecture', icon: Network, description: 'Live system map' },
  { id: 'reality-diff', label: 'Reality Diff', icon: GitCompare, description: 'Declared vs observed' },
  { id: 'change-impact', label: 'Change Impact', icon: Zap, description: 'What breaks if this changes' },
  { id: 'what-if', label: 'What-If Simulator', icon: FlaskConical, description: 'Failure simulation' },
  { id: 'incident-replay', label: 'Incident Replay', icon: RotateCcw, description: 'Past incident timelines' },
  { id: 'deployments', label: 'Deployments', icon: Rocket, description: 'Deployment history' },
  { id: 'service-health', label: 'Service Health', icon: HeartPulse, description: 'SLO and health status' },
  { id: 'senior', label: 'Senior Mode', icon: GraduationCap, description: 'ADR, SLO, capacity, DR', seniorOnly: true },
  { id: 'export', label: 'Export', icon: Download, description: 'Architecture export' },
];

export function Sidebar() {
  const { state, dispatch } = useStore();
  const items = NAV_ITEMS.filter((item) => !item.seniorOnly || state.seniorMode);

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main navigation">
      {items.map((item) => {
      const Icon = item.icon;
      const isActive = state.view === item.id;
      return (
        <button
          key={item.id}
          className={`nav-item ${isActive ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_VIEW', view: item.id })}
          aria-current={isActive ? 'page' : undefined}
          title={item.description}
        >
          <Icon size={18} />
          <span className="flex-1 text-left">{item.label}</span>
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
        </button>
      );
      })}
    </nav>
  );
}

export function TopBar() {
  const { state, dispatch } = useStore();

  const healthyCount = state.services.filter((s) => s.health === 'healthy').length;
  const degradedCount = state.services.filter((s) => s.health === 'degraded').length;
  const unhealthyCount = state.services.filter((s) => s.health === 'unhealthy').length;

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-3 border-b border-subtle bg-panel">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity size={22} style={{ color: 'var(--accent)' }} />
          <span className="text-lg font-bold text-primary tracking-tight">SystemXray</span>
        </div>
        <span className="hidden sm:inline text-muted text-sm">|</span>
        <span className="hidden sm:inline text-secondary text-sm">e-commerce platform</span>
        <span className="badge badge-muted hidden md:inline-flex">us-east-1</span>
        <span className={`badge hidden md:inline-flex ${state.dataSource === 'supabase' ? 'badge-success' : 'badge-muted'}`}>
          {state.dataSource === 'supabase' ? 'DB Connected' : 'Local Mode'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />
            <span className="text-secondary">{healthyCount} healthy</span>
          </span>
          {degradedCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }} />
              <span className="text-secondary">{degradedCount} degraded</span>
            </span>
          )}
          {unhealthyCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--error)' }} />
              <span className="text-secondary">{unhealthyCount} unhealthy</span>
            </span>
          )}
        </div>

        <button
          className={`btn ${state.seniorMode ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => dispatch({ type: 'TOGGLE_SENIOR' })}
          title="Toggle Senior Mode for advanced analysis"
        >
          <GraduationCap size={16} />
          <span className="hidden sm:inline">Senior</span>
        </button>

        <button
          className="btn btn-outline"
          onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {state.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
