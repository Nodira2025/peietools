import { ChevronDown, X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  filters: {
    key: string;
    label: string;
    value: string;
    options: FilterOption[];
  }[];
  onFilterChange: (key: string, value: string) => void;
}

export default function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const activeCount = filters.filter(f => f.value !== '').length;

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(filter => (
        <div key={filter.key} className="relative">
          <select
            value={filter.value}
            onChange={e => onFilterChange(filter.key, e.target.value)}
            className={`appearance-none text-xs font-semibold pl-3 pr-7 py-2 rounded-full border cursor-pointer transition-colors ${
              filter.value 
                ? 'bg-peie-blue text-white border-peie-blue' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            <option value="">{filter.label}</option>
            {filter.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none ${filter.value ? 'text-white' : 'text-slate-400'}`} />
        </div>
      ))}
      {activeCount > 0 && (
        <button
          onClick={() => filters.forEach(f => onFilterChange(f.key, ''))}
          className="text-xs text-red-500 hover:text-red-600 font-semibold flex items-center gap-1 px-2"
        >
          <X className="h-3 w-3" /> Limpiar
        </button>
      )}
    </div>
  );
}
