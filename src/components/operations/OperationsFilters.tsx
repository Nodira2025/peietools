import { Search, Building, HardHat, Wrench, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { OperationsFilterState } from '../../types/operations';


interface OperationsFiltersProps {
  filters: OperationsFilterState;
  onFilterChange: (newFilters: OperationsFilterState) => void;
  encargadosList: string[];
  searchMatchesCount: number;
}

export default function OperationsFilters({
  filters,
  onFilterChange,
  encargadosList,
  searchMatchesCount,
}: OperationsFiltersProps) {
  const handleToggleLayer = (layer: 'showWorksites' | 'showStaff' | 'showTools') => {
    onFilterChange({
      ...filters,
      [layer]: !filters[layer],
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-white/95 backdrop-blur rounded-2xl border border-slate-200/80 shadow-sm font-sans">
      {/* 1. Global Search */}
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 pointer-events-none" />
        <Input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
          placeholder="Buscar obra, empleado (ej: Carlos) o herramienta..."
          className="pl-9 pr-8 h-10 rounded-xl bg-slate-50/70 border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white transition-all"
        />
        {filters.searchQuery && (
          <button
            onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 2. Capas Activas (Chips) */}
      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
          Capas:
        </span>

        <button
          type="button"
          onClick={() => handleToggleLayer('showWorksites')}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all border ${
            filters.showWorksites
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
          }`}
        >
          <Building size={13} />
          <span>Obras</span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleLayer('showStaff')}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all border ${
            filters.showStaff
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
          }`}
        >
          <HardHat size={13} />
          <span>Personal</span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleLayer('showTools')}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all border ${
            filters.showTools
              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
          }`}
        >
          <Wrench size={13} />
          <span>Herramientas</span>
        </button>

        {/* Filtro por Coordinador */}
        <select
          value={filters.selectedEncargado}
          onChange={(e) => onFilterChange({ ...filters, selectedEncargado: e.target.value })}
          className="h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los coordinadores</option>
          {encargadosList.map((enc) => (
            <option key={enc} value={enc}>
              {enc}
            </option>
          ))}
        </select>
      </div>

      {filters.searchQuery && (
        <div className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg shrink-0 text-center">
          {searchMatchesCount} resultado{searchMatchesCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
