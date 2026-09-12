import { formatARS } from '../../services/tools/toolPriceReference';
import { progressLabel } from './worksiteBubble';
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
      <div className="flex flex-col bg-white p-4 sm:p-6 space-y-5 font-sans">
        {/* Header Estado Radar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#031530] to-[#042454] text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-sky-400 animate-spin" style={{ animationDuration: '10s' }} />
              <h3 className="font-black text-sm sm:text-base tracking-tight">Radar Operativo</h3>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">
              Hacé click en cualquier burbuja del mapa de Tucumán para inspeccionar su dotación, herramientas asignadas y cercanía logística.
            </p>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-white/10 text-sky-200 text-xs font-bold border border-white/15 whitespace-nowrap">
            📍 {allWorksites.length} Obras en Tucumán
          </div>
        </div>

        {/* Top Obras por Magnitud en Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Obras con Mayor Despliegue Operativo
            </h4>
            <span className="text-[10px] font-bold text-slate-400">Ordenadas por recursos</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topWorksites.map((obra, idx) => (
              <div
                key={obra.id}
                onClick={() => onSelectWorksite(obra)}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer bg-slate-50/60 hover:bg-white flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-xs text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {obra.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {obra.encargado_name ? `Coord: ${obra.encargado_name}` : 'Sin coordinador'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                    👷 {obra.workersCount}
                  </span>
                  <span className="text-[10px] font-extrabold text-sky-700 bg-sky-50 px-2 py-1 rounded-lg border border-sky-200">
                    🛠 {obra.toolsCount}
                  </span>
                  {obra.totalLaborCost > 0 && (
                    <span 
                      className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200" 
                      title={`Horas trabajadas: ${obra.totalLaborHours} hs`}
                    >
                      💰 ${(obra.totalLaborCost >= 1000000 ? `${(obra.totalLaborCost / 1000000).toFixed(1)}M` : obra.totalLaborCost.toLocaleString('es-AR'))}
                    </span>
                  )}
                  <ChevronRight size={15} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
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
    <div className="flex flex-col bg-white overflow-hidden font-sans">
      {/* Header Ficha de Obra */}
      <div className="p-4 sm:p-5 border-b border-slate-150 bg-slate-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
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
            {(selectedWorksite.totalLaborCost || 0) > 0 && (
              <span className="text-[9px] font-black text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                Costo M.O.: ${(selectedWorksite.totalLaborCost || 0).toLocaleString('es-AR')}
              </span>
            )}
          </div>
          <h3 className="text-lg sm:text-xl font-black text-peie-blue leading-tight truncate">
            {selectedWorksite.name}
          </h3>
          <div className="flex items-center gap-3 flex-wrap mt-1 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <MapPin size={13} className="text-slate-400 shrink-0" />
              {selectedWorksite.address || 'Tucumán, Argentina'}
            </span>
            {selectedWorksite.encargado_name && (
              <span className="text-slate-700 font-bold">
                Coordinador: <b className="text-slate-900">{selectedWorksite.encargado_name}</b>
              </span>
            )}
          </div>
        </div>

        {/* Acciones Rápidas del Header & Botón Cerrar */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/mis-obras', { state: { selectedObraId: selectedWorksite.id } })}
            className="text-xs font-extrabold text-peie-blue border-slate-250 hover:bg-white rounded-xl h-9 flex items-center gap-1.5"
          >
            <Building size={13} />
            <span className="hidden sm:inline">Ver en Obra</span>
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
            className="text-xs font-extrabold bg-blue-600 text-white hover:bg-blue-700 rounded-xl h-9 flex items-center gap-1.5 shadow-sm"
          >
            <ArrowRightLeft size={13} />
            <span>Reasignar Personal</span>
          </Button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all ml-1"
            title="Cerrar ficha"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Resumen Métricas con Costo de Mano de Obra */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white border-b border-slate-100">
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-150">
          <p className="text-xs font-extrabold text-amber-900">Personal Asignado</p>
          <p className="text-xl font-black text-amber-700 mt-0.5">👷 {selectedWorksite.workersCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-150">
          <p className="text-xs font-extrabold text-sky-900">Herramientas en Obra</p>
          <p className="text-xl font-black text-sky-700 mt-0.5">🛠 {selectedWorksite.toolsCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
          <p className="text-xs font-extrabold text-emerald-900">Costo por horas</p>
          <p className="text-xl font-black text-emerald-700 mt-0.5">
            ${(selectedWorksite.totalLaborCost || 0).toLocaleString('es-AR')}
          </p>
          <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            ⏱ {selectedWorksite.totalLaborHours || 0} hs registradas · {selectedWorksite.estimatedLaborHours || 0} h con tarifa estimada
          </p>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs font-extrabold text-blue-900">Valor de herramientas en obra</p>
          <p className="text-xl font-black text-blue-800">{formatARS(selectedWorksite.totalToolValue ?? 0)}</p>
          <p className="text-[10px] text-slate-600">Asignadas actualmente · {selectedWorksite.estimatedToolCount || 0} valores estimados</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <p className="text-xs font-extrabold text-emerald-900">Finalización de obra</p>
          <p className="text-xl font-black text-emerald-800">{progressLabel(selectedWorksite)} <span className="text-xs">/ 100%</span></p>
          <progress className="w-full accent-emerald-600" aria-label="Finalización de obra" max={100} value={selectedWorksite.progressPercent ?? 0} />
          <button className="text-xs underline" onClick={() => navigate('/coordinadores')}>Actualizar avance en Coordinadores</button>
          <p className="text-[10px] text-slate-600">Avance y precios manuales guardados en este navegador.</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-slate-700">Índice de Carga</p>
            <p className="text-[10px] text-slate-400 font-medium">Magnitud ponderada</p>
          </div>
          <span className="text-sm font-black text-peie-blue bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
            {selectedWorksite.magnitudeIndex.toFixed(1)} pts
          </span>
        </div>
      </div>

      {/* Contenido Pestañas */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col p-4 sm:p-5">
        <TabsList className="grid grid-cols-2 max-w-md p-1 bg-slate-100 rounded-xl mb-4">
          <TabsTrigger value="personal" className="rounded-lg text-xs font-bold py-2">
            Personal Asignado ({selectedWorksite.workersCount})
          </TabsTrigger>
          <TabsTrigger value="herramientas" className="rounded-lg text-xs font-bold py-2">
            Herramientas ({selectedWorksite.toolsCount})
          </TabsTrigger>
        </TabsList>

        {/* TAB PERSONAL EN GRID */}
        <TabsContent value="personal" className="space-y-3 mt-0">
          {selectedWorksite.assignedWorkers.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium border border-dashed rounded-xl p-4">
              <HardHat className="h-8 w-8 mx-auto text-slate-300 mb-1" />
              No hay operarios asignados a esta obra actualmente.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedWorksite.assignedWorkers.map((emp) => (
                <div
                  key={emp.id}
                  className="p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-all bg-white flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-50 border border-slate-200 flex items-center justify-center shrink-0">
                      {emp.photo_url ? (
                        <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <HardHat className="h-4 w-4 text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs text-slate-900 truncate">{emp.full_name}</p>
                      <p className="text-[11px] text-slate-500 font-semibold truncate">
                        {emp.specialty || 'Operario'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {emp.whatsapp && (
                      <a
                        href={`https://wa.me/${emp.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Contactar por WhatsApp"
                      >
                        <Phone size={14} />
                      </a>
                    )}
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {emp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB HERRAMIENTAS EN GRID */}
        <TabsContent value="herramientas" className="space-y-3 mt-0">
          {selectedWorksite.assignedTools.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium border border-dashed rounded-xl p-4">
              <Wrench className="h-8 w-8 mx-auto text-slate-300 mb-1" />
              No hay herramientas registradas en esta obra.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedWorksite.assignedTools.map((tool) => (
                <div
                  key={tool.id}
                  className="p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-all bg-white flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      {tool.photo_url ? (
                        <img src={tool.photo_url} alt={tool.name} className="w-full h-full object-cover" />
                      ) : (
                        <Wrench className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          {tool.code}
                        </span>
                        <p className="font-extrabold text-xs text-slate-900 truncate">{tool.name}</p>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {tool.brand ? `${tool.brand} • ` : ''}{tool.category || 'Herramienta'}
                      </p>
                    </div>
                  </div>

                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    {tool.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
