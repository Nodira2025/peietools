import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ObraFase, CoordinadorProfile, ObraEstadoFinal } from '../types/coordinadores';
import { coordinadoresService } from '../services/coordinadores/coordinadoresService';
import GanttChart from '../components/coordinadores/GanttChart';
import ModalFaseObra from '../components/coordinadores/ModalFaseObra';
import ModalEstadoObra from '../components/coordinadores/ModalEstadoObra';
import CoordinadoresList from '../components/coordinadores/CoordinadoresList';
import ModalEditarCoordinador from '../components/coordinadores/ModalEditarCoordinador';
import { 
  Users, 
  CalendarRange, 
  Building, 
  Sparkles, 
  Plus, 
  RefreshCw,
  Trash2,
  CircleDashed,
  Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function Coordinadores() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'gantt' | 'coordinadores'>('gantt');
  const [loading, setLoading] = useState(true);
  const [obrasEstadoLoading, setObrasEstadoLoading] = useState(false);
  const [obrasEstado, setObrasEstado] = useState<Record<string, ObraEstadoFinal>>({});
  const [obraEstadoToEdit, setObraEstadoToEdit] = useState<ObraEstadoFinal | null>(null);
  const [isObraEstadoModalOpen, setIsObraEstadoModalOpen] = useState(false);

  // Obras state
  const [obras, setObras] = useState<{ id: string; name: string; encargado_name?: string | null }[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>('');

  // Fases state
  const [fases, setFases] = useState<ObraFase[]>([]);
  const [fasesLoading, setFasesLoading] = useState(false);
  const [selectedFase, setSelectedFase] = useState<ObraFase | null>(null);
  const [isFaseModalOpen, setIsFaseModalOpen] = useState(false);

  // Coordinadores state
  const [coordinadores, setCoordinadores] = useState<CoordinadorProfile[]>([]);
  const [selectedCoordinador, setSelectedCoordinador] = useState<CoordinadorProfile | null>(null);
  const [isEditCoordModalOpen, setIsEditCoordModalOpen] = useState(false);

  // Initial load
  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        // Fetch active obras
        const { data: obrasData } = await supabase
          .from('obras')
          .select('id, name, encargado_name')
          .eq('active', true)
          .order('name');

        const loadedObras = obrasData || [];
        setObras(loadedObras);

        if (loadedObras.length > 0) {
          setSelectedObraId(loadedObras[0].id);
        }

        // Fetch coordinators
        const coords = await coordinadoresService.getCoordinadores();
        setCoordinadores(coords);
      } catch (err: any) {
        console.error('Error initializing Coordinadores page:', err);
        toast({
          variant: 'destructive',
          title: 'Error de Carga',
          description: 'No se pudieron cargar los datos iniciales.'
        });
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [toast]);

  // Load phases when selected obra changes
  useEffect(() => {
    if (!selectedObraId) return;

    async function loadFases() {
      setFasesLoading(true);
      try {
        const currentObra = obras.find(o => o.id === selectedObraId);
        const data = await coordinadoresService.getFases(selectedObraId, currentObra?.encargado_name);
        setFases(data);
      } catch (err: any) {
        console.error('Error loading fases:', err);
      } finally {
        setFasesLoading(false);
      }
    }

    loadFases();
  }, [selectedObraId, obras]);

  useEffect(() => {
    if (!obras.length) {
      setObrasEstado({});
      return;
    }

    setObrasEstadoLoading(true);
    try {
      const estados = coordinadoresService.getObrasEstado(obras);
      setObrasEstado(estados);
    } catch (err: any) {
      console.error('Error cargando estado final por obra:', err);
    } finally {
      setObrasEstadoLoading(false);
    }
  }, [obras]);

  const refreshObrasEstado = () => {
    if (!obras.length) {
      setObrasEstado({});
      return;
    }
    const estados = coordinadoresService.getObrasEstado(obras);
    setObrasEstado(estados);
  };

  // Handlers for Fases (Gantt)
  const handleOpenAddFase = () => {
    setSelectedFase(null);
    setIsFaseModalOpen(true);
  };

  const handleOpenEditFase = (fase: ObraFase) => {
    setSelectedFase(fase);
    setIsFaseModalOpen(true);
  };

  const handleSaveFase = async (fase: ObraFase) => {
    const success = await coordinadoresService.saveFase(fase);
    if (success) {
      toast({
        title: 'Fase Guardada',
        description: `Se actualizó la fase "${fase.name}" correctamente.`
      });
      // Refresh current phases
      const currentObra = obras.find(o => o.id === selectedObraId);
      const updated = await coordinadoresService.getFases(selectedObraId, currentObra?.encargado_name);
      setFases(updated);
    }
  };

  const handleDeleteFase = async (faseId: string) => {
    const success = await coordinadoresService.deleteFase(selectedObraId, faseId);
    if (success) {
      toast({
        title: 'Fase Eliminada',
        description: 'La fase fue removida del cronograma.'
      });
      const currentObra = obras.find(o => o.id === selectedObraId);
      const updated = await coordinadoresService.getFases(selectedObraId, currentObra?.encargado_name);
      setFases(updated);
    }
  };

  // Handlers for Obra Final State (ring data)
  const handleOpenObraEstado = () => {
    setObraEstadoToEdit(currentObraEstado || null);
    setIsObraEstadoModalOpen(true);
  };

  const handleSaveObraEstado = async (estado: ObraEstadoFinal) => {
    const success = coordinadoresService.saveObraEstado({
      ...estado,
      esMuestra: false
    });
    if (success) {
      refreshObrasEstado();
      toast({
        title: 'Estado actualizado',
        description: `Se guardó el estado final de ${estado.obraName}.`
      });
    }
  };

  const handleDeleteObraEstado = async (obraId: string) => {
    const success = coordinadoresService.deleteObraEstado(obraId);
    if (success) {
      refreshObrasEstado();
      toast({
        title: 'Estado eliminado',
        description: 'Se eliminó el estado cargado para la obra.'
      });
    }
  };

  const handleDeleteAllSampleEstados = () => {
    const hasItems = Object.keys(obrasEstado).some((id) => obrasEstado[id]?.esMuestra);
    if (!hasItems) return;
    const confirmDelete = window.confirm('¿Querés borrar todos los estados de muestra para poder cargar valores manuales desde el formulario?');
    if (!confirmDelete) return;

    const success = coordinadoresService.deleteAllSampleObraEstados();
    if (success) {
      refreshObrasEstado();
      toast({
        title: 'Muestras removidas',
        description: 'Se eliminaron los estados de muestra y se mantuvieron los registrados manualmente.'
      });
    }
  };

  // Handlers for Coordinadores
  const handleOpenEditCoord = (coord: CoordinadorProfile) => {
    setSelectedCoordinador(coord);
    setIsEditCoordModalOpen(true);
  };

  const handleSaveCoord = async (id: string, updates: Partial<CoordinadorProfile>) => {
    const success = await coordinadoresService.updateCoordinador(id, updates);
    if (success) {
      // Refresh coordinators list
      const updatedList = await coordinadoresService.getCoordinadores();
      setCoordinadores(updatedList);
    }
  };

  const handleSelectObraGantt = (obraId: string) => {
    setSelectedObraId(obraId);
    setActiveTab('gantt');
  };

  const currentObraName = obras.find(o => o.id === selectedObraId)?.name || 'Obra Seleccionada';
  const hasSampleEstados = Object.values(obrasEstado).some(s => s?.esMuestra);
  const getEstadoColor = (etapaFinal: ObraEstadoFinal['etapaFinal']) => {
    if (etapaFinal === 'Finalizada') return 'text-emerald-600';
    if (etapaFinal === 'Listo para entrega') return 'text-blue-600';
    if (etapaFinal === 'Pruebas y control') return 'text-amber-600';
    if (etapaFinal === 'En ejecución') return 'text-indigo-600';
    return 'text-slate-500';
  };

  const getRingGradient = (estado: ObraEstadoFinal | null) => {
    if (!estado) {
      return 'conic-gradient(#cbd5e1 0deg, #cbd5e1 360deg)';
    }
    const doneColor = estado.etapaFinal === 'Finalizada'
      ? '#059669'
      : estado.etapaFinal === 'Listo para entrega'
        ? '#0284c7'
        : estado.etapaFinal === 'Pruebas y control'
          ? '#d97706'
          : estado.etapaFinal === 'En ejecución'
            ? '#2563eb'
            : '#94a3b8';

    return `conic-gradient(${doneColor} ${estado.avanceFinal}%, #e2e8f0 ${estado.avanceFinal}% 100%)`;
  };

  const formatFechaCierre = (fecha: string | null) => {
    if (!fecha) return 'Sin fecha';
    try {
      return new Date(fecha).toLocaleDateString('es-AR');
    } catch {
      return fecha;
    }
  };
  const currentObraEstado = selectedObraId ? obrasEstado[selectedObraId] : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#031530] to-[#042454] p-5 sm:p-6 rounded-3xl text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-blue-400/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-400" />
              Gestión Operativa
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Coordinadores & Avance de Obras
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Control visual de cronograma mediante diagrama de Gantt, avance técnico por etapas y directorio de personal administrativo con contacto directo y domicilio.
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center bg-slate-900/60 p-1.5 rounded-2xl border border-slate-700/60 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('gantt')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'gantt'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            Diagrama de Gantt
          </button>
          <button
            onClick={() => setActiveTab('coordinadores')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'coordinadores'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Equipo ({coordinadores.length})
          </button>
        </div>
      </div>

      {/* Main Tab 1: Gantt Chart View */}
      {activeTab === 'gantt' && (
        <div className="space-y-5">
          {/* Obra Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Building className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-[200px] max-w-md">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Seleccionar Frente de Obra
                </label>
                <Select value={selectedObraId} onValueChange={setSelectedObraId}>
                  <SelectTrigger className="rounded-xl border-slate-200 text-xs sm:text-sm font-semibold text-slate-800">
                    <SelectValue placeholder="Elegí una obra para ver su cronograma..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {obras.map((o) => (
                      <SelectItem key={o.id} value={o.id} className="text-xs">
                        {o.name} {o.encargado_name ? `(${o.encargado_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentObra = obras.find(o => o.id === selectedObraId);
                  coordinadoresService.getFases(selectedObraId, currentObra?.encargado_name).then(setFases);
                  toast({ title: 'Actualizado', description: 'Cronograma recargado.' });
                }}
                disabled={fasesLoading}
                className="rounded-xl text-xs h-9 text-slate-600"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${fasesLoading ? 'animate-spin' : ''}`} />
                Refrescar
              </Button>

              <Button
                onClick={handleOpenAddFase}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-9 shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar Fase
              </Button>
            </div>
          </div>

          {/* Estado de obra (Anillo de estadio final) + resumen de anillos */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Anillo de estadio final: {currentObraName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Estado consolidado por obra para visualizar avance final y cierre.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleOpenObraEstado}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold h-9 shadow-sm"
                  >
                    {currentObraEstado ? 'Editar estado' : 'Cargar estado'}
                  </Button>
                  {currentObraEstado?.esMuestra && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteObraEstado(selectedObraId)}
                      className="rounded-xl text-xs h-9 text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Quitar muestra
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
                <div className="w-40 h-40 mx-auto sm:mx-0 relative rounded-full p-2 shrink-0" style={{ background: getRingGradient(currentObraEstado) }}>
                  <div className="w-full h-full rounded-full bg-white/95 flex items-center justify-center border border-slate-100 shadow-sm">
                    {obrasEstadoLoading ? (
                      <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
                    ) : currentObraEstado ? (
                      <div className="text-center">
                        <p className={`text-3xl font-black ${getEstadoColor(currentObraEstado.etapaFinal)}`}>
                          {currentObraEstado.avanceFinal}%
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">avance</p>
                      </div>
                    ) : (
                      <CircleDashed className="w-7 h-7 text-slate-300" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {obrasEstadoLoading ? (
                    <p className="text-xs text-slate-400">Cargando estado de muestra...</p>
                  ) : currentObraEstado ? (
                    <div className="space-y-3 text-xs text-slate-600">
                      <div className="bg-slate-50 rounded-xl border border-slate-200 px-3 py-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Estado final:</span>
                        <p className={`font-bold text-sm ${getEstadoColor(currentObraEstado.etapaFinal)}`}>
                          {currentObraEstado.etapaFinal}
                        </p>
                      </div>
                      <p>
                        Etapas cargadas: <span className="font-semibold text-slate-800">{currentObraEstado.etapasCompletadas}/{currentObraEstado.etapasTotales}</span>
                      </p>
                      <p>
                        Cierre estimado: <span className="font-semibold text-slate-800">{formatFechaCierre(currentObraEstado.fechaEstimadaCierre)}</span>
                      </p>
                      <p className="text-slate-500">
                        Actualizado: {new Date(currentObraEstado.actualizadoEn).toLocaleDateString('es-AR')}
                      </p>
                      {currentObraEstado.notas && (
                        <p className="text-slate-500 line-clamp-2">{currentObraEstado.notas}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Esta obra aún no tiene estado cargado para dibujar el anillo.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Anillos por obra
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeleteAllSampleEstados}
                  disabled={!hasSampleEstados}
                  className="rounded-xl text-xs h-8 text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  Limpiar muestra
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tilde si querés quitar estos datos para cargarlo desde formulario.
              </p>

              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
                {obras.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No hay obras cargadas.</p>
                ) : (
                  obras.map((obra) => {
                    const estado = obrasEstado[obra.id];
                    return (
                      <button
                        key={obra.id}
                        type="button"
                        onClick={() => {
                          setSelectedObraId(obra.id);
                        }}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${
                          selectedObraId === obra.id
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full shrink-0 border border-slate-200 p-0.5"
                            style={{ background: estado ? getRingGradient(estado) : 'conic-gradient(#cbd5e1 0deg, #cbd5e1 360deg)' }}
                          >
                            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                              {estado ? (
                                <span className="text-[10px] font-bold text-slate-700">{estado.avanceFinal}%</span>
                              ) : (
                                <Circle className="w-3 h-3 text-slate-400" />
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate">{obra.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {estado ? estado.etapaFinal : 'Sin estado definido'}
                            </p>
                          </div>

                          {estado?.esMuestra && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              muestra
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Gantt Visualization */}
          {fasesLoading ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-slate-200">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
              <p className="text-xs text-slate-500">Cargando fases del plan de obra...</p>
            </div>
          ) : (
            <GanttChart
              obraName={currentObraName}
              fases={fases}
              onEditFase={handleOpenEditFase}
              onAddFase={handleOpenAddFase}
            />
          )}
        </div>
      )}

      {/* Main Tab 2: Coordinators Directory */}
      {activeTab === 'coordinadores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Directorio de Personal Administrativo & Coordinadores
              </h3>
              <p className="text-xs text-slate-500">
                Fichas de contacto rápido, domicilio y foto de perfil comprimida para optimizar la comunicación operativa.
              </p>
            </div>
          </div>

          <CoordinadoresList
            coordinadores={coordinadores}
            onEdit={handleOpenEditCoord}
            onSelectObraGantt={handleSelectObraGantt}
          />
        </div>
      )}

      {/* Modal Nueva / Editar Fase */}
      <ModalFaseObra
        isOpen={isFaseModalOpen}
        onClose={() => setIsFaseModalOpen(false)}
        obraId={selectedObraId}
        fase={selectedFase}
        onSave={handleSaveFase}
        onDelete={handleDeleteFase}
        defaultOrderIndex={fases.length + 1}
      />

      {/* Modal Editar Coordinador */}
      <ModalEditarCoordinador
        isOpen={isEditCoordModalOpen}
        onClose={() => setIsEditCoordModalOpen(false)}
        coordinador={selectedCoordinador}
        obras={obras}
        onSave={handleSaveCoord}
      />

      <ModalEstadoObra
        isOpen={isObraEstadoModalOpen}
        onClose={() => setIsObraEstadoModalOpen(false)}
        obraId={selectedObraId}
        obraNombre={currentObraName}
        estado={obraEstadoToEdit}
        onSave={handleSaveObraEstado}
        onDelete={handleDeleteObraEstado}
      />
    </div>
  );
}
