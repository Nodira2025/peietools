import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  HardHat,
  Wrench,
  X,
  ExternalLink,
  MapPin,
  Sparkles,
  Phone,
  ArrowRightLeft,
  ChevronRight,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OperationalWorksite } from '../../types/operations';

interface OperationsSidebarProps {
  selectedWorksite: OperationalWorksite | null;
  onClose: () => void;
  allWorksites: OperationalWorksite[];
  onSelectWorksite: (worksite: OperationalWorksite) => void;
}

export default function OperationsSidebar({
  selectedWorksite,
  onClose,
  allWorksites,
  onSelectWorksite,
}: OperationsSidebarProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'personal' | 'herramientas' | 'operaciones'>('personal');

  // Top 5 worksites by magnitude for the default overview
  const topWorksites = [...allWorksites]
    .sort((a, b) => b.magnitudeIndex - a.magnitudeIndex)
    .slice(0, 6);

  if (!selectedWorksite) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-slate-200 overflow-y-auto p-4 space-y-4 font-sans">
        {/* Header Estado Radar */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#031530] to-[#042454] text-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Compass className="h-5 w-5 text-sky-400 animate-spin" style={{ animationDuration: '10s' }} />
            <h3 className="font-black text-sm tracking-tight">Radar Operativo</h3>
          </div>
          <p className="text-xs text-slate-300">
            Hacé click en cualquier burbuja del mapa de Tucumán para inspeccionar su dotación, herramientas y cercanía logística.
          </p>
        </div>

        {/* Top Obras por Magnitud */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Obras con Mayor Despliegue
            </h4>
            <span className="text-[10px] font-bold text-slate-400">Por recursos</span>
          </div>

          <div className="space-y-2">
            {topWorksites.map((obra, idx) => (
              <div
                key={obra.id}
                onClick={() => onSelectWorksite(obra)}
                className="p-3 rounded-xl border border-slate-150 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer bg-slate-50/60 hover:bg-white flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-xs text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {obra.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {obra.encargado_name ? `Coord: ${obra.encargado_name}` : 'Sin coordinador'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    👷 {obra.workersCount}
                  </span>
                  <span className="text-[10px] font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                    🛠 {obra.toolsCount}
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${selectedWorksite.latitude},${selectedWorksite.longitude}`;

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 overflow-hidden font-sans">
      {/* Header Ficha de Obra */}
      <div className="p-4 border-b border-slate-150 bg-slate-50/80 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              {selectedWorksite.active ? 'Obra Activa' : 'Inactiva'}
            </span>
            {selectedWorksite.isSimulatedLocation ? (
              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Ubicación Referencial
              </span>
            ) : (
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <ShieldCheck size={11} /> Coordenada GPS
              </span>
            )}
          </div>
          <h3 className="text-base font-black text-peie-blue leading-tight truncate">
            {selectedWorksite.name}
          </h3>
          <p className="text-xs text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            {selectedWorksite.address || 'Tucumán, Argentina'}
          </p>
          {selectedWorksite.encargado_name && (
            <p className="text-xs text-slate-600 font-bold mt-1">
              Coordinador: <span className="text-slate-900">{selectedWorksite.encargado_name}</span>
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all shrink-0"
          title="Cerrar panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Resumen Rápido Métricas */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-white border-b border-slate-100 text-center">
        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-150">
          <p className="text-xs font-extrabold text-amber-900">Personal en Obra</p>
          <p className="text-xl font-black text-amber-700 mt-0.5">👷 {selectedWorksite.workersCount}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-150">
          <p className="text-xs font-extrabold text-sky-900">Herramientas</p>
          <p className="text-xl font-black text-sky-700 mt-0.5">🛠 {selectedWorksite.toolsCount}</p>
        </div>
      </div>

      {/* Contenido Pestañas */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-2 p-1 m-3 bg-slate-100 rounded-xl">
          <TabsTrigger value="personal" className="rounded-lg text-xs font-bold py-1.5">
            Personal ({selectedWorksite.workersCount})
          </TabsTrigger>
          <TabsTrigger value="herramientas" className="rounded-lg text-xs font-bold py-1.5">
            Herramientas ({selectedWorksite.toolsCount})
          </TabsTrigger>
        </TabsList>

        {/* TAB PERSONAL */}
        <TabsContent value="personal" className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 mt-0">
          {selectedWorksite.assignedWorkers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-medium border border-dashed rounded-xl p-4">
              <HardHat className="h-8 w-8 mx-auto text-slate-300 mb-1" />
              No hay operarios asignados a esta obra actualmente.
            </div>
          ) : (
            selectedWorksite.assignedWorkers.map((emp) => (
              <div
                key={emp.id}
                className="p-2.5 rounded-xl border border-slate-150 hover:border-blue-200 transition-all bg-white flex items-center justify-between gap-2.5 shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <HardHat className="h-4 w-4 text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-xs text-slate-900 truncate">{emp.full_name}</p>
                    <p className="text-[10px] text-slate-500 font-semibold truncate">
                      {emp.specialty || 'Electricista'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {emp.whatsapp && (
                    <a
                      href={`https://wa.me/${emp.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Contactar por WhatsApp"
                    >
                      <Phone size={13} />
                    </a>
                  )}
                  <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {emp.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* TAB HERRAMIENTAS */}
        <TabsContent value="herramientas" className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 mt-0">
          {selectedWorksite.assignedTools.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-medium border border-dashed rounded-xl p-4">
              <Wrench className="h-8 w-8 mx-auto text-slate-300 mb-1" />
              No hay herramientas registradas en esta obra.
            </div>
          ) : (
            selectedWorksite.assignedTools.map((tool) => (
              <div
                key={tool.id}
                className="p-2.5 rounded-xl border border-slate-150 hover:border-blue-200 transition-all bg-white flex items-center justify-between gap-2.5 shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {tool.photo_url ? (
                      <img src={tool.photo_url} alt={tool.name} className="w-full h-full object-cover" />
                    ) : (
                      <Wrench className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] font-black text-blue-700 bg-blue-50 px-1 rounded">
                        {tool.code}
                      </span>
                      <p className="font-extrabold text-xs text-slate-900 truncate">{tool.name}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {tool.brand ? `${tool.brand} • ` : ''}{tool.category || 'Herramienta'}
                    </p>
                  </div>
                </div>

                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  {tool.status}
                </span>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Barra de Acciones Rápidas */}
      <div className="p-3 border-t border-slate-150 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/mis-obras', { state: { selectedObraId: selectedWorksite.id } })}
          className="text-xs font-extrabold text-peie-blue border-slate-250 hover:bg-white rounded-xl flex-1 flex items-center gap-1 h-9"
        >
          <Building size={13} />
          Ver en Obra
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(gmapsUrl, '_blank')}
          className="text-xs font-extrabold text-slate-600 border-slate-250 hover:bg-white rounded-xl h-9 px-3"
          title="Ver en Google Maps"
        >
          <ExternalLink size={13} />
        </Button>
        <Button
          size="sm"
          onClick={() => navigate('/personal')}
          className="text-xs font-extrabold bg-blue-600 text-white hover:bg-blue-700 rounded-xl flex-1 flex items-center gap-1 h-9 shadow-sm"
        >
          <ArrowRightLeft size={13} />
          Personal
        </Button>
      </div>
    </div>
  );
}
