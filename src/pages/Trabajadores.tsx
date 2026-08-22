import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Clock, 
  Award, 
  HeartHandshake, 
  Settings, 
  Search, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  RefreshCw, 
  Download, 
  Sparkles,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { buildWhatsAppLink } from '../lib/whatsapp';
import * as XLSX from 'xlsx';

export interface RegistroHoras {
  id: string;
  empleado_id?: string;
  empleado_dni: string;
  empleado_nombre: string;
  semana_inicio: string;
  lunes: number;
  martes: number;
  miercoles: number;
  jueves: number;
  viernes: number;
  sabado: number;
  domingo: number;
  total_horas: number;
  motivo_ausencia: string;
  detalles_ausencia?: string | null;
  bono_alcanzado: boolean;
  porcentaje_bono: number;
  created_at?: string;
}

// Helper para obtener el lunes de la semana actual
function getMondayOfCurrentWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export default function Trabajadores() {
  const { toast } = useToast();
  const [registros, setRegistros] = useState<RegistroHoras[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [semanaFiltro, setSemanaFiltro] = useState<string>(getMondayOfCurrentWeek());
  const [filterBono, setFilterBono] = useState<string>('todos');

  // Reglas de bonos
  const [horasObjetivo, setHorasObjetivo] = useState(44);
  const [porcentajeBono, setPorcentajeBono] = useState(10);
  const [alertaSaludActiva, setAlertaSaludActiva] = useState(true);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar reglas
      const { data: reglasData } = await supabase
        .from('reglas_horas_trabajadores')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (reglasData) {
        if (reglasData.horas_objetivo_semanal) setHorasObjetivo(Number(reglasData.horas_objetivo_semanal));
        if (reglasData.porcentaje_bono) setPorcentajeBono(Number(reglasData.porcentaje_bono));
        if (reglasData.alerta_salud_activa !== undefined) setAlertaSaludActiva(reglasData.alerta_salud_activa);
      }

      // 2. Cargar registros de horas
      const { data: horasData, error: horasError } = await supabase
        .from('registro_horas_semanales')
        .select('*')
        .order('semana_inicio', { ascending: false });

      let combinedData = horasData || [];

      // Unir con los guardados en localStorage si los hubiese
      try {
        const localKey = `peie_horas_${semanaFiltro}`;
        const localSaved = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (localSaved.length > 0) {
          const existingDnis = new Set(combinedData.map((r: any) => `${r.empleado_dni}_${r.semana_inicio}`));
          localSaved.forEach((localItem: any) => {
            if (!existingDnis.has(`${localItem.empleado_dni}_${localItem.semana_inicio}`)) {
              combinedData.push(localItem);
            }
          });
        }
      } catch (e) {
        console.error(e);
      }

      setRegistros(combinedData);
    } catch (err: any) {
      console.error('Error cargando registros de horas:', err);
      toast({
        variant: 'destructive',
        title: 'Error de carga',
        description: 'No se pudieron obtener los cómputos de horas.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [semanaFiltro]);

  // Guardar reglas de bonos
  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const payload = {
        horas_objetivo_semanal: horasObjetivo,
        porcentaje_bono: porcentajeBono,
        alerta_salud_activa: alertaSaludActiva,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('reglas_horas_trabajadores')
        .upsert([payload]);

      if (error) {
        console.warn('Fallback local para reglas:', error.message);
      }

      try {
        localStorage.setItem('peie_reglas_horas', JSON.stringify(payload));
      } catch (localErr) {
        console.error(localErr);
      }

      toast({
        title: 'Reglas Actualizadas',
        description: `Bono del ${porcentajeBono}% configurado a partir de ${horasObjetivo} hs semanales.`
      });
      setIsRulesModalOpen(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar reglas',
        description: err.message
      });
    } finally {
      setSavingRules(false);
    }
  };

  // Filtrado de registros
  const filteredRegistros = useMemo(() => {
    return registros.filter(r => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = 
        r.empleado_nombre.toLowerCase().includes(s) ||
        r.empleado_dni.includes(s) ||
        (r.motivo_ausencia && r.motivo_ausencia.toLowerCase().includes(s)) ||
        (r.detalles_ausencia && r.detalles_ausencia.toLowerCase().includes(s));

      const matchesSemana = !semanaFiltro || r.semana_inicio === semanaFiltro;

      const matchesBono = 
        filterBono === 'todos' ||
        (filterBono === 'con_bono' && r.total_horas >= horasObjetivo) ||
        (filterBono === 'salud' && r.motivo_ausencia?.toLowerCase().includes('enfermedad'));

      return matchesSearch && matchesSemana && matchesBono;
    });
  }, [registros, searchTerm, semanaFiltro, filterBono, horasObjetivo]);

  // Métricas calculadas
  const stats = useMemo(() => {
    const totalHorasPlantel = filteredRegistros.reduce((acc, r) => acc + (Number(r.total_horas) || 0), 0);
    const totalTrabajadores = filteredRegistros.length;
    const promedioHoras = totalTrabajadores > 0 ? (totalHorasPlantel / totalTrabajadores).toFixed(1) : '0';
    const conBonoCount = filteredRegistros.filter(r => Number(r.total_horas) >= horasObjetivo).length;
    const saludAlertCount = filteredRegistros.filter(r => r.motivo_ausencia?.toLowerCase().includes('enfermedad')).length;

    return {
      totalHorasPlantel,
      totalTrabajadores,
      promedioHoras,
      conBonoCount,
      saludAlertCount
    };
  }, [filteredRegistros, horasObjetivo]);

  // Exportar a Excel
  const handleExportExcel = () => {
    if (filteredRegistros.length === 0) {
      toast({ title: 'Sin datos para exportar', description: 'No hay registros cargados en esta vista.' });
      return;
    }

    const dataToExport = filteredRegistros.map(r => ({
      'Nombre del Trabajador': r.empleado_nombre,
      'DNI': r.empleado_dni,
      'Semana': r.semana_inicio,
      'Lunes (hs)': r.lunes,
      'Martes (hs)': r.martes,
      'Miércoles (hs)': r.miercoles,
      'Jueves (hs)': r.jueves,
      'Viernes (hs)': r.viernes,
      'Sábado (hs)': r.sabado,
      'Domingo (hs)': r.domingo,
      'Total Horas': r.total_horas,
      'Califica a Bono': r.total_horas >= horasObjetivo ? `SÍ (+${porcentajeBono}%)` : 'NO',
      'Motivo Ausencia': r.motivo_ausencia || 'Ninguno',
      'Detalles Ausencia': r.detalles_ausencia || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horas_Trabajadores');
    XLSX.writeFile(wb, `Reporte_Horas_PEIE_${semanaFiltro}.xlsx`);

    toast({
      title: 'Excel Descargado',
      description: `Reporte de horas exportado correctamente.`
    });
  };

  // WhatsApp para chequear salud
  const handleContactHealth = (r: RegistroHoras) => {
    const primerNombre = r.empleado_nombre.split(' ')[0];
    const message = `Hola ${primerNombre}, ¿cómo estás? Te escribimos de PEIE para saber cómo seguís de salud y si necesitás algo con lo que podamos asistirte. ¡Que te mejores pronto!`;
    const waLink = buildWhatsAppLink(r.empleado_dni, message);
    window.open(waLink, '_blank');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
      {/* Header Superior */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#031530] to-[#042454] text-white p-5 md:p-6 rounded-3xl shadow-lg border border-slate-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-peie-light/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <Award className="w-3 h-3" />
              Reconocimiento & Cuidado
            </span>
            <span className="text-xs text-slate-300 font-medium">
              (Meta: {horasObjetivo} hs • Bono +{porcentajeBono}%)
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
            Panel de Trabajadores y Cómputo de Horas
          </h1>
          <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
            Supervisá las horas trabajadas por cada integrante del plantel, premiá el cumplimiento con bonos y brindá asistencia médica a quienes estuvieron ausentes.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <Button
            onClick={() => setIsRulesModalOpen(true)}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-2xl px-4 py-2.5 shadow-sm transition-all flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            <span>Reglas por Horas</span>
          </Button>

          <Button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl px-4 py-2.5 shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </Button>
        </div>
      </div>

      {/* Tarjetas de Métricas de la Semana */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        
        {/* Total Horas */}
        <Card className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 block leading-tight">
                {stats.totalHorasPlantel} hs
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                Total Plantel
              </span>
            </div>
          </div>
        </Card>

        {/* Promedio por trabajador */}
        <Card className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 block leading-tight">
                {stats.promedioHoras} hs
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                Promedio / Persona
              </span>
            </div>
          </div>
        </Card>

        {/* Con Bono Alcanzado */}
        <Card className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xl font-black text-emerald-700 block leading-tight">
                {stats.conBonoCount}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                Bono (+{porcentajeBono}%)
              </span>
            </div>
          </div>
        </Card>

        {/* Alertas de Salud */}
        <Card className={`border rounded-2xl p-4 shadow-xs transition-colors ${
          stats.saludAlertCount > 0 
            ? 'bg-rose-50/60 border-rose-200 text-rose-900' 
            : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              stats.saludAlertCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <HeartHandshake className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xl font-black block leading-tight">
                {stats.saludAlertCount}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                Reportes Salud
              </span>
            </div>
          </div>
        </Card>

      </div>

      {/* Barra de Filtros, Semana y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o DNI..."
            className="pl-10 pr-4 py-2 text-xs rounded-xl border-slate-200 focus-visible:ring-[#031530] font-medium bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Selector de semana */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={semanaFiltro}
              onChange={(e) => setSemanaFiltro(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-700 focus:outline-none"
            />
          </div>

          {/* Chips de filtro */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterBono('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterBono === 'todos' ? 'bg-[#031530] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({registros.length})
            </button>
            <button
              onClick={() => setFilterBono('con_bono')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterBono === 'con_bono' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Con Bono ({stats.conBonoCount})
            </button>
            <button
              onClick={() => setFilterBono('salud')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterBono === 'salud' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Salud ({stats.saludAlertCount})
            </button>
          </div>
        </div>
      </div>

      {/* Listado / Tabla de Cómputo de Horas */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-xs space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Cargando cómputo de horas...</p>
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
          <Clock className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">Sin registros de horas para esta semana</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Los operarios aún no enviaron sus formularios de esta semana o podés enviarles el link desde la sección Formularios.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredRegistros.map((reg) => {
            const hasBono = reg.total_horas >= horasObjetivo;
            const isSick = reg.motivo_ausencia?.toLowerCase().includes('enfermedad');

            return (
              <Card 
                key={reg.id || `${reg.empleado_dni}_${reg.semana_inicio}`}
                className={`bg-white rounded-3xl border shadow-xs hover:shadow-md transition-all p-5 ${
                  isSick ? 'border-rose-200 bg-rose-50/10' : hasBono ? 'border-emerald-200' : 'border-slate-200/80'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Info del Trabajador */}
                  <div className="space-y-1.5 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 leading-tight">
                        {reg.empleado_nombre}
                      </h3>
                      {hasBono && (
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Award className="w-3 h-3 text-emerald-700" />
                          Bono +{porcentajeBono}%
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>DNI: <strong className="text-slate-700">{reg.empleado_dni}</strong></span>
                      <span>•</span>
                      <span>Semana: <strong className="text-slate-700">{reg.semana_inicio}</strong></span>
                    </div>

                    {/* Estado de Salud / Ausencia */}
                    {reg.motivo_ausencia && reg.motivo_ausencia !== 'Ninguno' && (
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border mt-1 ${
                        isSick 
                          ? 'bg-rose-50 text-rose-800 border-rose-200' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        <HeartHandshake className="w-3.5 h-3.5 text-rose-600" />
                        <span>Motivo: {reg.motivo_ausencia}</span>
                        {reg.detalles_ausencia && <span className="font-normal italic">({reg.detalles_ausencia})</span>}
                      </div>
                    )}
                  </div>

                  {/* Desglose Diario de Horas */}
                  <div className="grid grid-cols-7 gap-1.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/60 text-center">
                    {[
                      { label: 'Lun', val: reg.lunes },
                      { label: 'Mar', val: reg.martes },
                      { label: 'Mié', val: reg.miercoles },
                      { label: 'Jue', val: reg.jueves },
                      { label: 'Vie', val: reg.viernes },
                      { label: 'Sáb', val: reg.sabado },
                      { label: 'Dom', val: reg.domingo },
                    ].map((d) => (
                      <div key={d.label} className="flex flex-col items-center px-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{d.label}</span>
                        <span className={`text-xs font-black mt-0.5 ${d.val > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                          {d.val}h
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total y Acciones */}
                  <div className="flex items-center justify-between lg:justify-end gap-3 min-w-[170px] pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-400 block uppercase">Total Horas</span>
                      <span className={`text-xl font-black block ${hasBono ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {reg.total_horas} hs
                      </span>
                    </div>

                    {isSick && (
                      <Button
                        onClick={() => handleContactHealth(reg)}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-sm"
                        title="Contactar para consultar estado de salud"
                      >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        <span>Asistir</span>
                      </Button>
                    )}
                  </div>

                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Reglas por Horas Trabajadas */}
      <Dialog open={isRulesModalOpen} onOpenChange={setIsRulesModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <span>Reglas por Horas Trabajadas</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configurá las metas para otorgar el bono de reconocimiento y las alertas de ausentismo por salud.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRules} className="space-y-4 pt-2">
            
            <div className="space-y-1">
              <Label htmlFor="target-hours" className="text-xs font-bold text-slate-700">
                Horas Objetivo Semanales (para calificar al bono) *
              </Label>
              <Input
                id="target-hours"
                type="number"
                min="1"
                max="80"
                value={horasObjetivo}
                onChange={(e) => setHorasObjetivo(Number(e.target.value))}
                className="rounded-xl border-slate-200 text-xs font-bold"
                required
              />
              <p className="text-[10px] text-slate-400">
                Ej: 44 horas semanales de jornada estándar cumplida.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bonus-percentage" className="text-xs font-bold text-slate-700">
                Porcentaje de Bono de Reconocimiento (%) *
              </Label>
              <Input
                id="bonus-percentage"
                type="number"
                min="1"
                max="100"
                value={porcentajeBono}
                onChange={(e) => setPorcentajeBono(Number(e.target.value))}
                className="rounded-xl border-slate-200 text-xs font-bold"
                required
              />
              <p className="text-[10px] text-slate-400">
                Se calcula como incentivo positivo sobre el total de haberes del trabajador.
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 block">Alertas de Ausencias por Salud</span>
                <span className="text-[10px] text-slate-500 block">Destacar a los operarios en reposo para acompañamiento.</span>
              </div>
              <input
                type="checkbox"
                checked={alertaSaludActiva}
                onChange={(e) => setAlertaSaludActiva(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRulesModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingRules}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold px-5"
              >
                {savingRules ? 'Guardando...' : 'Guardar Reglas'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
