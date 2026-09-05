import { Building, HardHat, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { OperationsKPIs as KPIsType } from '../../types/operations';


interface OperationsKPIsProps {
  kpis: KPIsType;
}

export default function OperationsKPIs({ kpis }: OperationsKPIsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-white/95 backdrop-blur rounded-2xl border border-slate-200/80 shadow-sm font-sans">
      {/* 1. Obras Activas */}
      <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
          <Building size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Obras Activas</p>
          <p className="text-base font-black text-slate-900 leading-none mt-0.5">{kpis.totalActiveWorksites}</p>
        </div>
      </div>

      {/* 2. Personal en Campo */}
      <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100/80 flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
          <HardHat size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-amber-800/70 uppercase tracking-wider truncate">En Campo</p>
          <p className="text-base font-black text-amber-900 leading-none mt-0.5">{kpis.totalFieldWorkers} <span className="text-[10px] font-semibold text-slate-400">op</span></p>
        </div>
      </div>

      {/* 3. Personal Disponible */}
      <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100/80 flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
          <CheckCircle2 size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-emerald-800/70 uppercase tracking-wider truncate">Op. Libres</p>
          <p className="text-base font-black text-emerald-900 leading-none mt-0.5">{kpis.totalAvailableWorkers} <span className="text-[10px] font-semibold text-slate-400">libres</span></p>
        </div>
      </div>

      {/* 4. Herramientas en Uso */}
      <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-100/80 flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-sky-100/80 text-sky-700 flex items-center justify-center shrink-0">
          <Wrench size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-sky-800/70 uppercase tracking-wider truncate">En Uso</p>
          <p className="text-base font-black text-sky-900 leading-none mt-0.5">{kpis.totalInUseTools} <span className="text-[10px] font-semibold text-slate-400">equipos</span></p>
        </div>
      </div>

      {/* 5. Herramientas Disponibles */}
      <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100/80 flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0">
          <Wrench size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-indigo-800/70 uppercase tracking-wider truncate">Equipos Disp.</p>
          <p className="text-base font-black text-indigo-900 leading-none mt-0.5">{kpis.totalAvailableTools} <span className="text-[10px] font-semibold text-slate-400">libres</span></p>
        </div>
      </div>

      {/* 6. Alertas / Sugerencias */}
      <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100/80 flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-rose-100/80 text-rose-700 flex items-center justify-center shrink-0">
          <AlertTriangle size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-rose-800/70 uppercase tracking-wider truncate">Alertas Radar</p>
          <p className="text-base font-black text-rose-900 leading-none mt-0.5">{kpis.alertsCount}</p>
        </div>
      </div>
    </div>
  );
}
