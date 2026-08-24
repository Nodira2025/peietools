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
  FileSpreadsheet,
  Building2,
  TrendingUp,
  UserCheck,
  ShieldAlert,
  HelpCircle,
  FileText,
  User
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { buildWhatsAppLink } from '../lib/whatsapp';
import * as XLSX from 'xlsx';

export interface NovedadDiaria {
  id: string;
  empleado_id?: string;
  empleado_nombre: string;
  empleado_dni?: string;
  fecha: string;
  mes: string;
  quincena: string;
  obra_id?: string;
  obra_nombre?: string;
  hora_ingreso?: string;
  hora_egreso?: string;
  almuerzo?: boolean;
  horas_ausente?: number;
  horas_trabajadas: number;
  estado: 'PRESENTE' | 'AUSENTE' | 'LLEGADA TARDE' | 'SE RETIRO';
  tipo_licencia: string;
  certificado_medico: boolean;
  observaciones?: string;
  fuente?: string;
  created_at?: string;
}

export interface EmpleadoScorecard {
  id: string;
  full_name: string;
  role: string;
  specialty?: string;
  whatsapp?: string;
  created_at?: string;
  fecha_ingreso?: string;
  antiguedad_anios?: number;
}

export default function Trabajadores() {
  const { toast } = useToast();
  
  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'ficha' | 'novedades' | 'computo' | 'reglas'>('ficha');
  
  const [novedades, setNovedades] = useState<NovedadDiaria[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoScorecard[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string>('');
  const [mesFiltro, setMesFiltro] = useState<string>('AGOSTO');
  const [quincenaFiltro, setQuincenaFiltro] = useState<string>('2Q');
  const [searchTerm, setSearchTerm] = useState('');

  // Reglas de bonos y anti-fraude
  const [horasObjetivo, setHorasObjetivo] = useState(44);
  const [porcentajeBono, setPorcentajeBono] = useState(10);
  const [horaInicioPermitida, setHoraInicioPermitida] = useState('06:30');
  const [horaFinPermitida, setHoraFinPermitida] = useState('19:30');
  const [horaLimitePuntualidad, setHoraLimitePuntualidad] = useState('08:15');
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
        if (reglasData.hora_inicio_permitida) setHoraInicioPermitida(reglasData.hora_inicio_permitida);
        if (reglasData.hora_fin_permitida) setHoraFinPermitida(reglasData.hora_fin_permitida);
        if (reglasData.hora_limite_puntualidad) setHoraLimitePuntualidad(reglasData.hora_limite_puntualidad);
      }

      // 2. Cargar empleados
      const { data: empData } = await supabase
        .from('empleados')
        .select('id, full_name, role, specialty, whatsapp, created_at')
        .eq('active', true)
        .order('full_name');

      if (empData) {
        setEmpleados(empData);
        if (!selectedEmpleadoId && empData.length > 0) {
          setSelectedEmpleadoId(empData[0].id);
        }
      }

      // 3. Cargar novedades de Supabase
      const { data: novData } = await supabase
        .from('novedades_diarias')
        .select('*')
        .order('fecha', { ascending: false });

      setNovedades(novData || []);
    } catch (err: any) {
      console.error('Error cargando datos de trabajadores:', err);
      toast({
        variant: 'destructive',
        title: 'Error de carga',
        description: 'No se pudieron sincronizar los datos de asistencia.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Guardar reglas
  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const payload = {
        horas_objetivo_semanal: horasObjetivo,
        porcentaje_bono: porcentajeBono,
        hora_inicio_permitida: horaInicioPermitida,
        hora_fin_permitida: horaFinPermitida,
        hora_limite_puntualidad: horaLimitePuntualidad,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('reglas_horas_trabajadores')
        .upsert([payload]);

      if (error) console.warn(error);

      toast({
        title: 'Reglas y Horarios Actualizados',
        description: `Ventana de obra: ${horaInicioPermitida} a ${horaFinPermitida} hs. Bono: +${porcentajeBono}%.`
      });
      setIsRulesModalOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: err.message });
    } finally {
      setSavingRules(false);
    }
  };

  // Empleado seleccionado para la Ficha Individual
  const selectedEmpleado = useMemo(() => {
    return empleados.find(e => e.id === selectedEmpleadoId) || empleados[0];
  }, [empleados, selectedEmpleadoId]);

  // Métricas calculadas para la Ficha del Trabajador
  const scorecardMetrics = useMemo(() => {
    if (!selectedEmpleado) {
      return {
        enfermedad: 0,
        noJustificadas: 0,
        llegadasTarde: 0,
        familiarEnfermo: 0,
        duelo: 0,
        totalInasistencias: 0,
        totalJornadas: 0,
        presentismoReal: 100,
        cumplimientoIdeal: 100,
        premioGanado: true,
        horasAcumuladas: 0
      };
    }

    const empNovedades = novedades.filter(n => 
      (n.empleado_id === selectedEmpleado.id) || 
      (n.empleado_nombre && n.empleado_nombre.toLowerCase().includes(selectedEmpleado.full_name.toLowerCase()))
    );

    const enfermedad = empNovedades.filter(n => n.tipo_licencia === 'Enfermedad Trabajador').length;
    const noJustificadas = empNovedades.filter(n => n.tipo_licencia === 'No justificado' || (n.estado === 'AUSENTE' && n.tipo_licencia === 'Ninguno')).length;
    const llegadasTarde = empNovedades.filter(n => n.estado === 'LLEGADA TARDE' || n.tipo_licencia === 'Llegada tarde').length;
    const familiarEnfermo = empNovedades.filter(n => n.tipo_licencia === 'Familiar Enfermo').length;
    const duelo = empNovedades.filter(n => n.tipo_licencia === 'Fallecimiento').length;
    
    const totalInasistencias = enfermedad + noJustificadas + familiarEnfermo + duelo;
    const horasAcumuladas = empNovedades.reduce((acc, n) => acc + (Number(n.horas_trabajadas) || 0), 0);
    const totalJornadas = Math.max(1, empNovedades.length);

    const jornadasPresente = empNovedades.filter(n => n.estado === 'PRESENTE' || n.estado === 'LLEGADA TARDE').length;
    const presentismoReal = empNovedades.length > 0 
      ? Math.round((jornadasPresente / totalJornadas) * 10000) / 100
      : 100;

    const cumplimientoIdeal = Math.max(0, Math.min(100, Math.round(((totalJornadas - noJustificadas) / totalJornadas) * 10000) / 100));
    
    // Premio por Asistencia Perfecta: Se pierde si hay faltas o llegadas tardes
    const premioGanado = noJustificadas === 0 && llegadasTarde === 0 && totalInasistencias <= 1;

    return {
      enfermedad,
      noJustificadas,
      llegadasTarde,
      familiarEnfermo,
      duelo,
      totalInasistencias,
      totalJornadas,
      presentismoReal,
      cumplimientoIdeal,
      premioGanado,
      horasAcumuladas
    };
  }, [selectedEmpleado, novedades]);

  // Novedades filtradas para la tabla de Novedades Diarias
  const filteredNovedades = useMemo(() => {
    return novedades.filter(n => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = 
        n.empleado_nombre.toLowerCase().includes(s) ||
        (n.obra_nombre && n.obra_nombre.toLowerCase().includes(s)) ||
        (n.tipo_licencia && n.tipo_licencia.toLowerCase().includes(s)) ||
        (n.observaciones && n.observaciones.toLowerCase().includes(s));

      const matchesMes = !mesFiltro || mesFiltro === 'TODOS' || n.mes === mesFiltro;
      const matchesQuincena = !quincenaFiltro || quincenaFiltro === 'TODAS' || n.quincena === quincenaFiltro;

      return matchesSearch && matchesMes && matchesQuincena;
    });
  }, [novedades, searchTerm, mesFiltro, quincenaFiltro]);

  // Exportar Novedades a Excel
  const handleExportNovedades = () => {
    if (filteredNovedades.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay novedades para exportar.' });
      return;
    }

    const dataToExport = filteredNovedades.map(n => ({
      'Mes': n.mes,
      'Quincena': n.quincena,
      'Fecha': n.fecha,
      'Apellido y Nombre': n.empleado_nombre,
      'Estado': n.estado,
      'Tipo de Licencia': n.tipo_licencia,
      'Certificado Médico': n.certificado_medico ? 'SÍ' : 'NO',
      'Hora Inicio': n.hora_ingreso || '08:00',
      'Hora Egreso': n.hora_egreso || '18:00',
      'Almuerzo': n.almuerzo ? 'SÍ (-1h)' : 'NO',
      'Horas Trabajadas': n.horas_trabajadas,
      'Obra': n.obra_nombre || '',
      'Observaciones': n.observaciones || '',
      'Fuente': n.fuente || 'APP_WEB'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Novedades_PEIE');
    XLSX.writeFile(wb, `Novedades_PEIE_${mesFiltro}_${quincenaFiltro}.xlsx`);

    toast({ title: 'Excel Exportado', description: 'Reporte de novedades descargado.' });
  };

  // WhatsApp directo para consultar salud
  const handleContactWorker = (phone?: string, name?: string) => {
    const p = phone || selectedEmpleado?.whatsapp;
    const n = (name || selectedEmpleado?.full_name || 'compañero').split(' ')[0];
    if (!p) {
      toast({ variant: 'destructive', title: 'Sin WhatsApp', description: 'No hay número registrado.' });
      return;
    }
    const message = `Hola ${n}, ¿cómo estás? Te escribimos de PEIE para saber cómo seguís de salud y si necesitás alguna asistencia con tu reposo. ¡Que te mejores pronto!`;
    const waLink = buildWhatsAppLink(p, message);
    window.open(waLink, '_blank');
  };

  const mesesList = ['TODOS', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-14">
      
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#031530] via-[#042454] to-[#0b3b75] text-white p-5 md:p-6 rounded-3xl shadow-xl border border-slate-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-peie-light/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <Award className="w-3 h-3" />
              Gestión Integral de Personal
            </span>
            <span className="text-xs text-slate-300 font-medium">
              (Ventana: {horaInicioPermitida} a {horaFinPermitida} hs • Puntualidad: {horaLimitePuntualidad} hs)
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
            Panel de Trabajadores, Asistencia & Novedades
          </h1>
          <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Ficha individual de presentismo, control de novedades por quincena, seguimiento de salud y reglas anti-fraude para el bot de WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <Button
            onClick={() => setIsRulesModalOpen(true)}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-2xl px-4 py-2.5 shadow-sm transition-all flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            <span>Reglas & Horarios</span>
          </Button>

          <Button
            onClick={fetchData}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs rounded-2xl px-3 py-2.5 shadow-sm"
            title="Recargar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'ficha', label: '📇 Ficha del Trabajador (Scorecard)', icon: UserCheck },
          { id: 'novedades', label: '📋 Libro de Novedades Diarias', icon: FileText },
          { id: 'computo', label: '⏱️ Cómputo de Horas & Quincena', icon: Clock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === tab.id
                ? 'bg-[#031530] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* =================================================================== */}
      {/* PESTAÑA 1: FICHA DEL TRABAJADOR (SCORECARD INDIVIDUAL)              */}
      {/* =================================================================== */}
      {activeTab === 'ficha' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Selector de Empleado */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-11 h-11 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center font-black text-sm shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="w-full sm:w-auto">
                <Label className="text-[10px] font-extrabold uppercase text-slate-400">Seleccionar Trabajador:</Label>
                <select
                  value={selectedEmpleadoId}
                  onChange={(e) => setSelectedEmpleadoId(e.target.value)}
                  className="w-full sm:w-72 h-10 px-3 rounded-xl border border-slate-200 text-xs font-black text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#031530]"
                >
                  {empleados.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.specialty || emp.role})</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedEmpleado?.whatsapp && (
              <Button
                onClick={() => handleContactWorker()}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Contactar por WhatsApp</span>
              </Button>
            )}
          </div>

          {/* Ficha Principal */}
          {selectedEmpleado ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Columna Izquierda: Métricas en Tabla (Estilo Planilla 3) */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="bg-[#031530] text-white p-4 font-black text-sm uppercase tracking-wide flex items-center justify-between">
                  <span>FICHA DEL TRABAJADOR - {new Date().getFullYear()}</span>
                  <span className="text-xs text-blue-300">{selectedEmpleado.specialty || selectedEmpleado.role}</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs font-semibold">
                  <div className="grid grid-cols-2 p-3.5 bg-slate-50/50">
                    <span className="text-slate-500 font-bold">APELLIDO Y NOMBRE</span>
                    <span className="font-black text-slate-900">{selectedEmpleado.full_name}</span>
                  </div>

                  <div className="grid grid-cols-2 p-3.5">
                    <span className="text-slate-500 font-bold">Fecha de ingreso</span>
                    <span className="font-bold text-slate-800">
                      {selectedEmpleado.created_at ? new Date(selectedEmpleado.created_at).toLocaleDateString('es-AR') : '11/12/2024'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 p-3.5 bg-slate-50/50">
                    <span className="text-slate-500 font-bold">Antigüedad</span>
                    <span className="font-bold text-slate-800">1 año</span>
                  </div>

                  <div className="grid grid-cols-2 p-3.5">
                    <span className="text-slate-600 font-bold">Días acumulados por enfermedad del trabajador</span>
                    <span className="font-black text-amber-700">{scorecardMetrics.enfermedad}</span>
                  </div>

                  <div className="grid grid-cols-2 p-3.5 bg-slate-50/50">
                    <span className="text-slate-600 font-bold">Faltas no justificadas</span>
                    <span className={`font-black ${scorecardMetrics.noJustificadas > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {scorecardMetrics.noJustificadas}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 p-3.5">
                    <span className="text-slate-600 font-bold">Llegadas tardes</span>
                    <span className={`font-black ${scorecardMetrics.llegadasTarde > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {scorecardMetrics.llegadasTarde}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 p-3.5 bg-slate-50/50">
                    <span className="text-slate-600 font-bold">Días por familiar enfermo</span>
                    <span className="font-bold text-slate-800">{scorecardMetrics.familiarEnfermo}</span>
                  </div>

                  <div className="grid grid-cols-2 p-3.5">
                    <span className="text-slate-600 font-bold">Días por duelo / fallecimiento</span>
                    <span className="font-bold text-slate-800">{scorecardMetrics.duelo}</span>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Tarjetas de Rendimiento & Premio */}
              <div className="space-y-4">
                
                {/* Presentismo Real */}
                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-3xl p-5 shadow-xs text-center space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                    Presentismo Real (a la fecha)
                  </span>
                  <div className="text-3xl font-black text-amber-950">
                    {scorecardMetrics.presentismoReal}%
                  </div>
                  <p className="text-[11px] text-amber-700 font-medium">
                    Calculado sobre {scorecardMetrics.totalJornadas} jornadas registradas.
                  </p>
                </Card>

                {/* Tasa de Cumplimiento Ideal */}
                <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-3xl p-5 shadow-xs text-center space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                    Tasa de Cumplimiento Ideal
                  </span>
                  <div className="text-3xl font-black text-emerald-950">
                    {scorecardMetrics.cumplimientoIdeal}%
                  </div>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Sin penalización por faltas no justificadas.
                  </p>
                </Card>

                {/* Premio por Asistencia Perfecta */}
                <Card className={`rounded-3xl p-5 border text-center space-y-2 shadow-xs ${
                  scorecardMetrics.premioGanado
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  <span className="text-[10px] font-black uppercase tracking-widest block opacity-80">
                    Asistencia Perfecta
                  </span>
                  <div className="text-lg font-black tracking-tight">
                    {scorecardMetrics.premioGanado ? '🏆 PREMIO ASIGNADO (+10%)' : 'PREMIO PERDIDO'}
                  </div>
                  <p className="text-[10px] opacity-80">
                    *Requiere 0 faltas no justificadas y 0 llegadas tardes en la quincena.
                  </p>
                </Card>

              </div>

            </div>
          ) : null}

        </div>
      )}

      {/* =================================================================== */}
      {/* PESTAÑA 2: LIBRO DE NOVEDADES DIARIAS (PLANILLA 2)                  */}
      {/* =================================================================== */}
      {activeTab === 'novedades' && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* Barra de Filtros por Mes, Quincena y Búsqueda */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por operario, obra o motivo..."
                className="pl-10 text-xs rounded-xl border-slate-200"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                {mesesList.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={quincenaFiltro}
                onChange={(e) => setQuincenaFiltro(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="TODAS">Todas las Quincenas</option>
                <option value="1Q">1º Quincena (1-15)</option>
                <option value="2Q">2º Quincena (16-31)</option>
              </select>

              <Button
                onClick={handleExportNovedades}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl px-3.5 py-2 flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </Button>
            </div>
          </div>

          {/* Tabla de Novedades Diarias */}
          {filteredNovedades.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">Sin novedades registradas</h3>
              <p className="text-xs text-slate-400">No hay incidencias para el mes y quincena seleccionados.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#031530] text-white text-[10px] font-black uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Mes / Quincena</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Apellido y Nombre</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Tipo de Licencia</th>
                      <th className="py-3 px-4 text-center">Cert. Médico</th>
                      <th className="py-3 px-4">Horas</th>
                      <th className="py-3 px-4">Observaciones</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredNovedades.map((nov) => {
                      const isSick = nov.tipo_licencia?.toLowerCase().includes('enfermedad');
                      const isLate = nov.estado === 'LLEGADA TARDE';

                      return (
                        <tr key={nov.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-700">
                            {nov.mes} • {nov.quincena}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {nov.fecha}
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900">
                            {nov.empleado_nombre}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              nov.estado === 'PRESENTE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : nov.estado === 'LLEGADA TARDE'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              {nov.estado}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[11px] font-bold ${isSick ? 'text-rose-700' : 'text-slate-700'}`}>
                              {nov.tipo_licencia || 'Ninguno'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {nov.certificado_medico ? (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                SÍ
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold">NO</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900">
                            {nov.horas_trabajadas} hs
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate text-[11px]">
                            {nov.observaciones || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isSick && (
                              <button
                                onClick={() => handleContactWorker(undefined, nov.empleado_nombre)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Enviar mensaje de salud por WhatsApp"
                              >
                                <HeartHandshake className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =================================================================== */}
      {/* PESTAÑA 3: CÓMPUTO DE HORAS & QUINCENA                             */}
      {/* =================================================================== */}
      {activeTab === 'computo' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">Cómputo Quincenal de Horas</h3>
              <p className="text-xs text-slate-500">
                Horas consolidadas por operario para la liquidación de haberes y premios de la {quincenaFiltro} de {mesFiltro}.
              </p>
            </div>

            <Button
              onClick={handleExportNovedades}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Quincena a Excel</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {empleados.map(emp => {
              const empNovedades = novedades.filter(n => 
                (n.empleado_id === emp.id) || 
                (n.empleado_nombre && n.empleado_nombre.toLowerCase().includes(emp.full_name.toLowerCase()))
              );
              const totalHs = empNovedades.reduce((acc, n) => acc + (Number(n.horas_trabajadas) || 0), 0);
              const hasBonus = totalHs >= horasObjetivo;

              return (
                <Card key={emp.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900">{emp.full_name}</h4>
                      {hasBonus && (
                        <span className="bg-emerald-100 text-emerald-900 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                          +{porcentajeBono}% Bono
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 capitalize">{emp.specialty || emp.role}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Quincena:</span>
                    <span className="text-lg font-black text-slate-900">{totalHs} hs</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Reglas, Horarios y Anti-Fraude */}
      <Dialog open={isRulesModalOpen} onOpenChange={setIsRulesModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <span>Reglas de Asistencia & Anti-Fraude</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configurá la ventana horaria oficial de obra para el Bot de WhatsApp y los parámetros de bonificación.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRules} className="space-y-4 pt-2">
            
            {/* Ventana Horaria */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-black text-slate-900 block flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Ventana Horaria Permitida (Obra)</span>
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-700">Inicio Habilitado</Label>
                  <Input
                    type="time"
                    value={horaInicioPermitida}
                    onChange={(e) => setHoraInicioPermitida(e.target.value)}
                    className="bg-white rounded-xl text-xs font-black text-center"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-700">Cierre Habilitado</Label>
                  <Input
                    type="time"
                    value={horaFinPermitida}
                    onChange={(e) => setHoraFinPermitida(e.target.value)}
                    className="bg-white rounded-xl text-xs font-black text-center"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-[10px] font-bold text-slate-700">Hora Límite de Puntualidad (Tolerancia)</Label>
                <Input
                  type="time"
                  value={horaLimitePuntualidad}
                  onChange={(e) => setHoraLimitePuntualidad(e.target.value)}
                  className="bg-white rounded-xl text-xs font-black text-center"
                  required
                />
                <p className="text-[10px] text-slate-400">
                  Todo ingreso posterior a las {horaLimitePuntualidad} hs se computa como "Llegada Tarde".
                </p>
              </div>
            </div>

            {/* Bonos */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Horas Objetivo Semanales (para Bono)</Label>
                <Input
                  type="number"
                  min="1"
                  max="80"
                  value={horasObjetivo}
                  onChange={(e) => setHorasObjetivo(Number(e.target.value))}
                  className="rounded-xl border-slate-200 text-xs font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Porcentaje de Premio / Bono (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={porcentajeBono}
                  onChange={(e) => setPorcentajeBono(Number(e.target.value))}
                  className="rounded-xl border-slate-200 text-xs font-bold"
                  required
                />
              </div>
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
