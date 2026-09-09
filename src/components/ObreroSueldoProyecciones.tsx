import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DollarSign, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  X,
  History,
  Calculator,
  CalendarDays,
  Coins,
  ShieldCheck,
  Send,
  FileSpreadsheet
} from 'lucide-react';
import { buildWhatsAppLink } from '../lib/whatsapp';
import {
  PAYROLL_MONTHS,
  LAST_CLOSED_PAYROLL_PERIOD,
  LAST_CLOSED_PAYROLL_PERIOD_LABEL,
  isAfterLastClosedPayrollPeriod,
  isPayrollBusinessDay,
  parsePayrollDate,
  type PayrollPeriodMode
} from '../lib/payroll-period';
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

export interface ResumenPeriodoSueldo {
  horasCalculadasBase: number;
  horasProyectadas: number;
  horasFinales: number;
  promedioHorasDia: number;
  diasHabilesPeriodo: number;
  diasCubiertos: number;
  ajusteManualHoras: boolean;
  horasAusente: number;
  diasPresente: number;
  diasAusente: number;
  sueldoBruto: number;
  bonoPresentismo: number;
  cumplePresentismo: boolean;
  estadoBonoPresentismo: string;
  totalNeto: number;
  horasRegistradasPorFecha: Record<string, number>;
}

interface ObreroSueldoProyeccionesProps {
  empleado: EmpleadoSueldo;
  novedades: NovedadRegistro[];
  valorHora: number;
  onUpdateValorHora: (val: number) => void;
  adelanto: number;
  onUpdateAdelanto: (val: number) => void;
  porcentajeBonoPresentismo: number;
  periodYear: number;
  periodMonth: string;
  availableYears: number[];
  periodMode: PayrollPeriodMode;
  resumenPeriodo: ResumenPeriodoSueldo;
  onChangePeriodYear: (year: number) => void;
  onChangePeriodMonth: (month: string) => void;
  onChangePeriodMode: (mode: PayrollPeriodMode) => void;
  onClose: () => void;
}

const MESES = PAYROLL_MONTHS;

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_SEMANA_COMPLETO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function getFechaParts(fecha: string | null | undefined): { year: number; monthIndex: number; day: number } | null {
  const date = parsePayrollDate(fecha);
  if (!date) return null;
  return { year: date.getFullYear(), monthIndex: date.getMonth(), day: date.getDate() };
}

function isPeriodoPosteriorAlCierre(year: number, mes: string): boolean {
  return isAfterLastClosedPayrollPeriod(year, mes);
}

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
  periodYear: selectedYear,
  periodMonth: selectedMes,
  availableYears,
  periodMode,
  resumenPeriodo,
  onChangePeriodYear,
  onChangePeriodMonth,
  onChangePeriodMode,
  onClose
}: ObreroSueldoProyeccionesProps) {
  
  // Pestañas internas del detalle del obrero
  const [activeSubTab, setActiveSubTab] = useState<'mes_actual' | 'quincena_dia' | 'historico' | 'proyecciones'>(
    periodMode === 'HISTORICO' ? 'historico' : 'mes_actual'
  );
  
  // La nómina y la ficha comparten año y mes para evitar cálculos cruzados.
  const [selectedQuincena, setSelectedQuincena] = useState<'1Q' | '2Q'>(
    periodMode === '1Q' ? '1Q' : '2Q'
  );

  // Tarifa editable temporal
  const [tempValorHora, setTempValorHora] = useState<number>(valorHora || 4500);
  const [isEditingTarifa, setIsEditingTarifa] = useState(false);

  // El corte compartido define qué períodos son cerrados y cuáles proyectados.
  const isPeriodoProyectado = useMemo(() => {
    return periodMode !== 'HISTORICO' && isPeriodoPosteriorAlCierre(selectedYear, selectedMes);
  }, [periodMode, selectedMes, selectedYear]);

  // 1. Novedades del empleado (matching inteligente por ID, DNI o palabras clave del nombre)
  const empNovedadesHistoricas = useMemo(() => {
    const empNorm = normalizeText(empleado.full_name);
    const empWords = empNorm.split(' ').filter(w => w.length > 2);
    const empDni = empleado.dni?.trim();
    const fechaIngreso = parsePayrollDate(empleado.fecha_ingreso);

    return novedades.filter(n => {
      const fechaParts = getFechaParts(n.fecha);
      if (!fechaParts || fechaParts.year !== selectedYear) return false;
      const fechaRegistro = parsePayrollDate(n.fecha);
      if (!fechaRegistro || (fechaIngreso && fechaRegistro < fechaIngreso)) return false;
      if (n.empleado_id && n.empleado_id === empleado.id) return true;
      if (empDni && n.empleado_dni && n.empleado_dni.trim() === empDni) return true;
      
      const novNorm = normalizeText(n.empleado_nombre);
      if (novNorm === empNorm) return true;
      
      // Match si contiene al menos 2 palabras clave del nombre
      const matchingWords = empWords.filter(w => novNorm.includes(w));
      return matchingWords.length >= 2;
    }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [novedades, empleado, selectedYear]);

  // 2. Novedades del mes seleccionado
  const empNovedadesMes = useMemo(() => {
    return empNovedadesHistoricas.filter(n => {
      const fechaParts = getFechaParts(n.fecha);
      if (!fechaParts || fechaParts.year !== selectedYear) return false;

      const mesFecha = MESES[fechaParts.monthIndex];
      return mesFecha === selectedMes;
    });
  }, [empNovedadesHistoricas, selectedMes, selectedYear]);

  // 3. Novedades de la quincena seleccionada
  const empNovedadesQuincena = useMemo(() => {
    return empNovedadesMes.filter(n => {
      const fechaParts = getFechaParts(n.fecha);
      if (!fechaParts) return false;
      const q = fechaParts.day <= 15 ? '1Q' : '2Q';
      return q === selectedQuincena;
    });
  }, [empNovedadesMes, selectedQuincena]);

  // =========================================================================
  // CÁLCULO 1: ¿CUÁNTO VA A COBRAR ESTE MES? (Real Devengado + Proyección)
  // =========================================================================
  const mesActualCalculosLocales = useMemo(() => {
    // Horas reales ya registradas en el mes
    const horasReales = empNovedadesMes.reduce((acc, curr) => acc + (Number(curr.horas_trabajadas) || 0), 0);
    const diasTrabajadosReales = new Set(
      empNovedadesMes
        .filter(n => (Number(n.horas_trabajadas) || 0) > 0)
        .map(n => getFechaParts(n.fecha)?.day)
        .filter((day): day is number => day !== undefined)
    ).size;
    const inasistencias = empNovedadesMes.filter(n => n.estado === 'AUSENTE').length;
    const llegadasTarde = empNovedadesMes.filter(n => n.estado === 'LLEGADA TARDE').length;

    // Estimar los días hábiles del mes con el calendario laboral compartido.
    const mIdx = MESES.indexOf(selectedMes);
    const totalDiasMes = new Date(selectedYear, mIdx + 1, 0).getDate();
    const inicioMes = new Date(selectedYear, mIdx, 1);
    const finMes = new Date(selectedYear, mIdx, totalDiasMes);
    const ingresoParts = getFechaParts(empleado.fecha_ingreso);
    const fechaIngreso = ingresoParts
      ? new Date(ingresoParts.year, ingresoParts.monthIndex, ingresoParts.day)
      : null;
    const inicioComputable = fechaIngreso && fechaIngreso > inicioMes ? fechaIngreso : inicioMes;
    
    let diasHabilesTotales = 0;
    for (let day = inicioComputable <= finMes ? inicioComputable.getDate() : totalDiasMes + 1; day <= totalDiasMes; day++) {
      const d = new Date(selectedYear, mIdx, day);
      if (isPayrollBusinessDay(d)) {
        diasHabilesTotales++;
      }
    }

    // Promedio de horas por día laborable del obrero (base 8.8 hs)
    const promedioHorasPorDia = diasTrabajadosReales > 0 
      ? Math.round((horasReales / diasTrabajadosReales) * 10) / 10 
      : 8.8;

    // Para períodos abiertos, proyectar únicamente días hábiles que no tienen ningún
    // registro. En períodos cerrados nunca se completan horas faltantes artificialmente.
    const diasHabilesConRegistro = new Set(
      empNovedadesMes
        .map(n => getFechaParts(n.fecha))
        .filter((parts): parts is { year: number; monthIndex: number; day: number } => parts !== null)
        .filter(parts => {
          const fecha = new Date(parts.year, parts.monthIndex, parts.day);
          if (fecha < inicioComputable || fecha > finMes) return false;
          return isPayrollBusinessDay(fecha);
        })
        .map(parts => parts.day)
    ).size;
    const diasHabilesRestantes = isPeriodoProyectado
      ? Math.max(0, diasHabilesTotales - diasHabilesConRegistro)
      : 0;
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
  }, [empNovedadesMes, selectedMes, selectedYear, empleado.fecha_ingreso, valorHora, porcentajeBonoPresentismo, adelanto, isPeriodoProyectado]);

  // La nómina es la fuente única para los importes del período: así se respetan
  // consolidados semanales, ajustes manuales y la misma regla de presentismo.
  const mesActualCalculos = useMemo(() => {
    const subtotalDevengadoHoy = Math.round(resumenPeriodo.horasCalculadasBase * valorHora);
    const subtotalProyectadoRestante = Math.round(resumenPeriodo.horasProyectadas * valorHora);
    const bonoDevengadoHoy = resumenPeriodo.cumplePresentismo
      ? Math.round((subtotalDevengadoHoy * porcentajeBonoPresentismo) / 100)
      : 0;

    return {
      ...mesActualCalculosLocales,
      horasReales: resumenPeriodo.horasCalculadasBase,
      diasTrabajadosReales: resumenPeriodo.diasPresente,
      inasistencias: resumenPeriodo.diasAusente,
      diasHabilesTotales: resumenPeriodo.diasHabilesPeriodo,
      diasHabilesRestantes: Math.max(0, resumenPeriodo.diasHabilesPeriodo - resumenPeriodo.diasCubiertos),
      promedioHorasPorDia: resumenPeriodo.promedioHorasDia,
      horasProyectadasRestantes: resumenPeriodo.horasProyectadas,
      horasTotalesEstimadasMes: resumenPeriodo.horasFinales,
      subtotalDevengadoHoy,
      subtotalProyectadoRestante,
      subtotalBrutoEstimadoMes: resumenPeriodo.sueldoBruto,
      cumplePresentismo: resumenPeriodo.cumplePresentismo,
      bonoPresentismo: resumenPeriodo.bonoPresentismo,
      bonoDevengadoHoy,
      estadoBonoPresentismo: resumenPeriodo.estadoBonoPresentismo,
      totalNetoDevengadoHoy: Math.max(0, subtotalDevengadoHoy + bonoDevengadoHoy - adelanto),
      totalNetoEstimadoMes: resumenPeriodo.totalNeto
    };
  }, [mesActualCalculosLocales, resumenPeriodo, valorHora, porcentajeBonoPresentismo, adelanto]);

  // =========================================================================
  // CÁLCULO 2: HISTÓRICO DEL AÑO SELECCIONADO
  // =========================================================================
  const historicoCalculos = useMemo(() => {
    // En modo histórico, el mapa conciliado de la nómina incorpora tanto partes
    // diarios como consolidados semanales. En los demás modos se conserva el
    // historial diario anual para esta pestaña informativa.
    const horasPorFecha = new Map<string, number>();
    if (periodMode === 'HISTORICO') {
      Object.entries(resumenPeriodo.horasRegistradasPorFecha).forEach(([fecha, horas]) => {
        horasPorFecha.set(fecha, Number(horas) || 0);
      });
    } else {
      empNovedadesHistoricas.forEach(n => {
        const parts = getFechaParts(n.fecha);
        if (!parts) return;
        const fecha = `${parts.year}-${String(parts.monthIndex + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
        horasPorFecha.set(fecha, (horasPorFecha.get(fecha) || 0) + (Number(n.horas_trabajadas) || 0));
      });
    }

    const periodosMap = new Map<string, {
      periodoKey: string;
      year: number;
      mes: string;
      quincena: string;
      estadoPeriodo: 'LIQUIDACIÓN CERRADA' | 'PERÍODO ABIERTO / PROVISORIO';
      horas: number;
      dias: number;
      monto: number;
      ausencias: number;
      fechasTrabajadas: Set<string>;
      fechasAusentes: Set<string>;
    }>();

    const ensurePeriodo = (year: number, monthIndex: number, day: number) => {
      const mes = MESES[monthIndex];
      const quincena = day <= 15 ? '1Q' : '2Q';
      const key = `${year}_${mes}_${quincena}`;
      let p = periodosMap.get(key);
      if (!p) {
        p = {
          periodoKey: key,
          year,
          mes,
          quincena,
          estadoPeriodo: isPeriodoPosteriorAlCierre(year, mes)
            ? 'PERÍODO ABIERTO / PROVISORIO'
            : 'LIQUIDACIÓN CERRADA',
          horas: 0,
          dias: 0,
          monto: 0,
          ausencias: 0,
          fechasTrabajadas: new Set<string>(),
          fechasAusentes: new Set<string>()
        };
        periodosMap.set(key, p);
      }
      return p;
    };

    horasPorFecha.forEach((horas, fecha) => {
      const parts = getFechaParts(fecha);
      if (!parts) return;
      const p = ensurePeriodo(parts.year, parts.monthIndex, parts.day);
      p.horas += horas;
      if (horas > 0) p.fechasTrabajadas.add(fecha);
    });

    const fechasTarde = new Set<string>();
    empNovedadesHistoricas.forEach(n => {
      const parts = getFechaParts(n.fecha);
      if (!parts) return;
      const fecha = `${parts.year}-${String(parts.monthIndex + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
      const p = ensurePeriodo(parts.year, parts.monthIndex, parts.day);
      if (n.estado === 'AUSENTE') p.fechasAusentes.add(fecha);
      if (n.estado === 'LLEGADA TARDE') fechasTarde.add(fecha);
    });

    const periodosList = Array.from(periodosMap.values()).map(p => ({
      periodoKey: p.periodoKey,
      year: p.year,
      mes: p.mes,
      quincena: p.quincena,
      estadoPeriodo: p.estadoPeriodo,
      horas: Math.round(p.horas * 100) / 100,
      dias: p.fechasTrabajadas.size,
      monto: Math.round(p.horas * valorHora),
      ausencias: p.fechasAusentes.size
    })).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const idxA = MESES.indexOf(a.mes);
      const idxB = MESES.indexOf(b.mes);
      if (idxA !== idxB) return idxB - idxA;
      return b.quincena.localeCompare(a.quincena);
    });

    const totalHoras = Math.round(
      Array.from(horasPorFecha.values()).reduce((acc, horas) => acc + horas, 0) * 100
    ) / 100;
    const totalAusencias = new Set(
      empNovedadesHistoricas
        .filter(n => n.estado === 'AUSENTE')
        .map(n => n.fecha.slice(0, 10))
    ).size;
    const totalLlegadasTarde = fechasTarde.size;
    const totalMontoHistorico = Math.round(totalHoras * valorHora);

    return {
      totalHoras,
      totalAusencias,
      totalLlegadasTarde,
      totalMontoHistorico,
      totalQuincenas: periodosList.length,
      periodosList
    };
  }, [empNovedadesHistoricas, valorHora, periodMode, resumenPeriodo.horasRegistradasPorFecha]);

  // =========================================================================
  // CÁLCULO 3: ¿CUÁNTO COBRARÁ LOS PRÓXIMOS MESES? (PROYECCIONES A FUTURO)
  // =========================================================================
  const proyeccionesFuturas = useMemo(() => {
    const list = [];
    const fechaIngreso = parsePayrollDate(empleado.fecha_ingreso);
    const currentMIdx = MESES.indexOf(selectedMes);
    const selectedPeriodo = selectedYear * 12 + currentMIdx;
    const primerPeriodoProyectable = LAST_CLOSED_PAYROLL_PERIOD.year * 12 + LAST_CLOSED_PAYROLL_PERIOD.monthIndex + 1;
    const primerPeriodoObjetivo = Math.max(selectedPeriodo + 1, primerPeriodoProyectable);

    for (let offset = 0; offset < 4; offset++) {
      const targetPeriodo = primerPeriodoObjetivo + offset;
      const targetMIdx = targetPeriodo % 12;
      const targetYear = Math.floor(targetPeriodo / 12);
      const mesName = MESES[targetMIdx];

      // Días hábiles del mes objetivo
      const totalDias = new Date(targetYear, targetMIdx + 1, 0).getDate();
      const inicioMes = new Date(targetYear, targetMIdx, 1);
      const finMes = new Date(targetYear, targetMIdx, totalDias);
      const inicioComputable = fechaIngreso && fechaIngreso > inicioMes ? fechaIngreso : inicioMes;
      let diasHabiles = 0;
      for (
        let day = inicioComputable <= finMes ? inicioComputable.getDate() : totalDias + 1;
        day <= totalDias;
        day++
      ) {
        const d = new Date(targetYear, targetMIdx, day);
        if (isPayrollBusinessDay(d)) diasHabiles++;
      }

      // Horas proyectadas a 8.8 hs diarias (44 hs semanales)
      const horasProyectadas = Math.round(diasHabiles * 8.8 * 10) / 10;
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
        distanciaMeses: targetPeriodo - selectedPeriodo,
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
  }, [selectedMes, selectedYear, empleado.fecha_ingreso, valorHora, porcentajeBonoPresentismo]);

  // =========================================================================
  // CÁLCULO 4: DESGLOSE DE QUINCENA POR DÍA (DÍA A DÍA CON MONTO DIARIO)
  // =========================================================================
  const desgloseQuincenaDiaPorDia = useMemo(() => {
    const mIdx = MESES.indexOf(selectedMes);
    const startDay = selectedQuincena === '1Q' ? 1 : 16;
    const totalDiasMes = new Date(selectedYear, mIdx + 1, 0).getDate();
    const endDay = selectedQuincena === '1Q' ? 15 : totalDiasMes;
    const ingresoParts = getFechaParts(empleado.fecha_ingreso);
    const fechaIngreso = ingresoParts
      ? new Date(ingresoParts.year, ingresoParts.monthIndex, ingresoParts.day)
      : null;

    // Mapa de novedades reales indexadas por día. Si una jornada tiene varios
    // partes (por ejemplo, dos obras), se agregan en vez de conservar solo el último.
    const novPorDiaMap = new Map<number, NovedadRegistro>();
    empNovedadesQuincena.forEach(n => {
      const fechaParts = getFechaParts(n.fecha);
      if (!fechaParts) return;

      const previous = novPorDiaMap.get(fechaParts.day);
      if (!previous) {
        novPorDiaMap.set(fechaParts.day, { ...n });
        return;
      }

      const estados = [previous.estado, n.estado];
      const obras = Array.from(new Set(
        [previous.obra_nombre, n.obra_nombre].filter((obra): obra is string => !!obra)
      ));
      const licencias = Array.from(new Set(
        [previous.tipo_licencia, n.tipo_licencia].filter((tipo): tipo is string => !!tipo)
      ));
      novPorDiaMap.set(fechaParts.day, {
        ...previous,
        id: `${previous.id},${n.id}`,
        horas_trabajadas: (Number(previous.horas_trabajadas) || 0) + (Number(n.horas_trabajadas) || 0),
        horas_ausente: (Number(previous.horas_ausente) || 0) + (Number(n.horas_ausente) || 0),
        estado: estados.includes('AUSENTE')
          ? 'AUSENTE'
          : estados.includes('LLEGADA TARDE')
            ? 'LLEGADA TARDE'
            : 'PRESENTE',
        obra_nombre: obras.join(' / ') || undefined,
        tipo_licencia: licencias.join(' / ') || undefined
      });
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
      const esDiaNoLaborable = !esDomingo && !esSabado && !isPayrollBusinessDay(d);

      const dateStr = `${selectedYear}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const novReal = novPorDiaMap.get(day);
      const tieneConsolidadoSemanal = !novReal &&
        Object.prototype.hasOwnProperty.call(resumenPeriodo.horasRegistradasPorFecha, dateStr);

      let horasDia: number;
      let montoDia: number;
      let estadoTipo: 'TRABAJADO' | 'CONSOLIDADO' | 'AUSENTE' | 'PROYECTADO' | 'SIN_REGISTRO' | 'NO_CORRESPONDE' | 'DESCANSO' | 'TARDE';
      let detalle: string;
      let tipoDato: string;

      if (fechaIngreso && d < fechaIngreso) {
        estadoTipo = 'NO_CORRESPONDE';
        horasDia = 0;
        montoDia = 0;
        detalle = `Anterior al ingreso (${empleado.fecha_ingreso})`;
        tipoDato = 'NO CORRESPONDE';
      } else if (novReal) {
        horasDia = Number(novReal.horas_trabajadas) || 0;
        montoDia = Math.round(horasDia * valorHora);
        tipoDato = 'REGISTRO DIARIO';

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
      } else if (tieneConsolidadoSemanal) {
        horasDia = Number(resumenPeriodo.horasRegistradasPorFecha[dateStr]) || 0;
        montoDia = Math.round(horasDia * valorHora);
        estadoTipo = 'CONSOLIDADO';
        detalle = 'Registro consolidado semanal';
        tipoDato = 'CONSOLIDADO SEMANAL';
      } else if (esDomingo) {
        estadoTipo = 'DESCANSO';
        horasDia = 0;
        montoDia = 0;
        detalle = 'Franco Semanal';
        tipoDato = 'DESCANSO';
      } else if (esSabado) {
        estadoTipo = 'DESCANSO';
        horasDia = 0;
        montoDia = 0;
        detalle = 'Sábado no laborable';
        tipoDato = 'DESCANSO';
      } else if (esDiaNoLaborable) {
        estadoTipo = 'DESCANSO';
        horasDia = 0;
        montoDia = 0;
        detalle = 'Día no laborable nacional/UOCRA';
        tipoDato = 'DÍA NO LABORABLE';
      } else {
        if (isPeriodoProyectado) {
          estadoTipo = 'PROYECTADO';
          horasDia = mesActualCalculos.promedioHorasPorDia;
          montoDia = Math.round(horasDia * valorHora);
          detalle = `Jornada Proyectada (${horasDia} hs)`;
          tipoDato = 'PROYECCIÓN';
        } else {
          estadoTipo = 'SIN_REGISTRO';
          horasDia = 0;
          montoDia = 0;
          detalle = 'Día laborable sin registro';
          tipoDato = 'SIN REGISTRO';
        }
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
        tieneRegistroReal: !!novReal || tieneConsolidadoSemanal,
        tipoDato,
        estadoTipo,
        detalle,
        horasDia,
        montoDia,
        horasAcumuladas: Math.round(horasAcumuladas * 10) / 10,
        acumuladoQuincena
      });
    }

    return rows;
  }, [selectedMes, selectedYear, selectedQuincena, empNovedadesQuincena, empleado.fecha_ingreso, valorHora, isPeriodoProyectado, mesActualCalculos.promedioHorasPorDia, resumenPeriodo.horasRegistradasPorFecha]);

  // Exportar ficha del obrero a Excel
  const handleExportObreroExcel = () => {
    const wb = XLSX.utils.book_new();
    const isHistorico = periodMode === 'HISTORICO';
    const estadoPeriodo = isHistorico
      ? 'HISTÓRICO INFORMATIVO'
      : isPeriodoProyectado
        ? 'PROYECCIÓN PROVISORIA'
        : 'LIQUIDACIÓN CERRADA';
    const periodoLabel = isHistorico
      ? `Histórico ${selectedYear}`
      : periodMode === 'MES'
        ? `${selectedMes} ${selectedYear}`
        : `${periodMode} - ${selectedMes} ${selectedYear}`;

    // 1. Hoja resumen con la condición explícita del período.
    const dataResumen = [{
      'Empleado': empleado.full_name,
      'Período': periodoLabel,
      'Estado del período': estadoPeriodo,
      'Último período cerrado': LAST_CLOSED_PAYROLL_PERIOD_LABEL,
      'Horas registradas': mesActualCalculos.horasReales,
      'Horas proyectadas': mesActualCalculos.horasProyectadasRestantes,
      'Horas totales del cálculo': mesActualCalculos.horasTotalesEstimadasMes,
      'Subtotal bruto ($)': mesActualCalculos.subtotalBrutoEstimadoMes,
      'Estado bono presentismo': mesActualCalculos.estadoBonoPresentismo,
      'Bono presentismo ($)': mesActualCalculos.bonoPresentismo,
      [`Total ${isHistorico ? 'histórico informativo' : isPeriodoProyectado ? 'neto estimado' : 'neto liquidado'} ($)`]: mesActualCalculos.totalNetoEstimadoMes
    }];
    const wsResumen = XLSX.utils.json_to_sheet(dataResumen);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_Periodo');

    // 2. Hoja Desglose Día por Día (solo para un período mensual/quincenal).
    if (!isHistorico) {
      const dataDias = desgloseQuincenaDiaPorDia.map(r => ({
        'Fecha': r.fechaStr,
        'Día': r.diaNombre,
        'Estado': r.estadoTipo,
        'Tipo de dato': r.tipoDato,
        'Detalle': r.detalle,
        'Horas': r.horasDia,
        'Cobro Diario ($)': r.montoDia,
        'Horas Acumuladas': r.horasAcumuladas,
        'Acumulado Quincena ($)': r.acumuladoQuincena
      }));
      const wsDias = XLSX.utils.json_to_sheet(dataDias);
      XLSX.utils.book_append_sheet(wb, wsDias, `Quincena_${selectedQuincena}_Dias`);
    }

    // 3. Hoja Historial Quincenas
    const dataHist = historicoCalculos.periodosList.map(p => ({
      'Período': `${p.mes} ${p.year ?? 'SIN AÑO'} - ${p.quincena}`,
      'Estado del período': p.estadoPeriodo,
      'Horas Computadas': p.horas,
      'Jornadas Trabajadas': p.dias,
      'Ausencias': p.ausencias,
      'Subtotal Cobrado ($)': p.monto
    }));
    const wsHist = XLSX.utils.json_to_sheet(dataHist);
    XLSX.utils.book_append_sheet(wb, wsHist, 'Historial_Quincenas');

    // 4. Hoja Proyecciones Futuras
    const dataProy = proyeccionesFuturas.map(p => ({
      'Mes': `${p.mes} ${p.year}`,
      'Días Hábiles (sin feriados nacionales/UOCRA)': p.diasHabiles,
      'Horas Proyectadas': p.horasProyectadas,
      'Sueldo Base ($)': p.sueldoBase,
      [`Bono potencial de asistencia (+${porcentajeBonoPresentismo}%, sujeto a cumplimiento)`]: p.bonoAsistencia,
      'Sueldo con Premio ($)': p.sueldoConBono,
      'Aguinaldo SAC ($)': p.aguinaldoProyectado,
      'Total Proyectado ($)': p.totalConAguinaldo
    }));
    const wsProy = XLSX.utils.json_to_sheet(dataProy);
    XLSX.utils.book_append_sheet(wb, wsProy, 'Proyecciones_Futuras');

    XLSX.writeFile(
      wb,
      `Ficha_Salarial_${normalizeText(empleado.full_name).replace(/\s+/g, '_')}_${isHistorico ? `HISTORICO_${selectedYear}` : `${selectedMes}_${selectedYear}_${isPeriodoProyectado ? 'PROYECCION' : 'CERRADA'}`}.xlsx`
    );
  };

  const handleSendWhatsAppInfo = () => {
    if (!empleado.whatsapp) return;
    const isHistorico = periodMode === 'HISTORICO';
    const avisoPeriodo = isHistorico
      ? `ℹ️ *Resumen histórico informativo ${selectedYear}:* este acumulado no constituye una liquidación ni un importe definitivo a pagar.\n\n`
      : isPeriodoProyectado
      ? `⚠️ *Nota:* Este cálculo es una *PROYECCIÓN ESTIMATIVA* para ${selectedMes} ${selectedYear}. La última liquidación cerrada corresponde a ${LAST_CLOSED_PAYROLL_PERIOD_LABEL}.\n\n`
      : `✅ *Liquidación cerrada:* ${selectedMes} ${selectedYear}. No incluye horas proyectadas.\n\n`;
    const descripcionHoras = isHistorico
      ? `${mesActualCalculos.horasReales} hs acumuladas`
      : isPeriodoProyectado
      ? `${mesActualCalculos.horasReales} hs registradas + ${mesActualCalculos.horasProyectadasRestantes} hs estimadas`
      : `${mesActualCalculos.horasReales} hs registradas`;
    const periodoLabel = isHistorico
      ? `${selectedYear}`
      : periodMode === 'MES'
        ? `${selectedMes} ${selectedYear}`
        : `${periodMode} de ${selectedMes} ${selectedYear}`;
    const bonoTexto = isHistorico
      ? 'No aplica al resumen histórico'
      : mesActualCalculos.cumplePresentismo
        ? `$${mesActualCalculos.bonoPresentismo.toLocaleString('es-AR')} (requisito cumplido con registros reales/consolidados)`
        : isPeriodoProyectado
          ? 'Pendiente; no incluido por falta de registros reales suficientes'
          : 'Sin premio';

    const msg = 
      `👋 *Hola ${empleado.full_name.split(' ')[0]}!*\n\n` +
      avisoPeriodo +
      `Te compartimos ${isHistorico ? 'el resumen histórico informativo' : isPeriodoProyectado ? 'la proyección estimada' : 'la liquidación cerrada'} de tus haberes para *${periodoLabel}*:\n` +
      `• *Horas Computadas:* ${descripcionHoras}\n` +
      `• *Valor Hora:* $${valorHora.toLocaleString('es-AR')}\n` +
      `• *${isHistorico ? 'Monto Histórico Informativo' : `Subtotal Bruto ${isPeriodoProyectado ? 'Estimado' : 'Liquidado'}`}:* $${mesActualCalculos.subtotalBrutoEstimadoMes.toLocaleString('es-AR')}\n` +
      `• *Bono Asistencia Perfecta (+${porcentajeBonoPresentismo}%):* ${bonoTexto}\n` +
      (adelanto > 0 ? `• *Adelanto a descontar:* -$${adelanto.toLocaleString('es-AR')}\n` : '') +
      `💰 *${isHistorico ? 'Total Histórico Informativo' : `Total Neto ${isPeriodoProyectado ? 'Estimado' : 'Liquidado'}`}:* $${mesActualCalculos.totalNetoEstimadoMes.toLocaleString('es-AR')}\n\n` +
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
          {([
            { id: 'mes_actual', label: isPeriodoProyectado ? '💰 Proyección del período' : '💰 Liquidación del período', icon: DollarSign },
            { id: 'quincena_dia', label: '📅 Quincena Día por Día', icon: CalendarDays },
            { id: 'historico', label: `📜 Histórico ${selectedYear}`, icon: History },
            { id: 'proyecciones', label: '📈 Próximos Meses (Proyección)', icon: TrendingUp }
          ] as const).map(tab => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id);
                  if (tab.id === 'mes_actual') onChangePeriodMode('MES');
                  if (tab.id === 'quincena_dia') onChangePeriodMode(selectedQuincena);
                  if (tab.id === 'historico') onChangePeriodMode('HISTORICO');
                  if (tab.id === 'proyecciones' && periodMode === 'HISTORICO') onChangePeriodMode('MES');
                }}
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
            value={selectedYear}
            onChange={(e) => onChangePeriodYear(Number(e.target.value))}
            aria-label="Año del período"
            className="h-9 px-3 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 text-xs shadow-xs"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <select
            value={selectedMes}
            onChange={(e) => onChangePeriodMonth(e.target.value)}
            aria-label="Mes del período"
            className="h-9 px-3 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 text-xs shadow-xs"
          >
            {MESES.map(m => (
              <option key={m} value={m}>
                {m} • {isPeriodoPosteriorAlCierre(selectedYear, m) ? 'Proyección' : 'Liquidación cerrada'}
              </option>
            ))}
          </select>

          <select
            value={selectedQuincena}
            onChange={(e) => {
              const quincena = e.target.value as '1Q' | '2Q';
              setSelectedQuincena(quincena);
              if (periodMode === '1Q' || periodMode === '2Q') onChangePeriodMode(quincena);
            }}
            className="h-9 px-3 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 text-xs shadow-xs"
          >
            <option value="1Q">1º Quincena (1-15)</option>
            <option value="2Q">2º Quincena (16-31)</option>
          </select>
        </div>
      </div>

      {/* Estado inequívoco del período seleccionado */}
      {activeSubTab !== 'historico' && (isPeriodoProyectado ? (
        <div className="bg-amber-50 border border-amber-300 p-3.5 sm:p-4 rounded-2xl flex items-start gap-3 text-amber-950 shadow-xs animate-fadeIn">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-amber-900 uppercase">
                Período en Proyección Salarial: {selectedMes} {selectedYear}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-200 text-amber-900 uppercase border border-amber-300">
                Provisorio
              </span>
            </div>
            <p className="text-amber-800 font-medium leading-relaxed">
              La última liquidación en firme cerrada corresponde a <strong>{LAST_CLOSED_PAYROLL_PERIOD_LABEL}</strong>.
              Los importes y horas de <strong>{selectedMes} {selectedYear}</strong> se calculan como una estimación provisoria a la espera del cierre de quincena y homologación paritaria UOCRA.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 sm:p-4 rounded-2xl flex items-start gap-3 text-emerald-950 shadow-xs animate-fadeIn">
          <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <span className="font-extrabold text-emerald-900 uppercase">
              Liquidación cerrada: {selectedMes} {selectedYear}
            </span>
            <p className="text-emerald-800 font-medium leading-relaxed">
              Se computan exclusivamente las horas registradas. Los días laborables sin novedad quedan en cero y no se proyectan.
            </p>
          </div>
        </div>
      ))}

      {/* =================================================================== */}
      {/* VISTA 1: ¿CUÁNTO COBRARÁ ESTE MES? (MES ACTUAL / EN CURSO)          */}
      {/* =================================================================== */}
      {activeSubTab === 'mes_actual' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Tarjetas Principales del Mes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* TOTAL DEL PERÍODO */}
            <Card className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-1 relative z-10">
                <span className="bg-white/20 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1 w-fit">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  {isPeriodoProyectado ? 'Estimado del período' : 'Liquidación cerrada'} ({periodMode === 'MES' ? '' : `${periodMode} · `}{selectedMes} {selectedYear})
                </span>
                <span className="text-xs text-emerald-100 font-bold block pt-1">
                  Total Neto {isPeriodoProyectado ? 'Proyectado' : 'Liquidado'}
                </span>
                <div className="text-3xl font-black tracking-tight text-white">
                  ${mesActualCalculos.totalNetoEstimadoMes.toLocaleString('es-AR')}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-white/20 text-[11px] text-emerald-100 space-y-0.5 relative z-10">
                <div className="flex justify-between">
                  <span>{isPeriodoProyectado ? 'Horas estimadas:' : 'Horas liquidadas:'}</span>
                  <strong className="text-white">{mesActualCalculos.horasTotalesEstimadasMes} hs</strong>
                </div>
                <div className="flex justify-between">
                  <span>Bono Asistencia (+{porcentajeBonoPresentismo}%):</span>
                  <strong className="text-amber-200">
                    {mesActualCalculos.cumplePresentismo
                      ? `+$${mesActualCalculos.bonoPresentismo.toLocaleString('es-AR')}`
                      : isPeriodoProyectado ? 'Pendiente' : 'Sin bono'}
                  </strong>
                </div>
              </div>
            </Card>

            {/* REAL DEVENGADO A LA FECHA */}
            <Card className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {isPeriodoProyectado ? 'Devengado Registrado' : 'Subtotal Liquidado'}
                  </span>
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
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {isPeriodoProyectado ? 'Restante Estimado' : 'Proyección Agregada'}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-indigo-900">
                  ${mesActualCalculos.subtotalProyectadoRestante.toLocaleString('es-AR')}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isPeriodoProyectado
                    ? `${mesActualCalculos.horasProyectadasRestantes} hs estimadas en ${mesActualCalculos.diasHabilesRestantes} días hábiles sin registro.`
                    : 'Período cerrado: no se sintetizan horas faltantes.'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
                <span>Días hábiles (sin feriados nacionales/UOCRA):</span>
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
                  {mesActualCalculos.cumplePresentismo
                    ? `+${porcentajeBonoPresentismo}% ($${mesActualCalculos.bonoPresentismo.toLocaleString('es-AR')})`
                    : isPeriodoProyectado ? 'Pendiente · no incluido' : 'Sin premio'}
                </span>
              </div>
            </Card>

          </div>

          {/* Desglose Explicativo de la Liquidación */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-peie-blue" />
              <span>
                Detalle de la {isPeriodoProyectado ? 'Proyección' : 'Liquidación Cerrada'} ({selectedMes} {selectedYear})
              </span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                <span className="font-black text-slate-700 block uppercase text-[10px] tracking-wider">
                  Cómputo de Horas y Asistencia
                </span>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Horas trabajadas efectivas {isPeriodoProyectado ? '(registradas):' : '(liquidadas):'}</span>
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
                  <span className="text-slate-600">{isPeriodoProyectado ? 'Días hábiles sin registro proyectados:' : 'Días agregados por proyección:'}</span>
                  <span className="font-bold text-indigo-700">{mesActualCalculos.diasHabilesRestantes} días ({mesActualCalculos.horasProyectadasRestantes} hs)</span>
                </div>
                <div className="flex justify-between pt-1 text-slate-900 font-black">
                  <span>Total horas base {isPeriodoProyectado ? 'estimadas' : 'liquidadas'}:</span>
                  <span>{mesActualCalculos.horasTotalesEstimadasMes} hs</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                <span className="font-black text-slate-700 block uppercase text-[10px] tracking-wider">
                  Composición Salarial en Pesos
                </span>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Subtotal horas {isPeriodoProyectado ? 'registradas (a la fecha)' : 'liquidadas'}:</span>
                  <span className="font-bold text-slate-900">${mesActualCalculos.subtotalDevengadoHoy.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Subtotal horas {isPeriodoProyectado ? 'proyectadas restantes' : 'agregadas por proyección'}:</span>
                  <span className="font-bold text-indigo-700">+${mesActualCalculos.subtotalProyectadoRestante.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Bono Asistencia (+{porcentajeBonoPresentismo}%):</span>
                  <span className={`font-bold ${mesActualCalculos.cumplePresentismo ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {mesActualCalculos.cumplePresentismo
                      ? `+$${mesActualCalculos.bonoPresentismo.toLocaleString('es-AR')}`
                      : isPeriodoProyectado ? 'Pendiente · no incluido' : '$0'}
                  </span>
                </div>
                {adelanto > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Deducción de adelanto:</span>
                    <span className="font-bold text-rose-600">-${adelanto.toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-slate-900 font-black text-sm">
                  <span>Neto Total {isPeriodoProyectado ? 'Proyectado' : 'Liquidado'}:</span>
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
                Desglose Quincenal Día por Día • {selectedMes} {selectedYear} ({selectedQuincena === '1Q' ? '1 al 15' : '16 al fin de mes'})
              </h4>
              <p className="text-xs text-slate-500">
                {isPeriodoProyectado
                  ? 'Combina registros reales con jornadas estimadas para el período abierto.'
                  : 'Liquidación cerrada: los días laborables sin registro se muestran en cero.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">
                Total Quincena {isPeriodoProyectado ? 'Estimado' : 'Liquidado'}:
              </span>
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
                        {row.estadoTipo === 'CONSOLIDADO' && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-200">
                            CONSOLIDADO SEMANAL
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
                        {row.estadoTipo === 'SIN_REGISTRO' && (
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-slate-200">
                            SIN REGISTRO
                          </span>
                        )}
                        {row.estadoTipo === 'NO_CORRESPONDE' && (
                          <span className="bg-slate-50 text-slate-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-slate-200">
                            NO CORRESPONDE
                          </span>
                        )}
                        {row.estadoTipo === 'DESCANSO' && (
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            {row.detalle === 'Día no laborable nacional/UOCRA' ? 'NO LABORABLE' : 'FRANCO'}
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
      {/* VISTA 3: HISTÓRICO DEL AÑO SELECCIONADO                             */}
      {/* =================================================================== */}
      {activeSubTab === 'historico' && (
        <div className="space-y-4 animate-fadeIn">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-3xl border-slate-200 p-5 bg-white shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Total Histórico {selectedYear}
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
              <p className="text-xs text-slate-500 mt-1">Días no asistidos registrados en {selectedYear}.</p>
            </Card>
          </div>

          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <div className="bg-[#031530] text-white p-4 font-black text-xs uppercase tracking-wide flex justify-between">
              <span>Historial {selectedYear} por período</span>
              <span className="text-blue-200">{historicoCalculos.periodosList.length} Quincenas Registradas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Período / Quincena</th>
                    <th className="py-3 px-4">Estado</th>
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
                        {p.mes} {p.year ?? 'SIN AÑO'} • {p.quincena}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                          p.estadoPeriodo === 'LIQUIDACIÓN CERRADA'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : p.estadoPeriodo === 'PERÍODO ABIERTO / PROVISORIO'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {p.estadoPeriodo}
                        </span>
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
                      +{proy.distanciaMeses} {proy.distanciaMeses === 1 ? 'Mes' : 'Meses'}
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
                    <span>Bono potencial de asistencia (+{porcentajeBonoPresentismo}%, si cumple):</span>
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
