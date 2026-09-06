import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DollarSign, 
  Clock, 
  Calendar, 
  TrendingUp, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Sparkles, 
  ChevronRight, 
  Download, 
  Printer, 
  X,
  History,
  Calculator,
  CalendarDays,
  Coins,
  ArrowUpRight,
  ShieldCheck,
  Send,
  Phone,
  FileSpreadsheet
} from 'lucide-react';
import { buildWhatsAppLink } from '../lib/whatsapp';
import * as XLSX from 'xlsx';

export interface EmpleadoSueldo {
  id: string;
  full_name: string;
  specialty?: string | null;
  whatsapp?: string | null;
  photo_url?: string | null;
  obra_id?: string | null;
  obras?: { name: string } | null;
  valor_hora?: number | null;
  valor_hora_extra?: number | null;
  dni?: string | null;
  fecha_ingreso?: string | null;
}

export interface NovedadRegistro {
  id: string;
  empleado_id?: string;
  empleado_nombre: string;
  empleado_dni?: string;
  fecha: string;
  mes?: string;
  quincena?: string;
  obra_id?: string;
  obra_nombre?: string;
  horas_trabajadas: number;
  horas_ausente?: number;
  estado: string;
  tipo_licencia?: string;
  certificado_medico?: boolean;
  observaciones?: string;
}

interface ObreroSueldoProyeccionesProps {
  empleado: EmpleadoSueldo;
  novedades: NovedadRegistro[];
  valorHora: number;
  onUpdateValorHora: (val: number) => void;
  adelanto: number;
  onUpdateAdelanto: (val: number) => void;
  porcentajeBonoPresentismo: number;
  onClose: () => void;
  onPrintReceipt?: () => void;
}

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_SEMANA_COMPLETO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ObreroSueldoProyecciones({
  empleado,
  novedades,
  valorHora,
  onUpdateValorHora,
  adelanto,
  onUpdateAdelanto,
  porcentajeBonoPresentismo,
  onClose,
  onPrintReceipt
}: ObreroSueldoProyeccionesProps) {
  
  // Pestañas internas del detalle del obrero
  const [activeSubTab, setActiveSubTab] = useState<'mes_actual' | 'quincena_dia' | 'historico' | 'proyecciones'>('mes_actual');
  
  // Período de análisis
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMes, setSelectedMes] = useState<string>('AGOSTO');
  const [selectedQuincena, setSelectedQuincena] = useState<'1Q' | '2Q'>('2Q');

  // Tarifa editable temporal
  const [tempValorHora, setTempValorHora] = useState<number>(valorHora || 4500);
  const [isEditingTarifa, setIsEditingTarifa] = useState(false);

  // 1. Novedades del empleado (matching inteligente por ID, DNI o palabras clave del nombre)
  const empNovedadesHistoricas = useMemo(() => {
    const empNorm = normalizeText(empleado.full_name);
    const empWords = empNorm.split(' ').filter(w => w.length > 2);
    const empDni = empleado.dni?.trim();

    return novedades.filter(n => {
      if (n.empleado_id && n.empleado_id === empleado.id) return true;
      if (empDni && n.empleado_dni && n.empleado_dni.trim() === empDni) return true;
      
      const novNorm = normalizeText(n.empleado_nombre);
      if (novNorm === empNorm) return true;
      
      // Match si contiene al menos 2 palabras clave del nombre
      const matchingWords = empWords.filter(w => novNorm.includes(w));
      return matchingWords.length >= 2;
    }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [novedades, empleado]);

  // 2. Novedades del mes seleccionado
  const empNovedadesMes = useMemo(() => {
    return empNovedadesHistoricas.filter(n => {
      if (n.mes && n.mes.toUpperCase().trim() === selectedMes) return true;
      if (n.fecha) {
        const parts = n.fecha.split('-');
        const mIdx = Number(parts[1]) - 1;
        return MESES[mIdx] === selectedMes;
      }
      return false;
    });
  }, [empNovedadesHistoricas, selectedMes]);

  // 3. Novedades de la quincena seleccionada
  const empNovedadesQuincena = useMemo(() => {
    return empNovedadesMes.filter(n => {
      if (n.quincena && n.quincena.toUpperCase().trim() === selectedQuincena) return true;
      if (n.fecha) {
        const day = Number(n.fecha.split('-')[2]);
        const q = day <= 15 ? '1Q' : '2Q';
        return q === selectedQuincena;
      }
      return false;
    });
  }, [empNovedadesMes, selectedQuincena]);

  // =========================================================================
  // CÁLCULO 1: ¿CUÁNTO VA A COBRAR ESTE MES? (Real Devengado + Proyección)
  // =========================================================================
  const mesActualCalculos = useMemo(() => {
    // Horas reales ya registradas en el mes
    const horasReales = empNovedadesMes.reduce((acc, curr) => acc + (Number(curr.horas_trabajadas) || 0), 0);
    const diasTrabajadosReales = empNovedadesMes.filter(n => (Number(n.horas_trabajadas) || 0) > 0).length;
    const inasistencias = empNovedadesMes.filter(n => n.estado === 'AUSENTE').length;
    const llegadasTarde = empNovedadesMes.filter(n => n.estado === 'LLEGADA TARDE').length;

    // Estimar días hábiles del mes completo (Lunes a Viernes = 21 o 22 días laborables)
    const mIdx = MESES.indexOf(selectedMes);
    const totalDiasMes = new Date(selectedYear, mIdx + 1, 0).getDate();
    
    let diasHabilesTotales = 0;
    for (let day = 1; day <= totalDiasMes; day++) {
      const d = new Date(selectedYear, mIdx, day);
      const dayOfWeek = d.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Lunes a Viernes
        diasHabilesTotales++;
      }
    }

    // Promedio de horas por día laborable del obrero (base 8.8 hs)
    const promedioHorasPorDia = diasTrabajadosReales > 0 
      ? Math.round((horasReales / diasTrabajadosReales) * 10) / 10 
      : 8.8;

    // Días hábiles que faltan completar
    const diasHabilesRestantes = Math.max(0, diasHabilesTotales - diasTrabajadosReales);
    const horasProyectadasRestantes = Math.round(diasHabilesRestantes * promedioHorasPorDia * 10) / 10;
    const horasTotalesEstimadasMes = Math.round((horasReales + horasProyectadasRestantes) * 10) / 10;

    // Subtotales en Pesos
    const subtotalDevengadoHoy = Math.round(horasReales * valorHora);
    const subtotalProyectadoRestante = Math.round(horasProyectadasRestantes * valorHora);
    const subtotalBrutoEstimadoMes = Math.round(horasTotalesEstimadasMes * valorHora);

    // Bono Presentismo (+10%) si no tiene faltas no justificadas
    const cumplePresentismo = inasistencias === 0 && llegadasTarde <= 1;
    const bonoPresentismo = cumplePresentismo ? Math.round((subtotalBrutoEstimadoMes * porcentajeBonoPresentismo) / 100) : 0;
    const bonoDevengadoHoy = cumplePresentismo ? Math.round((subtotalDevengadoHoy * porcentajeBonoPresentismo) / 100) : 0;

    // Total Neto Estimado
    const totalNetoEstimadoMes = Math.max(0, subtotalBrutoEstimadoMes + bonoPresentismo - adelanto);
    const totalNetoDevengadoHoy = Math.max(0, subtotalDevengadoHoy + bonoDevengadoHoy - adelanto);

    return {
      horasReales,
      diasTrabajadosReales,
      inasistencias,
      llegadasTarde,
      diasHabilesTotales,
      diasHabilesRestantes,
      promedioHorasPorDia,
      horasProyectadasRestantes,
      horasTotalesEstimadasMes,
      subtotalDevengadoHoy,
      subtotalProyectadoRestante,
      subtotalBrutoEstimadoMes,
      cumplePresentismo,
      bonoPresentismo,
      bonoDevengadoHoy,
      totalNetoDevengadoHoy,
      totalNetoEstimadoMes
    };
  }, [empNovedadesMes, selectedMes, selectedYear, valorHora, porcentajeBonoPresentismo, adelanto]);

  // =========================================================================
  // CÁLCULO 2: ¿CUÁNTO VA COBRANDO DESDE QUE SE TIENE REGISTRO? (HISTÓRICO)
  // =========================================================================
  const historicoCalculos = useMemo(() => {
    const totalHoras = empNovedadesHistoricas.reduce((acc, curr) => acc + (Number(curr.horas_trabajadas) || 0), 0);
    const totalAusencias = empNovedadesHistoricas.filter(n => n.estado === 'AUSENTE').length;
    const totalLlegadasTarde = empNovedadesHistoricas.filter(n => n.estado === 'LLEGADA TARDE').length;
    const totalMontoHistorico = Math.round(totalHoras * valorHora);

    // Agrupar por mes y quincena
    const periodosMap = new Map<string, {
      periodoKey: string;
      mes: string;
      quincena: string;
      horas: number;
      dias: number;
      monto: number;
      ausencias: number;
    }>();

    empNovedadesHistoricas.forEach(n => {
      let m = (n.mes || 'AGOSTO').toUpperCase().trim();
      let q = (n.quincena || '2Q').toUpperCase().trim();
      if (n.fecha) {
        const parts = n.fecha.split('-');
        m = MESES[Number(parts[1]) - 1] || m;
        q = Number(parts[2]) <= 15 ? '1Q' : '2Q';
      }

      const key = `${m}_${q}`;
      let p = periodosMap.get(key);
      if (!p) {
        p = {
          periodoKey: key,
          mes: m,
          quincena: q,
          horas: 0,
          dias: 0,
          monto: 0,
          ausencias: 0
        };
        periodosMap.set(key, p);
      }

      const hs = Number(n.horas_trabajadas) || 0;
      p.horas += hs;
      if (hs > 0) p.dias += 1;
      if (n.estado === 'AUSENTE') p.ausencias += 1;
      p.monto += Math.round(hs * valorHora);
    });

    const periodosList = Array.from(periodosMap.values()).sort((a, b) => {
      const idxA = MESES.indexOf(a.mes);
      const idxB = MESES.indexOf(b.mes);
      if (idxA !== idxB) return idxB - idxA;
      return b.quincena.localeCompare(a.quincena);
    });

    return {
      totalHoras,
      totalAusencias,
      totalLlegadasTarde,
      totalMontoHistorico,
      totalQuincenas: periodosList.length,
      periodosList
    };
  }, [empNovedadesHistoricas, valorHora]);

  // =========================================================================
  // CÁLCULO 3: ¿CUÁNTO COBRARÁ LOS PRÓXIMOS MESES? (PROYECCIONES A FUTURO)
  // =========================================================================
  const proyeccionesFuturas = useMemo(() => {
    const list = [];
    const currentMIdx = MESES.indexOf(selectedMes);

    for (let offset = 1; offset <= 4; offset++) {
      const targetMIdx = (currentMIdx + offset) % 12;
      const targetYear = selectedYear + Math.floor((currentMIdx + offset) / 12);
      const mesName = MESES[targetMIdx];

      // Días hábiles del mes objetivo
      const totalDias = new Date(targetYear, targetMIdx + 1, 0).getDate();
      let diasHabiles = 0;
      for (let day = 1; day <= totalDias; day++) {
        const d = new Date(targetYear, targetMIdx, day);
        const dayOfWeek = d.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) diasHabiles++;
      }

      // Horas proyectadas a 8.8 hs diarias (44 hs semanales)
      const horasProyectadas = Math.round(diasHabiles * 8.8);
      const sueldoBase = Math.round(horasProyectadas * valorHora);
      const bonoAsistencia = Math.round((sueldoBase * porcentajeBonoPresentismo) / 100);
      const sueldoConBono = sueldoBase + bonoAsistencia;

      // Si es Diciembre o Junio: incluye proyección de Aguinaldo (SAC ~50%)
      const esMesAguinaldo = mesName === 'DICIEMBRE' || mesName === 'JUNIO';
      const aguinaldoProyectado = esMesAguinaldo ? Math.round(sueldoConBono * 0.5) : 0;
      const totalConAguinaldo = sueldoConBono + aguinaldoProyectado;

      list.push({
        mes: mesName,
        year: targetYear,
        diasHabiles,
        horasProyectadas,
        sueldoBase,
        bonoAsistencia,
        sueldoConBono,
        esMesAguinaldo,
        aguinaldoProyectado,
        totalConAguinaldo
      });
    }

    return list;
  }, [selectedMes, selectedYear, valorHora, porcentajeBonoPresentismo]);

  // =========================================================================
  // CÁLCULO 4: DESGLOSE DE QUINCENA POR DÍA (DÍA A DÍA CON MONTO DIARIO)
  // =========================================================================
  const desgloseQuincenaDiaPorDia = useMemo(() => {
    const mIdx = MESES.indexOf(selectedMes);
    const startDay = selectedQuincena === '1Q' ? 1 : 16;
    const totalDiasMes = new Date(selectedYear, mIdx + 1, 0).getDate();
    const endDay = selectedQuincena === '1Q' ? 15 : totalDiasMes;

    // Mapa de novedades reales indexadas por día
    const novPorDiaMap = new Map<number, NovedadRegistro>();
    empNovedadesQuincena.forEach(n => {
      if (n.fecha) {
        const d = Number(n.fecha.split('-')[2]);
        novPorDiaMap.set(d, n);
      }
    });

    const rows = [];
    let acumuladoQuincena = 0;
    let horasAcumuladas = 0;

    for (let day = startDay; day <= endDay; day++) {
      const d = new Date(selectedYear, mIdx, day);
      const dayOfWeek = d.getDay();
      const diaNombre = DIAS_SEMANA_COMPLETO[dayOfWeek];
      const esDomingo = dayOfWeek === 0;
      const esSabado = dayOfWeek === 6;

      const dateStr = `${selectedYear}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const novReal = novPorDiaMap.get(day);

      let horasDia = 0;
      let montoDia = 0;
      let estadoTipo: 'TRABAJADO' | 'AUSENTE' | 'PROYECTADO' | 'DESCANSO' | 'TARDE' = 'PROYECTADO';
      let detalle = '';

      if (novReal) {
        horasDia = Number(novReal.horas_trabajadas) || 0;
        montoDia = Math.round(horasDia * valorHora);

        if (novReal.estado === 'AUSENTE') {
          estadoTipo = 'AUSENTE';
          detalle = novReal.tipo_licencia || 'Inasistencia';
        } else if (novReal.estado === 'LLEGADA TARDE') {
          estadoTipo = 'TARDE';
          detalle = 'Ingreso fuera de horario';
        } else {
          estadoTipo = 'TRABAJADO';
          detalle = novReal.obra_nombre ? `Obra: ${novReal.obra_nombre}` : 'Jornada Cumplida';
        }
      } else if (esDomingo) {
        estadoTipo = 'DESCANSO';
        horasDia = 0;
        montoDia = 0;
        detalle = 'Franco Semanal';
      } else if (esSabado) {
        estadoTipo = 'DESCANSO';
        horasDia = 0;
        montoDia = 0;
        detalle = 'Sábado no laborable';
      } else {
        // Día Hábil sin registro -> Proyección estimada
        estadoTipo = 'PROYECTADO';
        horasDia = 8.8; // Estándar 44hs semanales
        montoDia = Math.round(horasDia * valorHora);
        detalle = 'Jornada Proyectada (8.8 hs)';
      }

      horasAcumuladas += horasDia;
      acumuladoQuincena += montoDia;

      rows.push({
        dia: day,
        fechaStr: dateStr,
        diaNombre,
        diaAbrev: DIAS_SEMANA[dayOfWeek],
        esDomingo,
        esSabado,
        tieneRegistroReal: !!novReal,
        estadoTipo,
        detalle,
        horasDia,
        montoDia,
        horasAcumuladas: Math.round(horasAcumuladas * 10) / 10,
        acumuladoQuincena
      });
    }

    return rows;
  }, [selectedMes, selectedYear, selectedQuincena, empNovedadesQuincena, valorHora]);

  // Exportar ficha del obrero a Excel
  const handleExportObreroExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Hoja Desglose Día por Día
    const dataDias = desgloseQuincenaDiaPorDia.map(r => ({
      'Fecha': r.fechaStr,
      'Día': r.diaNombre,
      'Estado': r.estadoTipo,
      'Detalle': r.detalle,
      'Horas': r.horasDia,
      'Cobro Diario ($)': r.montoDia,
      'Horas Acumuladas': r.horasAcumuladas,
      'Acumulado Quincena ($)': r.acumuladoQuincena
    }));
    const wsDias = XLSX.utils.json_to_sheet(dataDias);
    XLSX.utils.book_append_sheet(wb, wsDias, `Quincena_${selectedQuincena}_Dias`);

    // 2. Hoja Historial Quincenas
    const dataHist = historicoCalculos.periodosList.map(p => ({
      'Período': `${p.mes} - ${p.quincena}`,
      'Horas Computadas': p.horas,
      'Jornadas Trabajadas': p.dias,
      'Ausencias': p.ausencias,
      'Subtotal Cobrado ($)': p.monto
    }));
    const wsHist = XLSX.utils.json_to_sheet(dataHist);
    XLSX.utils.book_append_sheet(wb, wsHist, 'Historial_Quincenas');

    // 3. Hoja Proyecciones Futuras
    const dataProy = proyeccionesFuturas.map(p => ({
      'Mes': `${p.mes} ${p.year}`,
      'Días Hábiles': p.diasHabiles,
      'Horas Proyectadas': p.horasProyectadas,
      'Sueldo Base ($)': p.sueldoBase,
      'Bono Asistencia (+10%)': p.bonoAsistencia,
      'Sueldo con Premio ($)': p.sueldoConBono,
      'Aguinaldo SAC ($)': p.aguinaldoProyectado,
      'Total Proyectado ($)': p.totalConAguinaldo
    }));
    const wsProy = XLSX.utils.json_to_sheet(dataProy);
    XLSX.utils.book_append_sheet(wb, wsProy, 'Proyecciones_Futuras');

    XLSX.writeFile(wb, `Ficha_Salarial_${normalizeText(empleado.full_name).replace(/\s+/g, '_')}_${selectedMes}.xlsx`);
  };

  const handleSendWhatsAppInfo = () => {
    if (!empleado.whatsapp) return;
    const msg = 
      `👋 *Hola ${empleado.full_name.split(' ')[0]}!*\n\n` +
      `Te compartimos la proyección estimada de tus haberes para *${selectedMes} (${selectedQuincena})*:\n` +
      `• *Horas Computadas:* ${mesActualCalculos.horasReales} hs reales + ${mesActualCalculos.horasProyectadasRestantes} hs estimadas\n` +
      `• *Valor Hora:* $${valorHora.toLocaleString('es-AR')}\n` +
      `• *Subtotal Bruto Estimado:* $${mesActualCalculos.subtotalBrutoEstimadoMes.toLocaleString('es-AR')}\n` +
      `• *Bono Asistencia Perfecta (+10%):* ${mesActualCalculos.cumplePresentismo ? `$${mesActualCalculos.bonoPresentismo.toLocaleString('es-AR')} (Califica 🏆)` : 'Sin premio'}\n` +
      (adelanto > 0 ? `• *Adelanto a descontar:* -$${adelanto.toLocaleString('es-AR')}\n` : '') +
      `💰 *Total Neto Estimado a Cobrar:* $${mesActualCalculos.totalNetoEstimadoMes.toLocaleString('es-AR')}\n\n` +
      `_PEIE Tools - Liquidación y Administración de Personal_`;
    
    window.open(buildWhatsAppLink(empleado.whatsapp, msg), '_blank');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* =================================================================== */}
      {/* TARJETA CABECERA DEL OBRERO SELECCIONADO                            */}
      {/* =================================================================== */}
      <Card className="rounded-3xl border-slate-200/90 shadow-sm bg-gradient-to-r from-[#031530] via-[#042454] to-[#031530] text-white p-5 sm:p-6 overflow-hidden relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-black text-xl overflow-hidden shrink-0 shadow-inner">
              {empleado.photo_url ? (
                <img src={empleado.photo_url} alt={empleado.full_name} className="w-full h-full object-cover" />
              ) : (
                <span>{empleado.full_name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {empleado.full_name}
                </h2>
                <span className="bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                  {empleado.specialty || 'Personal de Obra'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
                {empleado.dni && (
                  <span className="bg-white/10 px-2 py-0.5 rounded-md font-mono text-white text-[11px]">
                    DNI: <strong>{empleado.dni}</strong>
                  </span>
                )}
                <span>Obra: <strong className="text-white">{empleado.obras?.name || 'Obra Central'}</strong></span>
                {empleado.fecha_ingreso && (
                  <span>Ingreso: <strong className="text-white">{empleado.fecha_ingreso}</strong></span>
                )}
              </div>
            </div>
          </div>

          {/* Tarifa Valor Hora y Acciones Rápidas */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Box Tarifa / Valor Hora editable */}
            <div className="bg-white/10 border border-white/20 rounded-2xl p-2.5 px-3.5 flex items-center gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                  Valor Hora Actual
                </span>
                {isEditingTarifa ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Input
                      type="number"
                      value={tempValorHora}
                      onChange={(e) => setTempValorHora(Number(e.target.value))}
                      className="w-24 h-7 text-xs font-black bg-white text-slate-900 rounded-lg"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        onUpdateValorHora(tempValorHora);
                        setIsEditingTarifa(false);
                      }}
                      className="h-7 px-2 bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-bold rounded-lg"
                    >
                      OK
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1 mt-0.5 cursor-pointer" onClick={() => setIsEditingTarifa(true)} title="Hacé clic para cambiar la tarifa">
                    <span className="text-xl font-black text-amber-300">
                      ${valorHora.toLocaleString('es-AR')}
                    </span>
                    <span className="text-[11px] text-slate-300">/h</span>
                    <span className="text-[9px] text-amber-200/80 ml-1 underline">Editar</span>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleExportObreroExcel}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-2xl h-12 px-3 border border-white/20 flex items-center gap-1.5"
              title="Descargar Ficha y Proyecciones en Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Excel</span>
            </Button>

            {empleado.whatsapp && (
              <Button
                onClick={handleSendWhatsAppInfo}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl h-12 px-3 flex items-center gap-1.5 shadow-sm"
                title="Enviar resumen de sueldo por WhatsApp al obrero"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar WhatsApp</span>
              </Button>
            )}

            <Button
              onClick={onClose}
              variant="ghost"
              className="text-white hover:bg-white/20 rounded-2xl h-12 px-3"
              title="Cerrar y volver a la nómina general"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

        </div>
      </Card>

      {/* =================================================================== */}
      {/* BARRA DE SUB-PESTAÑAS DE NAVEGACIÓN                                 */}
      {/* =================================================================== */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'mes_actual', label: '💰 Cuánto cobrará este mes', icon: DollarSign },
            { id: 'quincena_dia', label: '📅 Quincena Día por Día', icon: CalendarDays },
            { id: 'historico', label: '📜 Histórico Acumulado', icon: History },
            { id: 'proyecciones', label: '📈 Próximos Meses (Proyección)', icon: TrendingUp }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
                  active
                    ? 'bg-[#031530] text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selectores de Período Rápido */}
        <div className="flex items-center gap-2 text-xs">
          <select
            value={selectedMes}
            onChange={(e) => setSelectedMes(e.target.value)}
            className="h-9 px-3 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 text-xs shadow-xs"
          >
            {MESES.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={selectedQuincena}
            onChange={(e) => setSelectedQuincena(e.target.value as any)}
            className="h-9 px-3 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 text-xs shadow-xs"
          >
            <option value="1Q">1º Quincena (1-15)</option>
            <option value="2Q">2º Quincena (16-31)</option>
          </select>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VISTA 1: ¿CUÁNTO COBRARÁ ESTE MES? (MES ACTUAL / EN CURSO)          */}
      {/* =================================================================== */}
      {activeSubTab === 'mes_actual' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Tarjetas Principales del Mes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* TOTAL ESTIMADO A COBRAR ESTE MES */}
            <Card className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-1 relative z-10">
                <span className="bg-white/20 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1 w-fit">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Estimado Mes Completo ({selectedMes})
                </span>
                <span className="text-xs text-emerald-100 font-bold block pt-1">Total Neto Proyectado</span>
                <div className="text-3xl font-black tracking-tight text-white">
                  ${mesActualCalculos.totalNetoEstimadoMes.toLocaleString('es-AR')}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-white/20 text-[11px] text-emerald-100 space-y-0.5 relative z-10">
                <div className="flex justify-between">
                  <span>Horas estimadas:</span>
                  <strong className="text-white">{mesActualCalculos.horasTotalesEstimadasMes} hs</strong>
                </div>
                <div className="flex justify-between">
                  <span>Bono Asistencia (+10%):</span>
                  <strong className="text-amber-200">{mesActualCalculos.cumplePresentismo ? `+$${mesActualCalculos.bonoPresentismo.toLocaleString('es-AR')}` : 'Sin bono'}</strong>
                </div>
              </div>
            </Card>

            {/* REAL DEVENGADO A LA FECHA */}
            <Card className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Devengado Hoy</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  ${mesActualCalculos.subtotalDevengadoHoy.toLocaleString('es-AR')}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {mesActualCalculos.horasReales} hs registradas en {mesActualCalculos.diasTrabajadosReales} jornadas.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
                <span>Promedio diario:</span>
                <strong className="text-slate-800">{mesActualCalculos.promedioHorasPorDia} hs/día</strong>
              </div>
            </Card>

            {/* PROYECCIÓN RESTANTE DEL MES */}
            <Card className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Restante Estimado</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-indigo-900">
                  ${mesActualCalculos.subtotalProyectadoRestante.toLocaleString('es-AR')}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {mesActualCalculos.horasProyectadasRestantes} hs estimadas en {mesActualCalculos.diasHabilesRestantes} días hábiles que faltan.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
                <span>Días hábiles del mes:</span>
                <strong className="text-slate-800">{mesActualCalculos.diasHabilesTotales} días</strong>
              </div>
            </Card>

            {/* ADELANTOS Y BONIFICACIÓN */}
            <Card className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Adelantos a Descontar
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-400">$</span>
                  <Input
                    type="number"
                    value={adelanto || ''}
                    placeholder="0"
                    onChange={(e) => onUpdateAdelanto(Number(e.target.value) || 0)}
                    className="h-9 font-black text-slate-900 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] flex items-center justify-between">
                <span>Premio Asistencia:</span>
                <span className={`font-black ${mesActualCalculos.cumplePresentismo ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {mesActualCalculos.cumplePresentismo ? `+10% ($${mesActualCalculos.bonoPresentismo.toLocaleString('es-AR')})` : 'Perdido'}
                </span>
              </div>
            </Card>

          </div>

          {/* Desglose Explicativo de la Liquidación */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-peie-blue" />
              <span>Detalle del Cálculo Proyectado ({selectedMes} {selectedYear})</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                <span className="font-black text-slate-700 block uppercase text-[10px] tracking-wider">
                  Cómputo de Horas y Asistencia
                </span>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Horas trabajadas efectivas (a hoy):</span>
                  <span className="font-bold text-slate-900">{mesActualCalculos.horasReales} hs</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Jornadas asistidas:</span>
                  <span className="font-bold text-slate-900">{mesActualCalculos.diasTrabajadosReales} días</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Faltas e inasistencias:</span>
                  <span className={`font-bold ${mesActualCalculos.inasistencias > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {mesActualCalculos.inasistencias}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Días hábiles restantes proyectados:</span>
                  <span className="font-bold text-indigo-700">{mesActualCalculos.diasHabilesRestantes} días ({mesActualCalculos.horasProyectadasRestantes} hs)</span>
                </div>
                <div className="flex justify-between pt-1 text-slate-900 font-black">
                  <span>Total horas base estimadas:</span>
                  <span>{mesActualCalculos.horasTotalesEstimadasMes} hs</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                <span className="font-black text-slate-700 block uppercase text-[10px] tracking-wider">
                  Composición Salarial en Pesos
                </span>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Subtotal horas trabajadas (a la fecha):</span>
                  <span className="font-bold text-slate-900">${mesActualCalculos.subtotalDevengadoHoy.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Subtotal horas proyectadas restantes:</span>
                  <span className="font-bold text-indigo-700">+${mesActualCalculos.subtotalProyectadoRestante.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Bono Asistencia (+10%):</span>
                  <span className="font-bold text-emerald-700">+${mesActualCalculos.bonoPresentismo.toLocaleString('es-AR')}</span>
                </div>
                {adelanto > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Deducción de adelanto:</span>
                    <span className="font-bold text-rose-600">-${adelanto.toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-slate-900 font-black text-sm">
                  <span>Neto Total Proyectado:</span>
                  <span className="text-emerald-700">${mesActualCalculos.totalNetoEstimadoMes.toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>
          </Card>

        </div>
      )}

      {/* =================================================================== */}
      {/* VISTA 2: DESGLOSE DE QUINCENA DÍA POR DÍA                          */}
      {/* =================================================================== */}
      {activeSubTab === 'quincena_dia' && (
        <div className="space-y-4 animate-fadeIn">
          
          <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">
                Desglose Quincenal Día por Día • {selectedMes} ({selectedQuincena === '1Q' ? '1 al 15' : '16 al fin de mes'})
              </h4>
              <p className="text-xs text-slate-500">
                Seguimiento jornada a jornada con el monto devengado en cada día y el acumulado en tiempo real.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Total Quincena:</span>
              <span className="text-lg font-black text-emerald-700">
                ${desgloseQuincenaDiaPorDia[desgloseQuincenaDiaPorDia.length - 1]?.acumuladoQuincena.toLocaleString('es-AR') || 0}
              </span>
            </div>
          </div>

          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Día</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Detalle / Obra</th>
                    <th className="py-3 px-4 text-center">Horas</th>
                    <th className="py-3 px-4 text-right">Cobro Diario</th>
                    <th className="py-3 px-4 text-right">Acumulado Quincena</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {desgloseQuincenaDiaPorDia.map((row, idx) => (
                    <tr 
                      key={idx} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.esDomingo ? 'bg-slate-50/50 opacity-70' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{row.fechaStr}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">{row.diaNombre}</td>
                      <td className="py-3 px-4">
                        {row.estadoTipo === 'TRABAJADO' && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
                            TRABAJADO
                          </span>
                        )}
                        {row.estadoTipo === 'TARDE' && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-200">
                            LLEGADA TARDE
                          </span>
                        )}
                        {row.estadoTipo === 'AUSENTE' && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-200">
                            AUSENTE
                          </span>
                        )}
                        {row.estadoTipo === 'PROYECTADO' && (
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                            PROYECTADO
                          </span>
                        )}
                        {row.estadoTipo === 'DESCANSO' && (
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            FRANCO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{row.detalle}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {row.horasDia > 0 ? `${row.horasDia} hs` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {row.montoDia > 0 ? `$${row.montoDia.toLocaleString('es-AR')}` : '$0'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono">
                        ${row.acumuladoQuincena.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      )}

      {/* =================================================================== */}
      {/* VISTA 3: ¿CUÁNTO VA COBRANDO DESDE QUE SE TIENE REGISTRO?           */}
      {/* =================================================================== */}
      {activeSubTab === 'historico' && (
        <div className="space-y-4 animate-fadeIn">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-3xl border-slate-200 p-5 bg-white shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Total Histórico Cobrado
              </span>
              <div className="text-3xl font-black text-slate-900">
                ${historicoCalculos.totalMontoHistorico.toLocaleString('es-AR')}
              </div>
              <p className="text-xs text-slate-500 mt-1">Calculado con la tarifa horaria base.</p>
            </Card>

            <Card className="rounded-3xl border-slate-200 p-5 bg-white shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Horas Totales Acumuladas
              </span>
              <div className="text-3xl font-black text-blue-700">
                {historicoCalculos.totalHoras.toLocaleString('es-AR')} hs
              </div>
              <p className="text-xs text-slate-500 mt-1">En {historicoCalculos.totalQuincenas} períodos registrados.</p>
            </Card>

            <Card className="rounded-3xl border-slate-200 p-5 bg-white shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Ausencias Registradas
              </span>
              <div className="text-3xl font-black text-rose-600">
                {historicoCalculos.totalAusencias}
              </div>
              <p className="text-xs text-slate-500 mt-1">Total de días no asistidos en el historial.</p>
            </Card>
          </div>

          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <div className="bg-[#031530] text-white p-4 font-black text-xs uppercase tracking-wide flex justify-between">
              <span>Historial Período por Período</span>
              <span className="text-blue-200">{historicoCalculos.periodosList.length} Quincenas Registradas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Período / Quincena</th>
                    <th className="py-3 px-4 text-center">Jornadas Asistidas</th>
                    <th className="py-3 px-4 text-center">Ausencias</th>
                    <th className="py-3 px-4 text-right">Horas Computadas</th>
                    <th className="py-3 px-4 text-right">Subtotal Facturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historicoCalculos.periodosList.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">
                        {p.mes} • {p.quincena}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">{p.dias} días</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold ${p.ausencias > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {p.ausencias}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">{p.horas} hs</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700">
                        ${p.monto.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      )}

      {/* =================================================================== */}
      {/* VISTA 4: ¿CUÁNTO COBRARÁ LOS PRÓXIMOS MESES? (PROYECCIÓN FUTURA)    */}
      {/* =================================================================== */}
      {activeSubTab === 'proyecciones' && (
        <div className="space-y-4 animate-fadeIn">
          
          <div className="bg-amber-50 border border-amber-200/80 rounded-3xl p-4 flex items-start gap-3">
            <Coins className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <strong className="block font-black text-sm">Estimaciones y Proyecciones Salariales</strong>
              <p>
                Los montos futuros están calculados sobre la base de una jornada completa estándar (44 hs semanales / ~180 a 192 hs mensuales) con la tarifa horaria actual (${valorHora.toLocaleString('es-AR')}/h). En los meses de Junio y Diciembre se calcula automáticamente la proyección del Sueldo Anual Complementario (Aguinaldo).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {proyeccionesFuturas.map((proy, idx) => (
              <Card key={idx} className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      +{idx + 1} Mes
                    </span>
                    {proy.esMesAguinaldo && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        + Aguinaldo (SAC)
                      </span>
                    )}
                  </div>

                  <h4 className="text-lg font-black text-slate-900 pt-1">
                    {proy.mes} {proy.year}
                  </h4>
                  <span className="text-xs text-slate-500 font-medium block">
                    {proy.diasHabiles} días laborables • {proy.horasProyectadas} hs
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Sueldo Base:</span>
                    <strong className="text-slate-900">${proy.sueldoBase.toLocaleString('es-AR')}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Premio Asistencia (+10%):</span>
                    <strong className="text-emerald-700">+${proy.bonoAsistencia.toLocaleString('es-AR')}</strong>
                  </div>
                  {proy.esMesAguinaldo && (
                    <div className="flex justify-between text-amber-700 font-bold">
                      <span>Aguinaldo (SAC 50%):</span>
                      <strong>+${proy.aguinaldoProyectado.toLocaleString('es-AR')}</strong>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200/60">
                    <span>Total Estimado:</span>
                    <span className="text-emerald-700">${proy.totalConAguinaldo.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

        </div>
      )}

    </div>
  );
}
