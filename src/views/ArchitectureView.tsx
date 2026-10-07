import { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import { ArchitectureGraph } from '@/components/ArchitectureGraph';
import { NodeDetailPanel } from '@/components/NodeDetailPanel';
import type { Tier } from '@/types';

export function ArchitectureView() {
  const { state, dispatch } = useStore();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all');
  const [showUndocOnly, setShowUndocOnly] = useState(false);

  const filteredServices = useMemo(() => {
    return state.services.filter((s) => {
      if (tierFilter !== 'all' && s.tier !== tierFilter) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.id.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [state.services, tierFilter, search]);

  const highlightIds = useMemo(() => {
    if (!search && tierFilter === 'all') return undefined;
    return new Set(filteredServices.map((s) => s.id));
  }, [filteredServices, search, tierFilter]);

  const selectedNode = state.selectedNodeId
    ? state.services.find((s) => s.id === state.selectedNodeId)
    : null;

  const tiers: { value: Tier | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'frontend', label: 'Frontend' },
    { value: 'api', label: 'API' },
    { value: 'service', label: 'Services' },
    { value: 'data', label: 'Data' },
    { value: 'infra', label: 'Infra' },
  ];

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input w-full pl-9"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-muted" />
          {tiers.map((t) => (
            <button
              key={t.value}
              className={`btn !py-1.5 !px-2.5 !text-xs ${tierFilter === t.value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTierFilter(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          className={`btn !py-1.5 !text-xs ${showUndocOnly ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setShowUndocOnly(!showUndocOnly)}
        >
          {showUndocOnly ? 'Showing undocumented only' : 'Show undocumented only'}
        </button>
      </div>

      {/* Graph + Detail */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 min-w-0">
          <ArchitectureGraph
            services={state.services}
            dependencies={state.dependencies}
            selectedNodeId={state.selectedNodeId}
            onSelectNode={(id) => dispatch({ type: 'SELECT_NODE', nodeId: id })}
            highlightNodeIds={highlightIds}
            dimNonHighlighted={!!highlightIds}
            showUndocumentedOnly={showUndocOnly}
          />
        </div>

        {selectedNode && (
          <div className="w-[340px] shrink-0">
            <NodeDetailPanel
              node={selectedNode}
              dependencies={state.dependencies}
              onClose={() => dispatch({ type: 'SELECT_NODE', nodeId: null })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
