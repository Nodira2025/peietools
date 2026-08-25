import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Trophy, 
  TrendingDown, 
  TrendingUp, 
  Clock, 
  Users, 
  Award, 
  HeartHandshake, 
  AlertTriangle, 
  Calendar, 
  Filter, 
  FileSpreadsheet, 
  Building2, 
  CheckCircle2, 
  ShieldAlert, 
  Phone,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend, 
  LineChart, 
  Line 
} from 'recharts';
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
  obra_id?: string;
  created_at?: string;
  fecha_ingreso?: string;
}

interface TrabajadoresReportesTabProps {
  novedades: NovedadDiaria[];
  empleados: EmpleadoScorecard[];
  obrasList: { id: string; name: string }[];
  horasObjetivo: number;
  porcentajeBono: number;
}

const COLORS_PIE = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#64748b'];

export function TrabajadoresReportesTab({
  novedades,
  empleados,
  obrasList,
  horasObjetivo,
  porcentajeBono
}: TrabajadoresReportesTabProps) {
  
  // Filtros del Reporte
  const [periodoFiltro, setPeriodoFiltro] = useState<'mes' | 'quincena' | 'rango' | 'historico'>('mes');
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('AGOSTO');
  const [quincenaSeleccionada, setQuincenaSeleccionada] = useState<string>('2Q');
  const [fechaDesde, setFechaDesde] = useState<string>('2026-08-01');
  const [fechaHasta, setFechaHasta] = useState<string>('2026-08-31');
  const [obraFiltro, setObraFiltro] = useState<string>('TODAS');

  const mesesList = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  // 1. Filtrar Novedades según los parámetros seleccionados
  const novedadesFiltradas = useMemo(() => {
    return novedades.filter(n => {
      // Filtro de Obra
      if (obraFiltro !== 'TODAS') {
        const obraMatch = (n.obra_id === obraFiltro) || (n.obra_nombre && n.obra_nombre.toLowerCase().includes(obraFiltro.toLowerCase()));
        if (!obraMatch) return false;
      }

      // Filtro Temporal
      if (periodoFiltro === 'historico') return true;

      if (periodoFiltro === 'mes') {
        return n.mes === mesSeleccionado;
      }

      if (periodoFiltro === 'quincena') {
        return n.mes === mesSeleccionado && n.quincena === quincenaSeleccionada;
      }

      if (periodoFiltro === 'rango') {
        if (!n.fecha) return false;
        return n.fecha >= fechaDesde && n.fecha <= fechaHasta;
      }

      return true;
    });
  }, [novedades, periodoFiltro, mesSeleccionado, quincenaSeleccionada, fechaDesde, fechaHasta, obraFiltro]);

  // 2. Consolidar Estadísticas por Trabajador
  const metricasPorTrabajador = useMemo(() => {
    const statsMap = new Map<string, {
      nombre: string;
      empleadoId?: string;
      whatsapp?: string;
      specialty?: string;
      horasTrabajadas: number;
      diasPresente: number;
      diasAusente: number;
      llegadasTarde: number;
      enfermedad: number;
      noJustificadas: number;
      familiarEnfermo: number;
      totalJornadas: number;
      obraPrincipal: string;
    }>();

    // Inicializar con todos los empleados
    empleados.forEach(emp => {
      statsMap.set(emp.full_name.toLowerCase().trim(), {
        nombre: emp.full_name,
        empleadoId: emp.id,
        whatsapp: emp.whatsapp,
        specialty: emp.specialty || emp.role,
        horasTrabajadas: 0,
        diasPresente: 0,
        diasAusente: 0,
        llegadasTarde: 0,
        enfermedad: 0,
        noJustificadas: 0,
        familiarEnfermo: 0,
        totalJornadas: 0,
        obraPrincipal: 'Obra General'
      });
    });

    // Sumar datos de las novedades filtradas
    novedadesFiltradas.forEach(n => {
      const key = (n.empleado_nombre || '').toLowerCase().trim();
      let record = statsMap.get(key);
      if (!record) {
        record = {
          nombre: n.empleado_nombre,
          empleadoId: n.empleado_id,
          whatsapp: '',
          specialty: 'Personal de Obra',
          horasTrabajadas: 0,
          diasPresente: 0,
          diasAusente: 0,
          llegadasTarde: 0,
          enfermedad: 0,
          noJustificadas: 0,
          familiarEnfermo: 0,
          totalJornadas: 0,
          obraPrincipal: n.obra_nombre || 'Obra General'
        };
        statsMap.set(key, record);
      }

      record.totalJornadas += 1;
      record.horasTrabajadas += Number(n.horas_trabajadas) || 0;

      if (n.estado === 'PRESENTE') record.diasPresente += 1;
      else if (n.estado === 'LLEGADA TARDE') {
        record.diasPresente += 1;
        record.llegadasTarde += 1;
      } else if (n.estado === 'AUSENTE' || n.estado === 'SE RETIRO') {
        record.diasAusente += 1;
      }

      if (n.tipo_licencia === 'Enfermedad Trabajador') record.enfermedad += 1;
      else if (n.tipo_licencia === 'No justificado') record.noJustificadas += 1;
      else if (n.tipo_licencia === 'Familiar Enfermo') record.familiarEnfermo += 1;

      if (n.obra_nombre) record.obraPrincipal = n.obra_nombre;
    });

    const list = Array.from(statsMap.values());
    // Ordenar de mayor a menor horas trabajadas
    list.sort((a, b) => b.horasTrabajadas - a.horasTrabajadas);
    return list;
  }, [novedadesFiltradas, empleados]);

  // 3. Cálculos de Extremos (Top más horas vs Menos horas)
  const rankingSummary = useMemo(() => {
    // Filtrar los que tienen al menos 1 registro en el período
    const activosEnPeriodo = metricasPorTrabajador.filter(t => t.totalJornadas > 0 || t.horasTrabajadas > 0);
    
    if (activosEnPeriodo.length === 0) {
      return {
        topMasHoras: null,
        topMenosHoras: null,
        totalHorasGeneral: 0,
        promedioHorasOperario: 0,
        totalLlegadasTarde: 0,
        totalInasistencias: 0,
        tasaPresentismoGlobal: 100,
        calificanBonoCount: 0
      };
    }

    const topMasHoras = activosEnPeriodo[0];
    const topMenosHoras = activosEnPeriodo[activosEnPeriodo.length - 1];

    const totalHorasGeneral = activosEnPeriodo.reduce((acc, t) => acc + t.horasTrabajadas, 0);
    const promedioHorasOperario = Math.round((totalHorasGeneral / activosEnPeriodo.length) * 10) / 10;
    const totalLlegadasTarde = activosEnPeriodo.reduce((acc, t) => acc + t.llegadasTarde, 0);
    const totalInasistencias = activosEnPeriodo.reduce((acc, t) => acc + t.diasAusente, 0);
    
    const totalJornadasEmpresa = activosEnPeriodo.reduce((acc, t) => acc + t.totalJornadas, 0);
    const totalJornadasPresente = activosEnPeriodo.reduce((acc, t) => acc + t.diasPresente, 0);
    const tasaPresentismoGlobal = totalJornadasEmpresa > 0
      ? Math.round((totalJornadasPresente / totalJornadasEmpresa) * 10000) / 100
      : 100;

    const calificanBonoCount = activosEnPeriodo.filter(t => t.horasTrabajadas >= horasObjetivo).length;

    return {
      topMasHoras,
      topMenosHoras,
      totalHorasGeneral,
      promedioHorasOperario,
      totalLlegadasTarde,
      totalInasistencias,
      tasaPresentismoGlobal,
      calificanBonoCount
    };
  }, [metricasPorTrabajador, horasObjetivo]);

  // 4. Datos para Gráficos
  // Gráfico 1: Top 10 Horas
  const dataChartTopHoras = useMemo(() => {
    return metricasPorTrabajador.slice(0, 10).map(t => ({
      name: t.nombre.split(',')[0] || t.nombre,
      fullName: t.nombre,
      horas: t.horasTrabajadas,
      superaMeta: t.horasTrabajadas >= horasObjetivo
    }));
  }, [metricasPorTrabajador, horasObjetivo]);

  // Gráfico 2: Torta de Distribución de Novedades e Inasistencias
  const dataChartMotivos = useMemo(() => {
    let presente = 0;
    let tarde = 0;
    let enfermedad = 0;
    let noJust = 0;
    let familiar = 0;
    let otros = 0;

    novedadesFiltradas.forEach(n => {
      if (n.estado === 'PRESENTE') presente++;
      else if (n.estado === 'LLEGADA TARDE') tarde++;
      else if (n.tipo_licencia === 'Enfermedad Trabajador') enfermedad++;
      else if (n.tipo_licencia === 'No justificado') noJust++;
      else if (n.tipo_licencia === 'Familiar Enfermo') familiar++;
      else otros++;
    });

    const total = presente + tarde + enfermedad + noJust + familiar + otros;
    if (total === 0) return [];

    return [
      { name: '🟢 Presente a Tiempo', value: presente },
      { name: '🟡 Llegada Tarde', value: tarde },
      { name: '🔴 Enfermedad Trabajador', value: enfermedad },
      { name: '⬛ Falta No Justificada', value: noJust },
      { name: '🟣 Familiar Enfermo', value: familiar },
      { name: '⚪ Otros / Licencias', value: otros }
    ].filter(item => item.value > 0);
  }, [novedadesFiltradas]);

  // Gráfico 3: Evolución de Asistencia Diaria
  const dataChartEvolucion = useMemo(() => {
    const datesMap = new Map<string, { fecha: string; presentes: number; ausentes: number; horasTotales: number }>();
    
    novedadesFiltradas.forEach(n => {
      if (!n.fecha) return;
      let d = datesMap.get(n.fecha);
      if (!d) {
        d = { fecha: n.fecha.slice(5), presentes: 0, ausentes: 0, horasTotales: 0 };
        datesMap.set(n.fecha, d);
      }

      if (n.estado === 'PRESENTE' || n.estado === 'LLEGADA TARDE') d.presentes++;
      else d.ausentes++;

      d.horasTotales += Number(n.horas_trabajadas) || 0;
    });

    const sorted = Array.from(datesMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(s => s[1]);
  }, [novedadesFiltradas]);

  // 5. Alertas Críticas de RRHH
  const alertasRRHH = useMemo(() => {
    const list: {
      nombre: string;
      whatsapp?: string;
      tipo: 'SALUD_CRITICA' | 'REINCIDENCIA_TARDES' | 'FALTAS_INJUSTIFICADAS' | 'BONO_DESTACADO';
      mensaje: string;
      severidad: 'alta' | 'media' | 'positiva';
    }[] = [];

    metricasPorTrabajador.forEach(t => {
      if (t.enfermedad >= 3) {
        list.push({
          nombre: t.nombre,
          whatsapp: t.whatsapp,
          tipo: 'SALUD_CRITICA',
          mensaje: `Registró ${t.enfermedad} días de reposo médico en el período. Requiere seguimiento de ART/Certificado.`,
          severidad: 'alta'
        });
      }

      if (t.noJustificadas >= 2) {
        list.push({
          nombre: t.nombre,
          whatsapp: t.whatsapp,
          tipo: 'FALTAS_INJUSTIFICADAS',
          mensaje: `Acumula ${t.noJustificadas} inasistencias sin justificar. En riesgo de sanción y pérdida de premio.`,
          severidad: 'alta'
        });
      }

      if (t.llegadasTarde >= 2) {
        list.push({
          nombre: t.nombre,
          whatsapp: t.whatsapp,
          tipo: 'REINCIDENCIA_TARDES',
          mensaje: `Registró ${t.llegadasTarde} llegadas tarde. Pierde el premio por asistencia perfecta.`,
          severidad: 'media'
        });
      }

      if (t.horasTrabajadas >= horasObjetivo + 10) {
        list.push({
          nombre: t.nombre,
          whatsapp: t.whatsapp,
          tipo: 'BONO_DESTACADO',
          mensaje: `Excelente rendimiento: ${t.horasTrabajadas} hs trabajadas (Superó la meta por +${t.horasTrabajadas - horasObjetivo} hs).`,
          severidad: 'positiva'
        });
      }
    });

    return list;
  }, [metricasPorTrabajador, horasObjetivo]);

  // Exportar Reporte Ejecutivo a Excel
  const handleExportExecutiveReport = () => {
    const wb = XLSX.utils.book_new();

    // 1. Hoja Ranking
    const rankingData = metricasPorTrabajador.map((t, idx) => ({
      'Puesto': idx + 1,
      'Trabajador': t.nombre,
      'Especialidad': t.specialty,
      'Obra': t.obraPrincipal,
      'Horas Trabajadas': t.horasTrabajadas,
      'Jornadas Presente': t.diasPresente,
      'Llegadas Tardes': t.llegadasTarde,
      'Inasistencias Salud': t.enfermedad,
      'Faltas No Justificadas': t.noJustificadas,
      'Premio Bono (+10%)': t.horasTrabajadas >= horasObjetivo ? 'CALIFICA' : 'NO'
    }));

    const wsRanking = XLSX.utils.json_to_sheet(rankingData);
    XLSX.utils.book_append_sheet(wb, wsRanking, 'Ranking_Productividad');

    // 2. Hoja Resumen Ejecutivo
    const summaryData = [
      ['INFORME EJECUTIVO DE HORAS Y ASISTENCIA - PEIE', ''],
      ['Período Evaluado', `${periodoFiltro.toUpperCase()} (${mesSeleccionado} ${quincenaSeleccionada})`],
      ['Total Nómina Activa', empleados.length],
      ['Total Horas Computadas', rankingSummary.totalHorasGeneral],
      ['Promedio Horas / Operario', rankingSummary.promedioHorasOperario],
      ['Tasa de Presentismo Global', `${rankingSummary.tasaPresentismoGlobal}%`],
      ['Total Inasistencias', rankingSummary.totalInasistencias],
      ['Total Llegadas Tardes', rankingSummary.totalLlegadasTarde],
      ['Operario con Más Horas', `${rankingSummary.topMasHoras?.nombre || '-'} (${rankingSummary.topMasHoras?.horasTrabajadas || 0} hs)`],
      ['Operario con Menos Horas', `${rankingSummary.topMenosHoras?.nombre || '-'} (${rankingSummary.topMenosHoras?.horasTrabajadas || 0} hs)`]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_Ejecutivo_KPI');

    XLSX.writeFile(wb, `Informe_KPI_RRHH_PEIE_${mesSeleccionado}_${quincenaSeleccionada}.xlsx`);
  };

  const handleContact = (phone?: string, name?: string) => {
    if (!phone) return;
    const n = (name || 'compañero').split(' ')[0];
    const msg = `Hola ${n}, ¿cómo estás? Te escribimos de RRHH de PEIE para coordinar un tema de tu registro de asistencia.`;
    window.open(buildWhatsAppLink(phone, msg), '_blank');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      
      {/* =================================================================== */}
      {/* BARRA DE CONTROL Y FILTROS AVANZADOS                                */}
      {/* =================================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                Filtros del Informe de RRHH
              </h3>
              <p className="text-[11px] text-slate-500">
                Seleccioná el rango de fechas y obras para calcular los rankings y KPIs en tiempo real.
              </p>
            </div>
          </div>

          <Button
            onClick={handleExportExecutiveReport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-sm self-start md:self-auto"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Descargar Informe KPI (Excel)</span>
          </Button>
        </div>

        {/* Controles de Selección */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Tipo de Período */}
          <div className="space-y-1">
            <Label className="text-[10px] font-extrabold uppercase text-slate-400">Modalidad de Período</Label>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50"
            >
              <option value="quincena">Por Quincena (1Q / 2Q)</option>
              <option value="mes">Mes Completo</option>
              <option value="rango">Rango de Fechas Personalizado</option>
              <option value="historico">Histórico Completo (Todo el año)</option>
            </select>
          </div>

          {/* Mes / Quincena (si aplica) */}
          {(periodoFiltro === 'mes' || periodoFiltro === 'quincena') && (
            <div className="space-y-1">
              <Label className="text-[10px] font-extrabold uppercase text-slate-400">Mes</Label>
              <select
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
              >
                {mesesList.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {periodoFiltro === 'quincena' && (
            <div className="space-y-1">
              <Label className="text-[10px] font-extrabold uppercase text-slate-400">Quincena</Label>
              <select
                value={quincenaSeleccionada}
                onChange={(e) => setQuincenaSeleccionada(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
              >
                <option value="1Q">1º Quincena (1 al 15)</option>
                <option value="2Q">2º Quincena (16 a fin de mes)</option>
              </select>
            </div>
          )}

          {/* Rango de Fechas (si aplica) */}
          {periodoFiltro === 'rango' && (
            <>
              <div className="space-y-1">
                <Label className="text-[10px] font-extrabold uppercase text-slate-400">Desde</Label>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-extrabold uppercase text-slate-400">Hasta</Label>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl"
                />
              </div>
            </>
          )}

          {/* Obra */}
          <div className="space-y-1">
            <Label className="text-[10px] font-extrabold uppercase text-slate-400">Obra / Proyecto</Label>
            <select
              value={obraFiltro}
              onChange={(e) => setObraFiltro(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
            >
              <option value="TODAS">Todas las Obras</option>
              {obrasList.map(o => (
                <option key={o.id} value={o.name}>{o.name}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* =================================================================== */}
      {/* TARJETAS PODIO: MÁS HORAS VS MENOS HORAS & KPIS EJECUTIVOS          */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* PODIO 1: Trabajador con MÁS horas */}
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-2 -bottom-2 text-white/10 pointer-events-none">
            <Trophy size={100} />
          </div>
          
          <div className="space-y-2 relative z-10">
            <div className="flex items-center justify-between">
              <span className="bg-white/20 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 border border-white/20">
                <Trophy className="w-3 h-3 text-amber-300" />
                Líder en Horas Trabajadas
              </span>
              <ArrowUpRight className="w-5 h-5 text-emerald-200" />
            </div>

            <div>
              <h4 className="text-base font-black leading-tight text-white">
                {rankingSummary.topMasHoras?.nombre || 'Sin registros'}
              </h4>
              <p className="text-xs text-emerald-100 font-medium capitalize">
                {rankingSummary.topMasHoras?.specialty || 'Operario de Obra'} • {rankingSummary.topMasHoras?.obraPrincipal}
              </p>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-white/20 flex items-baseline justify-between relative z-10">
            <span className="text-xs font-bold text-emerald-100 uppercase">Total Computado:</span>
            <span className="text-2xl font-black text-white">
              {rankingSummary.topMasHoras?.horasTrabajadas || 0} hs
            </span>
          </div>
        </Card>

        {/* PODIO 2: Trabajador con MENOS horas */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-2 -bottom-2 text-white/5 pointer-events-none">
            <TrendingDown size={100} />
          </div>

          <div className="space-y-2 relative z-10">
            <div className="flex items-center justify-between">
              <span className="bg-rose-500/20 text-rose-300 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Menor Carga / Ausentismo
              </span>
              <ArrowDownRight className="w-5 h-5 text-rose-400" />
            </div>

            <div>
              <h4 className="text-base font-black leading-tight text-white">
                {rankingSummary.topMenosHoras?.nombre || 'Sin registros'}
              </h4>
              <p className="text-xs text-slate-300 font-medium capitalize">
                {rankingSummary.topMenosHoras?.specialty || 'Operario de Obra'}
              </p>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-white/10 flex items-baseline justify-between relative z-10">
            <span className="text-xs font-bold text-slate-400 uppercase">Horas Registradas:</span>
            <div className="text-right">
              <span className="text-2xl font-black text-rose-400">
                {rankingSummary.topMenosHoras?.horasTrabajadas || 0} hs
              </span>
              <span className="text-[10px] block text-slate-400">
                ({rankingSummary.topMenosHoras?.diasAusente || 0} inasistencias)
              </span>
            </div>
          </div>
        </Card>

        {/* KPI 3: Presentismo Global & Promedio */}
        <Card className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {metricasPorTrabajador.length} Operarios
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Presentismo General Empresa</span>
            <div className="text-2xl font-black text-slate-900 leading-tight">
              {rankingSummary.tasaPresentismoGlobal}%
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Promedio: <strong>{rankingSummary.promedioHorasOperario} hs</strong> por trabajador.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Total horas plantel:</span>
            <span className="font-black text-slate-900">{rankingSummary.totalHorasGeneral} hs</span>
          </div>
        </Card>

        {/* KPI 4: Bonos & Llegadas Tardes */}
        <Card className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              <Award className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              +{porcentajeBono}% Bono
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Califican a Bonificación</span>
            <div className="text-2xl font-black text-emerald-700 leading-tight">
              {rankingSummary.calificanBonoCount} <span className="text-xs font-bold text-slate-400">/ {metricasPorTrabajador.length}</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Llegadas tardes registradas: <strong className="text-amber-600">{rankingSummary.totalLlegadasTarde}</strong>
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Meta de horas:</span>
            <span className="font-black text-slate-900">{horasObjetivo} hs</span>
          </div>
        </Card>

      </div>

      {/* =================================================================== */}
      {/* GRÁFICOS ANALÍTICOS: RANKING TOP 10 Y DISTRIBUCIÓN DE NOVEDADES     */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico 1: Ranking Top 10 Trabajadores por Horas */}
        <Card className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Ranking de Horas Trabajadas (Top 10)</span>
              </h4>
              <p className="text-xs text-slate-400">
                Comparativa de horas acumuladas por operario en el período.
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataChartTopHoras} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} 
                  angle={-30} 
                  textAnchor="end" 
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  formatter={(value: any) => [`${value} hs`, 'Horas']}
                  labelFormatter={(label: any) => `Operario: ${label}`}
                  contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="horas" radius={[8, 8, 0, 0]}>
                  {dataChartTopHoras.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.superaMeta ? '#10b981' : '#3b82f6'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Gráfico 2: Torta de Distribución de Incidencias */}
        <Card className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-rose-500" />
              <span>Distribución de Asistencia & Licencias</span>
            </h4>
            <p className="text-xs text-slate-400">
              Proporción de motivos de inasistencia registrados.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataChartMotivos}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {dataChartMotivos.map((entry, index) => (
                    <Cell key={`pie-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any) => [`${val} registros`, 'Cantidad']}
                  contentStyle={{ borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend 
                  layout="horizontal" 
                  verticalAlign="bottom" 
                  align="center" 
                  wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </div>

      {/* =================================================================== */}
      {/* TABLA: ALERTAS DE RRHH Y SEGUIMIENTO ACTIVO                         */}
      {/* =================================================================== */}
      {alertasRRHH.length > 0 && (
        <Card className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center font-black">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Alertas y Casos para Seguimiento de RRHH
                </h4>
                <p className="text-xs text-slate-400">
                  Operarios con inasistencias reiteradas, licencias médicas o desempeño destacado.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-rose-100 text-rose-800">
              {alertasRRHH.length} Alertas
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
            {alertasRRHH.map((alerta, i) => (
              <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 rounded-xl px-2 transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">{alerta.nombre}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.2 rounded-md ${
                      alerta.severidad === 'alta' 
                        ? 'bg-rose-100 text-rose-800' 
                        : alerta.severidad === 'media'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {alerta.tipo.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">{alerta.mensaje}</p>
                </div>

                {alerta.whatsapp && (
                  <Button
                    onClick={() => handleContact(alerta.whatsapp, alerta.nombre)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl px-3 py-1.5 flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* =================================================================== */}
      {/* TABLA CONSOLIDADA: DETALLE COMPLETO DE CADA TRABAJADOR              */}
      {/* =================================================================== */}
      <Card className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
        <div className="bg-[#031530] text-white p-4 font-black text-sm uppercase tracking-wide flex items-center justify-between">
          <span>TABLA CONSOLIDADA DE HORAS & PRESENTISMO ({metricasPorTrabajador.length} TRABAJADORES)</span>
          <span className="text-xs text-blue-300">Ordenado por Horas Trabajadas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 text-center">#</th>
                <th className="py-3 px-4">Trabajador</th>
                <th className="py-3 px-4">Especialidad</th>
                <th className="py-3 px-4">Obra</th>
                <th className="py-3 px-4 text-right">Horas Netas</th>
                <th className="py-3 px-4 text-center">Jornadas</th>
                <th className="py-3 px-4 text-center">Llegadas Tardes</th>
                <th className="py-3 px-4 text-center">Salud</th>
                <th className="py-3 px-4 text-center">Faltas No Just.</th>
                <th className="py-3 px-4 text-center">Bono (+10%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metricasPorTrabajador.map((t, idx) => {
                const califica = t.horasTrabajadas >= horasObjetivo;
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-black text-slate-900">{t.nombre}</td>
                    <td className="py-3 px-4 text-slate-500 capitalize">{t.specialty || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{t.obraPrincipal}</td>
                    <td className="py-3 px-4 text-right font-black text-sm text-slate-900">
                      {t.horasTrabajadas} hs
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{t.diasPresente}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-bold ${t.llegadasTarde > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {t.llegadasTarde}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-bold ${t.enfermedad > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {t.enfermedad}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-bold ${t.noJustificadas > 0 ? 'text-rose-700 font-black' : 'text-slate-400'}`}>
                        {t.noJustificadas}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {califica ? (
                        <span className="bg-emerald-100 text-emerald-900 text-[9px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
                          CALIFICA
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">No alcanza</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
