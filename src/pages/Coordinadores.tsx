import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ObraFase, CoordinadorProfile } from '../types/coordinadores';
import { coordinadoresService } from '../services/coordinadores/coordinadoresService';
import GanttChart from '../components/coordinadores/GanttChart';
import ModalFaseObra from '../components/coordinadores/ModalFaseObra';
import CoordinadoresList from '../components/coordinadores/CoordinadoresList';
import ModalEditarCoordinador from '../components/coordinadores/ModalEditarCoordinador';
import { 
  Users, 
  CalendarRange, 
  Building, 
  Sparkles, 
  Plus, 
  Filter, 
  CheckCircle2,
  RefreshCw
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
    </div>
  );
}
