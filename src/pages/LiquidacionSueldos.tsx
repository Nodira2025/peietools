import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  Users, 
  Clock, 
  Calendar, 
  Search, 
  FileSpreadsheet, 
  RefreshCw, 
  Building2, 
  FileText, 
  Printer, 
  Send, 
  Sliders, 
  Check, 
  TrendingUp,
  AlertCircle,
  Sparkles,
  ChevronRight,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { buildWhatsAppLink } from '../lib/whatsapp';
import {
  PAYROLL_MONTHS,
  LAST_CLOSED_PAYROLL_PERIOD,
  LAST_CLOSED_PAYROLL_PERIOD_LABEL,
  addPayrollDays,
  countPayrollBusinessDays,
  getPayrollDateKey,
  getPayrollPeriodBounds,
  isAfterLastClosedPayrollPeriod,
  isPayrollBusinessDay,
  parsePayrollDate,
  type PayrollPeriodMode
} from '../lib/payroll-period';
import { ObreroSueldoProyecciones } from '../components/ObreroSueldoProyecciones';
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

interface NovedadRegistro {
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
}

interface SemanalRegistro {
  id: string;
  empleado_id?: string;
  empleado_nombre: string;
  empleado_dni?: string;
  semana_inicio: string;
  lunes?: number | null;
  martes?: number | null;
  miercoles?: number | null;
  jueves?: number | null;
  viernes?: number | null;
  sabado?: number | null;
  domingo?: number | null;
  total_horas: number;
}

type PeriodoModo = PayrollPeriodMode;

const MESES = PAYROLL_MONTHS;
const HORAS_DIARIAS_PROYECCION_DEFAULT = 8.8;
const CAMPOS_DIAS_SEMANA = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'
] as const;

// Función para normalizar texto (remover acentos y espacios extra)
function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Obtener mes y quincena a partir de una fecha válida YYYY-MM-DD.
function getPeriodoFromDate(dateStr: string | null | undefined) {
  const date = parsePayrollDate(dateStr);
  if (!date) return null;
  return {
    mes: MESES[date.getMonth()],
    quincena: date.getDate() <= 15 ? '1Q' : '2Q',
    year: date.getFullYear()
  };
}

function getWeeklyEntriesWithinBounds(registro: SemanalRegistro, start: Date, end: Date) {
  const weekStart = parsePayrollDate(registro.semana_inicio);
  if (!weekStart) return [];
  const totalHours = Number(registro.total_horas) || 0;
  const hasAnyDailyValue = CAMPOS_DIAS_SEMANA.some(field => registro[field] != null);
  const dailyHoursSum = CAMPOS_DIAS_SEMANA.reduce(
    (sum, field) => sum + (Number(registro[field]) || 0),
    0
  );
  const hasDailyBreakdown = hasAnyDailyValue && (dailyHoursSum > 0 || totalHours === 0);
  const legacyBusinessOffsets = new Set(
    CAMPOS_DIAS_SEMANA
      .map((_, offset) => offset)
      .filter(offset => isPayrollBusinessDay(addPayrollDays(weekStart, offset)))
  );
  const legacyBusinessDayHours = totalHours / Math.max(1, legacyBusinessOffsets.size);

  return CAMPOS_DIAS_SEMANA.flatMap((field, offset) => {
    const date = addPayrollDays(weekStart, offset);
    if (date < start || date > end) return [];
    const hours = hasDailyBreakdown
      ? Number(registro[field]) || 0
      : legacyBusinessOffsets.has(offset)
        ? legacyBusinessDayHours
        : 0;
    return [{ date, hours }];
  });
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function getPeriodoEmpleadoKey(
  empId: string,
  year: number,
  month: string,
  mode: PeriodoModo
): string {
  const tramo = mode === 'HISTORICO' ? 'ANUAL' : month;
  return `${year}:${tramo}:${mode}:${empId}`;
}

function getScopedValue(
  map: Record<string, number>,
  empId: string,
  year: number,
  month: string,
  mode: PeriodoModo
): number | undefined {
  const scopedValue = map[getPeriodoEmpleadoKey(empId, year, month, mode)];
  if (scopedValue !== undefined) return Number(scopedValue);

  // Los valores legados no tenían período. Solo se recuperan en la antigua
  // pantalla predeterminada para que no contaminen meses posteriores.
  const canUseLegacyValue = year === LAST_CLOSED_PAYROLL_PERIOD.year &&
    month === PAYROLL_MONTHS[LAST_CLOSED_PAYROLL_PERIOD.monthIndex] && mode === 'MES';
  if (canUseLegacyValue && map[empId] !== undefined) return Number(map[empId]);

  return undefined;
}

export default function LiquidacionSueldos() {
  const { toast } = useToast();

  // Estados principales
  const [empleados, setEmpleados] = useState<EmpleadoSueldo[]>([]);
  const [novedades, setNovedades] = useState<NovedadRegistro[]>([]);
  const [semanales, setSemanales] = useState<SemanalRegistro[]>([]);
  const [obrasList, setObrasList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de Período (Liquidación cerrada hasta Agosto; Septiembre en adelante proyectada)
  const [selectedPeriodoModo, setSelectedPeriodoModo] = useState<PeriodoModo>('MES');
  const [selectedMes, setSelectedMes] = useState<string>('AGOSTO');
  const [selectedYear, setSelectedYear] = useState<number>(LAST_CLOSED_PAYROLL_PERIOD.year);
  const [selectedObraId, setSelectedObraId] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const isPeriodoHistorico = selectedPeriodoModo === 'HISTORICO';

  // El corte es absoluto: Agosto de 2026 es la última liquidación cerrada.
  const isPeriodoProyectado = useMemo(() => {
    if (isPeriodoHistorico) return false;
    return isAfterLastClosedPayrollPeriod(selectedYear, selectedMes);
  }, [isPeriodoHistorico, selectedMes, selectedYear]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set<number>([
      LAST_CLOSED_PAYROLL_PERIOD.year,
      currentYear - 1,
      currentYear,
      currentYear + 1
    ]);

    novedades.forEach(item => {
      const periodo = getPeriodoFromDate(item.fecha);
      if (periodo) years.add(periodo.year);
    });
    semanales.forEach(item => {
      const weekStart = parsePayrollDate(item.semana_inicio);
      if (!weekStart) return;
      years.add(weekStart.getFullYear());
      years.add(addPayrollDays(weekStart, 6).getFullYear());
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [novedades, semanales]);

  const selectedPeriodBounds = useMemo(
    () => getPayrollPeriodBounds(selectedYear, selectedMes, selectedPeriodoModo),
    [selectedYear, selectedMes, selectedPeriodoModo]
  );

  // Buscador de Obrero con Precarga / Autocomplete
  const [searchWorkerQuery, setSearchWorkerQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [selectedObreroId, setSelectedObreroId] = useState<string | null>(null);

  // Obrero seleccionado actualmente para ver su proyección detallada
  const selectedObrero = useMemo(() => {
    if (!selectedObreroId) return null;
    return empleados.find(e => e.id === selectedObreroId) || null;
  }, [empleados, selectedObreroId]);

  // Obreros sugeridos con precarga en vivo
  const suggestedWorkers = useMemo(() => {
    if (!searchWorkerQuery.trim()) {
      return empleados.slice(0, 8); // Precarga los primeros 8
    }
    const q = normalizeText(searchWorkerQuery);
    return empleados.filter(emp => {
      const matchName = normalizeText(emp.full_name).includes(q);
      const matchDni = emp.dni && emp.dni.includes(q);
      const matchPhone = emp.whatsapp && emp.whatsapp.replace(/\D/g, '').includes(q);
      const matchSpec = normalizeText(emp.specialty).includes(q);
      const matchObra = normalizeText(emp.obras?.name).includes(q);
      return matchName || matchDni || matchPhone || matchSpec || matchObra;
    });
  }, [empleados, searchWorkerQuery]);

  // Tarifas en memoria / edición
  const [tarifasEditadas, setTarifasEditadas] = useState<Record<string, number>>({});
  const [horasManualesMap, setHorasManualesMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('peie_horas_manuales_liquidacion');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [savingTarifas, setSavingTarifas] = useState(false);
  const [valorHoraDefecto, setValorHoraDefecto] = useState<number>(4500);
  const [porcentajeBonoPresentismo, setPorcentajeBonoPresentismo] = useState<number>(10);
  const [horasObjetivoQuincena, setHorasObjetivoQuincena] = useState<number>(88);

  // Adelantos y deducciones personalizadas
  const [adelantosMap, setAdelantosMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('peie_adelantos_sueldos');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal: Asignación Masiva de Tarifas
  const [isMasivoModalOpen, setIsMasivoModalOpen] = useState(false);
  const [tarifaMasivaGlobal, setTarifaMasivaGlobal] = useState<number>(4500);
  const [tarifasPorEspecialidad, setTarifasPorEspecialidad] = useState<Record<string, number>>({
    'Electricista': 5000,
    'Oficial': 4800,
    'Medio Oficial': 4400,
    'Ayudante': 4000,
    'Capataz': 6000,
    'General': 4500,
  });

  // Modal: Recibo de Sueldo Individual
  const [selectedLiquidacionForReceipt, setSelectedLiquidacionForReceipt] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Modal: Desglose Diario de Asistencia
  const [selectedEmpleadoNovedades, setSelectedEmpleadoNovedades] = useState<{ emp: EmpleadoSueldo; items: NovedadRegistro[] } | null>(null);

  // 1. Cargar Datos desde Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Empleados, Novedades y Semanales en paralelo
      const [empRes, novRes, semRes, oRes, regRes] = await Promise.all([
        supabase.from('empleados').select('*, obras(name)').order('full_name'),
        supabase.from('novedades_diarias').select('*').order('fecha', { ascending: false }),
        supabase.from('registro_horas_semanales').select('*').order('semana_inicio', { ascending: false }),
        supabase.from('obras').select('id, name').eq('active', true).order('name'),
        supabase.from('reglas_horas_trabajadores').select('*').limit(1).maybeSingle()
      ]);

      let empData = empRes.data || [];
      // Fallback de seguridad si falla la relación con obras
      if ((!empData || empData.length === 0) && empRes.error) {
        console.warn('Reintentando carga básica de empleados:', empRes.error.message);
        const fallbackEmp = await supabase.from('empleados').select('*').order('full_name');
        if (fallbackEmp.data) empData = fallbackEmp.data;
      }
      const novData = (novRes.data || []) as NovedadRegistro[];
      const semData = (semRes.data || []) as SemanalRegistro[];

      setNovedades(novData);
      setSemanales(semData);
      if (oRes.data) setObrasList(oRes.data);

      if (regRes.data) {
        if (regRes.data.valor_hora_defecto) setValorHoraDefecto(Number(regRes.data.valor_hora_defecto));
        if (regRes.data.porcentaje_bono) setPorcentajeBonoPresentismo(Number(regRes.data.porcentaje_bono));
        if (regRes.data.horas_objetivo_quincena) setHorasObjetivoQuincena(Number(regRes.data.horas_objetivo_quincena));
      }

      // Cargar tarifas guardadas en localStorage como backup/fallback
      const localTarifasSaved: Record<string, number> = {};
      try {
        const raw = localStorage.getItem('peie_tarifas_horas');
        if (raw) Object.assign(localTarifasSaved, JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }

      const formattedEmps: EmpleadoSueldo[] = empData.map((e: any) => {
        const obraObj = Array.isArray(e.obras) ? e.obras[0] : e.obras;
        const vHora = Number(e.valor_hora) || localTarifasSaved[e.id] || 4500;
        
        // Buscar si hay un DNI registrado en novedades o semanales para este empleado
        const normName = normalizeText(e.full_name);
        const novMatching = novData.find(n => 
          (n.empleado_id === e.id || normalizeText(n.empleado_nombre) === normName) && n.empleado_dni
        );
        const semMatching = semData.find(s => 
          (s.empleado_id === e.id || normalizeText(s.empleado_nombre) === normName) && s.empleado_dni
        );
        const foundDni = e.dni || novMatching?.empleado_dni || semMatching?.empleado_dni || null;

        return {
          ...e,
          dni: foundDni,
          obras: obraObj,
          valor_hora: vHora
        };
      });

      setEmpleados(formattedEmps);

      // Poblar mapa de tarifas inicial
      const mapInicial: Record<string, number> = {};
      formattedEmps.forEach(emp => {
        mapInicial[emp.id] = emp.valor_hora || 4500;
      });
      setTarifasEditadas(mapInicial);
    } catch (err: any) {
      console.error('Error al sincronizar datos de sueldos:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos de liquidación.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Guardar cambio de horas manual
  const handleHorasManualChange = (empId: string, horas?: number) => {
    const next = { ...horasManualesMap };
    const key = getPeriodoEmpleadoKey(empId, selectedYear, selectedMes, selectedPeriodoModo);
    if (horas === undefined) {
      delete next[key];
      if (
        selectedYear === LAST_CLOSED_PAYROLL_PERIOD.year &&
        selectedMes === PAYROLL_MONTHS[LAST_CLOSED_PAYROLL_PERIOD.monthIndex] &&
        selectedPeriodoModo === 'MES'
      ) {
        delete next[empId];
      }
    } else {
      next[key] = horas;
    }
    setHorasManualesMap(next);
    localStorage.setItem('peie_horas_manuales_liquidacion', JSON.stringify(next));
  };

  // Guardar mapa de adelantos en localStorage
  const handleAdelantoChange = (
    empId: string,
    valor?: number,
    scope: { year: number; month: string; mode: PeriodoModo } = {
      year: selectedYear,
      month: selectedMes,
      mode: selectedPeriodoModo
    }
  ) => {
    const next = { ...adelantosMap };
    const key = getPeriodoEmpleadoKey(empId, scope.year, scope.month, scope.mode);
    if (valor === undefined) {
      delete next[key];
      if (
        scope.year === LAST_CLOSED_PAYROLL_PERIOD.year &&
        scope.month === PAYROLL_MONTHS[LAST_CLOSED_PAYROLL_PERIOD.monthIndex] &&
        scope.mode === 'MES'
      ) {
        delete next[empId];
      }
    } else {
      next[key] = valor;
    }
    setAdelantosMap(next);
    localStorage.setItem('peie_adelantos_sueldos', JSON.stringify(next));
  };

  // Guardar Tarifa de un empleado individual
  const handleSaveTarifaIndividual = async (empId: string, customValor?: number) => {
    const valor = customValor !== undefined ? customValor : (Number(tarifasEditadas[empId]) || valorHoraDefecto);
    try {
      const localTarifas: Record<string, number> = {};
      try {
        const raw = localStorage.getItem('peie_tarifas_horas');
        if (raw) Object.assign(localTarifas, JSON.parse(raw));
      } catch {}
      localTarifas[empId] = valor;
      localStorage.setItem('peie_tarifas_horas', JSON.stringify(localTarifas));

      const nextMap = { ...tarifasEditadas, [empId]: valor };
      setTarifasEditadas(nextMap);

      const { error } = await supabase
        .from('empleados')
        .update({ valor_hora: valor })
        .eq('id', empId);

      if (error) {
        console.warn('Columna valor_hora no disponible en BD aún. Guardado en memoria local.', error.message);
      }

      setEmpleados(prev => prev.map(e => e.id === empId ? { ...e, valor_hora: valor } : e));
      toast({ title: 'Tarifa Guardada', description: `Se actualizó el valor hora a $${valor.toLocaleString('es-AR')}.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo guardar la tarifa.' });
    }
  };

  // Aplicar Tarifa Global a Todos
  const handleAplicarTarifaGlobal = async () => {
    if (!tarifaMasivaGlobal || tarifaMasivaGlobal <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Ingresá un monto válido para la tarifa general.' });
      return;
    }

    setSavingTarifas(true);
    try {
      const nextMap: Record<string, number> = {};
      empleados.forEach(emp => {
        nextMap[emp.id] = tarifaMasivaGlobal;
      });
      setTarifasEditadas(nextMap);
      localStorage.setItem('peie_tarifas_horas', JSON.stringify(nextMap));

      try {
        await supabase
          .from('empleados')
          .update({ valor_hora: tarifaMasivaGlobal })
          .neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.warn('Columna valor_hora no disponible en BD aún:', e);
      }

      setEmpleados(prev => prev.map(e => ({ ...e, valor_hora: tarifaMasivaGlobal })));
      setIsMasivoModalOpen(false);
      toast({ 
        title: 'Tarifas Actualizadas', 
        description: `Se aplicó $${tarifaMasivaGlobal.toLocaleString('es-AR')}/hora a todos los ${empleados.length} trabajadores.` 
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudieron actualizar las tarifas.' });
    } finally {
      setSavingTarifas(false);
    }
  };

  // Aplicar Tarifas por Especialidad
  const handleAplicarTarifasPorEspecialidad = async () => {
    setSavingTarifas(true);
    try {
      const nextMap: Record<string, number> = { ...tarifasEditadas };
      
      for (const emp of empleados) {
        const spec = (emp.specialty || 'General').trim();
        const matchedRate = tarifasPorEspecialidad[spec] || tarifasPorEspecialidad['General'] || tarifaMasivaGlobal;
        nextMap[emp.id] = matchedRate;
        
        try {
          await supabase.from('empleados').update({ valor_hora: matchedRate }).eq('id', emp.id);
        } catch (e) {}
      }

      setTarifasEditadas(nextMap);
      localStorage.setItem('peie_tarifas_horas', JSON.stringify(nextMap));
      setEmpleados(prev => prev.map(e => {
        const spec = (e.specialty || 'General').trim();
        return { ...e, valor_hora: tarifasPorEspecialidad[spec] || tarifasPorEspecialidad['General'] || e.valor_hora };
      }));

      setIsMasivoModalOpen(false);
      toast({ title: 'Tarifas por Especialidad Aplicadas', description: 'Se asignaron los valores según el oficio de cada empleado.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSavingTarifas(false);
    }
  };

  // 2. Filtro de Novedades y Horas con Normalización
  const filteredNovedades = useMemo(() => {
    return novedades.filter(nov => {
      const periodo = getPeriodoFromDate(nov.fecha);
      if (!periodo) return false;
      const mesNov = periodo.mes;
      const quincenaNov = periodo.quincena;
      if (periodo.year !== selectedYear) return false;

      if (selectedPeriodoModo === 'HISTORICO') return true;

      if (selectedPeriodoModo === 'MES') {
        return mesNov === selectedMes.toUpperCase().trim();
      }

      if (selectedPeriodoModo === '1Q') {
        return mesNov === selectedMes.toUpperCase().trim() && quincenaNov === '1Q';
      }

      if (selectedPeriodoModo === '2Q') {
        return mesNov === selectedMes.toUpperCase().trim() && quincenaNov === '2Q';
      }

      return true;
    });
  }, [novedades, selectedPeriodoModo, selectedMes, selectedYear]);

  const filteredSemanales = useMemo(() => {
    return semanales.filter(registro => {
      const weekStart = parsePayrollDate(registro.semana_inicio);
      if (!weekStart) return false;
      const weekEnd = addPayrollDays(weekStart, 6);
      return weekStart <= selectedPeriodBounds.end && weekEnd >= selectedPeriodBounds.start;
    });
  }, [semanales, selectedPeriodBounds]);

  // 3. Cómputo y Liquidación para cada empleado
  const liquidaciones = useMemo(() => {
    return empleados
      .filter(emp => {
        if (selectedObreroId === emp.id) return true;
        if (selectedObraId !== 'TODAS' && emp.obra_id !== selectedObraId) return false;
        if (searchTerm) {
          const term = normalizeText(searchTerm);
          const matchName = normalizeText(emp.full_name).includes(term);
          const matchSpec = normalizeText(emp.specialty).includes(term);
          const matchObra = normalizeText(emp.obras?.name).includes(term);
          if (!matchName && !matchSpec && !matchObra) return false;
        }
        return true;
      })
      .map(emp => {
        const empNormName = normalizeText(emp.full_name);
        const fechaIngreso = parsePayrollDate(emp.fecha_ingreso);
        const employeePeriodStart = fechaIngreso && fechaIngreso > selectedPeriodBounds.start
          ? fechaIngreso
          : selectedPeriodBounds.start;
        const employeeHasPeriod = employeePeriodStart <= selectedPeriodBounds.end;
        const diasHabilesEmpleado = employeeHasPeriod
          ? countPayrollBusinessDays(employeePeriodStart, selectedPeriodBounds.end)
          : 0;

        // Novedades diarias que pertenecen a este empleado
        const empNovs = filteredNovedades.filter(n => {
          const belongsToEmployee =
            (n.empleado_id && n.empleado_id === emp.id) ||
            (n.empleado_nombre && normalizeText(n.empleado_nombre) === empNormName);
          if (!belongsToEmployee || !employeeHasPeriod) return false;

          const date = parsePayrollDate(n.fecha);
          return !!date && date >= employeePeriodStart && date <= selectedPeriodBounds.end;
        });

        // Sumatorias de horas automáticas de asistencia diaria. Las jornadas se
        // cuentan por fecha para que dos partes cargados el mismo día no dupliquen
        // presencia, ausencia ni puntualidad.
        const horasAsistencia = empNovs.reduce((acc, curr) => acc + (Number(curr.horas_trabajadas) || 0), 0);
        const horasAusente = empNovs.reduce((acc, curr) => acc + (Number(curr.horas_ausente) || 0), 0);
        const getRecordDateKey = (registro: NovedadRegistro): string | null => {
          const date = parsePayrollDate(registro.fecha);
          return date ? getPayrollDateKey(date) : null;
        };
        const dailyDateKeys = new Set(
          empNovs
            .map(getRecordDateKey)
            .filter((date): date is string => date !== null)
        );
        const diasAusente = new Set(
          empNovs
            .filter(n => n.estado === 'AUSENTE')
            .map(getRecordDateKey)
            .filter((date): date is string => date !== null)
        ).size;
        const diasTarde = new Set(
          empNovs
            .filter(n => n.estado === 'LLEGADA TARDE')
            .map(getRecordDateKey)
            .filter((date): date is string => date !== null)
        ).size;
        // Las horas semanales ya están limitadas al mismo año/mes/quincena.
        const empSems = filteredSemanales.filter(s => {
          if (s.empleado_id && s.empleado_id === emp.id) return true;
          if (s.empleado_nombre && normalizeText(s.empleado_nombre) === empNormName) return true;
          return false;
        });
        const weeklyEntries = employeeHasPeriod
          ? empSems.flatMap(registro => getWeeklyEntriesWithinBounds(
              registro,
              employeePeriodStart,
              selectedPeriodBounds.end
            ))
          : [];
        // La novedad diaria prevalece solo en su fecha. Los consolidados semanales
        // completan las fechas sin parte diario, evitando tanto perder una semana
        // entera como duplicar horas del mismo día.
        const weeklyEntriesWithoutDaily = weeklyEntries.filter(entry =>
          !dailyDateKeys.has(getPayrollDateKey(entry.date)) &&
          (entry.hours !== 0 || isPayrollBusinessDay(entry.date))
        );
        const horasSemanalesComplementarias = weeklyEntriesWithoutDaily.reduce(
          (acc, entry) => acc + entry.hours,
          0
        );
        const horasCalculadasBase = roundHours(horasAsistencia + horasSemanalesComplementarias);
        const horasManuales = getScopedValue(
          horasManualesMap,
          emp.id,
          selectedYear,
          selectedMes,
          selectedPeriodoModo
        );

        const horasRegistradasPorFechaMap = new Map<string, number>();
        empNovs.forEach(registro => {
          const dateKey = getRecordDateKey(registro);
          if (!dateKey) return;
          horasRegistradasPorFechaMap.set(
            dateKey,
            (horasRegistradasPorFechaMap.get(dateKey) || 0) + (Number(registro.horas_trabajadas) || 0)
          );
        });
        weeklyEntriesWithoutDaily.forEach(entry => {
          const dateKey = getPayrollDateKey(entry.date);
          horasRegistradasPorFechaMap.set(
            dateKey,
            (horasRegistradasPorFechaMap.get(dateKey) || 0) + entry.hours
          );
        });

        const horasHabilesPorFecha = new Map(
          Array.from(horasRegistradasPorFechaMap.entries()).filter(([dateKey]) => {
            const date = parsePayrollDate(dateKey);
            return !!date &&
              date >= employeePeriodStart &&
              date <= selectedPeriodBounds.end &&
              isPayrollBusinessDay(date);
          })
        );
        const diasCubiertos = Math.min(diasHabilesEmpleado, horasHabilesPorFecha.size);
        const horasHabilesPositivas = Array.from(horasHabilesPorFecha.values()).filter(horas => horas > 0);
        const promedioHorasDia = horasHabilesPositivas.length > 0
          ? horasHabilesPositivas.reduce((acc, horas) => acc + horas, 0) / horasHabilesPositivas.length
          : HORAS_DIARIAS_PROYECCION_DEFAULT;
        const horasRegistradasHabiles = roundHours(
          Array.from(horasHabilesPorFecha.values()).reduce((acc, horas) => acc + horas, 0)
        );
        const diasPresentismo = horasHabilesPositivas.length;
        const diasPresente = Array.from(horasRegistradasPorFechaMap.values()).filter(horas => horas > 0).length;
        const horasRegistradasPorFecha = Object.fromEntries(
          Array.from(horasRegistradasPorFechaMap.entries()).map(([dateKey, horas]) => [
            dateKey,
            roundHours(horas)
          ])
        );

        let horasProyectadas = 0;
        if (isPeriodoProyectado && horasManuales === undefined) {
          const diasPendientes = Math.max(0, diasHabilesEmpleado - diasCubiertos);
          horasProyectadas = roundHours(diasPendientes * promedioHorasDia);
        }

        // Un ajuste manual es el total explícito para este período. En su ausencia,
        // los períodos abiertos completan los días hábiles que todavía no tienen datos.
        const horasFinales = horasManuales !== undefined
          ? horasManuales
          : roundHours(horasCalculadasBase + horasProyectadas);

        // Tarifa / Valor Hora
        const valorHora = Number(tarifasEditadas[emp.id]) || Number(emp.valor_hora) || valorHoraDefecto;
        const sueldoBruto = Math.round(horasFinales * valorHora);

        // Bono Presentismo
        const objetivoHorasConfigurado = selectedPeriodoModo === 'MES'
          ? horasObjetivoQuincena * 2
          : horasObjetivoQuincena;
        const objetivoDias = Math.min(
          selectedPeriodoModo === 'MES' ? 20 : 10,
          diasHabilesEmpleado
        );
        const objetivoHoras = Math.min(
          objetivoHorasConfigurado,
          roundHours(diasHabilesEmpleado * HORAS_DIARIAS_PROYECCION_DEFAULT)
        );
        // Las horas proyectadas y los ajustes manuales no habilitan el premio:
        // solo cuentan registros reales/consolidados. Así un período sin evidencia
        // de asistencia no obtiene presentismo automáticamente.
        const horasElegiblesPresentismo = horasRegistradasHabiles;
        const tieneAsistenciaComprobable = horasElegiblesPresentismo > 0 || diasPresente > 0;
        const cumplePresentismo = !isPeriodoHistorico &&
          diasHabilesEmpleado > 0 &&
          tieneAsistenciaComprobable &&
          diasAusente === 0 &&
          diasTarde <= 1 &&
          (horasElegiblesPresentismo >= objetivoHoras || diasPresentismo >= objetivoDias);
        const bonoPresentismo = cumplePresentismo ? Math.round((sueldoBruto * porcentajeBonoPresentismo) / 100) : 0;
        const estadoBonoPresentismo = isPeriodoHistorico
          ? 'NO APLICA AL HISTÓRICO'
          : cumplePresentismo
            ? isPeriodoProyectado
              ? 'INCLUIDO: REQUISITO CUMPLIDO CON REGISTROS REALES/CONSOLIDADOS'
              : 'CONFIRMADO'
            : isPeriodoProyectado
              ? 'PENDIENTE: NO INCLUIDO EN LA PROYECCIÓN'
              : 'NO CORRESPONDE';

        // Adelantos / deducciones
        const adelanto = getScopedValue(
          adelantosMap,
          emp.id,
          selectedYear,
          selectedMes,
          selectedPeriodoModo
        ) || 0;

        // Total Neto a Cobrar
        const totalNeto = Math.max(0, sueldoBruto + bonoPresentismo - adelanto);

        return {
          empleado: emp,
          horasCalculadasBase,
          horasProyectadas,
          horasFinales,
          promedioHorasDia: roundHours(promedioHorasDia),
          diasHabilesPeriodo: diasHabilesEmpleado,
          diasCubiertos,
          ajusteManualHoras: horasManuales !== undefined,
          horasAusente,
          diasPresente,
          diasAusente,
          valorHora,
          sueldoBruto,
          bonoPresentismo,
          cumplePresentismo,
          estadoBonoPresentismo,
          adelanto,
          totalNeto,
          horasRegistradasPorFecha,
          novedadesList: empNovs
        };
      });
  }, [
    empleados, 
    filteredNovedades, 
    filteredSemanales,
    selectedObreroId,
    selectedObraId, 
    searchTerm, 
    tarifasEditadas, 
    horasManualesMap,
    valorHoraDefecto, 
    porcentajeBonoPresentismo, 
    horasObjetivoQuincena,
    adelantosMap,
    isPeriodoProyectado,
    isPeriodoHistorico,
    selectedPeriodoModo,
    selectedMes,
    selectedYear,
    selectedPeriodBounds
  ]);

  // Métricas Consolidadas
  const totalMontoPagar = useMemo(() => liquidaciones.reduce((acc, curr) => acc + curr.totalNeto, 0), [liquidaciones]);
  const totalHorasLiquidadas = useMemo(() => liquidaciones.reduce((acc, curr) => acc + curr.horasFinales, 0), [liquidaciones]);
  const promedioValorHora = useMemo(() => {
    if (liquidaciones.length === 0) return 0;
    const sum = liquidaciones.reduce((acc, curr) => acc + curr.valorHora, 0);
    return Math.round(sum / liquidaciones.length);
  }, [liquidaciones]);
  const selectedObreroLiquidacion = useMemo(
    () => selectedObrero ? liquidaciones.find(liq => liq.empleado.id === selectedObrero.id) || null : null,
    [liquidaciones, selectedObrero]
  );

  // Exportar a Excel
  const handleExportExcel = () => {
    if (liquidaciones.length === 0) {
      toast({ variant: 'destructive', title: 'Sin datos', description: 'No hay liquidaciones para exportar en este período.' });
      return;
    }

    const periodoLabel = selectedPeriodoModo === 'HISTORICO'
      ? `Histórico informativo ${selectedYear}`
      : `${selectedPeriodoModo} - ${selectedMes} ${selectedYear}${isPeriodoProyectado ? ' (PROYECCIÓN ESTIMATIVA)' : ''}`;
    const tipoRegistro = selectedPeriodoModo === 'HISTORICO'
      ? 'HISTÓRICO INFORMATIVO'
      : isPeriodoProyectado
        ? 'PROYECCIÓN PROVISORIA'
        : 'LIQUIDACIÓN CERRADA';
    const totalColumn = selectedPeriodoModo === 'HISTORICO'
      ? 'TOTAL HISTÓRICO INFORMATIVO ($)'
      : isPeriodoProyectado
        ? 'TOTAL ESTIMADO A COBRAR ($)'
        : 'TOTAL NETO FACTURADO / A PAGAR ($)';

    const rows: any[] = liquidaciones.map((liq, idx) => ({
      'N°': idx + 1,
      'Trabajador': liq.empleado.full_name,
      'Especialidad': liq.empleado.specialty || 'General',
      'Obra Asignada': liq.empleado.obras?.name || 'Base / Sin Asignar',
      'Días Asistidos': liq.diasPresente,
      'Días Ausente': liq.diasAusente,
      'Días Hábiles del Período (sin feriados nacionales/UOCRA)': liq.diasHabilesPeriodo,
      'Horas Registradas / Consolidadas': liq.horasCalculadasBase,
      'Horas Proyectadas': liq.horasProyectadas,
      'Horas Computadas': liq.horasFinales,
      'Valor Hora ($)': liq.valorHora,
      'Subtotal Bruto ($)': liq.sueldoBruto,
      'Bono Presentismo ($)': liq.bonoPresentismo,
      'Estado Bono Presentismo': liq.estadoBonoPresentismo,
      'Adelantos / Descuentos ($)': liq.adelanto,
      [totalColumn]: liq.totalNeto,
      'Período': periodoLabel,
      'Tipo de Registro': tipoRegistro
    }));

    // Fila de Totales
    rows.push({
      'N°': '',
      'Trabajador': 'TOTALES CONSOLIDADOS',
      'Especialidad': '',
      'Obra Asignada': '',
      'Días Asistidos': '',
      'Días Ausente': '',
      'Días Hábiles del Período (sin feriados nacionales/UOCRA)': '',
      'Horas Registradas / Consolidadas': liquidaciones.reduce((a, b) => a + b.horasCalculadasBase, 0),
      'Horas Proyectadas': liquidaciones.reduce((a, b) => a + b.horasProyectadas, 0),
      'Horas Computadas': totalHorasLiquidadas,
      'Valor Hora ($)': promedioValorHora,
      'Subtotal Bruto ($)': liquidaciones.reduce((a, b) => a + b.sueldoBruto, 0),
      'Bono Presentismo ($)': liquidaciones.reduce((a, b) => a + b.bonoPresentismo, 0),
      'Estado Bono Presentismo': '',
      'Adelantos / Descuentos ($)': liquidaciones.reduce((a, b) => a + b.adelanto, 0),
      [totalColumn]: totalMontoPagar,
      'Período': periodoLabel,
      'Tipo de Registro': tipoRegistro
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Liquidacion_Sueldos');

    const periodoArchivo = selectedPeriodoModo === 'HISTORICO'
      ? `HISTORICO_${selectedYear}`
      : `${selectedMes}_${selectedYear}_${selectedPeriodoModo}`;
    const fileName = `PEIE_Liquidacion_Sueldos_${periodoArchivo}${isPeriodoProyectado ? '_PROYECCION' : ''}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: 'Planilla Descargada',
      description: `Se exportó ${fileName} con éxito${isPeriodoProyectado ? ' (marcado como proyección provisoria)' : ''}.`
    });
  };

  // Generar Mensaje de WhatsApp con el recibo
  const handleSendWhatsAppReceipt = (liq: any) => {
    if (!liq.empleado.whatsapp) {
      toast({ variant: 'destructive', title: 'Sin teléfono', description: 'El trabajador no tiene número de WhatsApp registrado.' });
      return;
    }

    const periodoText = selectedPeriodoModo === 'HISTORICO' 
      ? `Histórico informativo ${selectedYear}`
      : selectedPeriodoModo === 'MES' 
        ? `Mes de ${selectedMes} ${selectedYear}`
        : `${selectedPeriodoModo} (${selectedPeriodoModo === '1Q' ? '1 al 15' : '16 al fin de mes'}) de ${selectedMes} ${selectedYear}`;

    const avisoPeriodo = isPeriodoProyectado
      ? `⚠️ *NOTA DE PROYECCIÓN:* Este cálculo para *${selectedMes} ${selectedYear}* es una *ESTIMACIÓN PROVISORIA*. La última liquidación formal cerrada corresponde a *${LAST_CLOSED_PAYROLL_PERIOD_LABEL}*. Los valores de ${selectedMes} ${selectedYear} están sujetos a la asistencia final y paritarias.\n\n`
      : isPeriodoHistorico
        ? `ℹ️ *RESUMEN HISTÓRICO INFORMATIVO:* Este acumulado anual no constituye una liquidación ni un importe definitivo a pagar.\n\n`
        : '';
    const tituloMensaje = isPeriodoHistorico
      ? '*PEIE TOOLS - RESUMEN HISTÓRICO INFORMATIVO*'
      : `*PEIE TOOLS - RESUMEN DE LIQUIDACIÓN DE SUELDO*${isPeriodoProyectado ? ' (PROYECCIÓN)' : ''}`;
    const horasLabel = isPeriodoHistorico
      ? 'Horas acumuladas'
      : isPeriodoProyectado
        ? 'Horas estimadas'
        : 'Horas trabajadas';
    const subtotalLabel = isPeriodoHistorico
      ? 'Monto histórico informativo'
      : isPeriodoProyectado
        ? 'Subtotal Estimado'
        : 'Subtotal Facturado';
    const totalLabel = isPeriodoHistorico
      ? 'TOTAL HISTÓRICO INFORMATIVO'
      : isPeriodoProyectado
        ? 'TOTAL ESTIMADO A COBRAR'
        : 'TOTAL NETO FACTURADO';

    const text = `${tituloMensaje}\n\n` +
      avisoPeriodo +
      `👤 *Trabajador:* ${liq.empleado.full_name}\n` +
      `📅 *Período:* ${periodoText}${isPeriodoProyectado ? ' *(Proyección en curso)*' : ''}\n` +
      `🏗️ *Obra:* ${liq.empleado.obras?.name || 'Base Central'}\n` +
      `---------------------------------------\n` +
      `⏱️ *${horasLabel}:* ${liq.horasFinales} hs\n` +
      (isPeriodoProyectado && liq.horasProyectadas > 0
        ? `   _${liq.horasCalculadasBase} hs registradas/consolidadas + ${liq.horasProyectadas} hs proyectadas_\n`
        : '') +
      `💵 *Valor Hora:* $${liq.valorHora.toLocaleString('es-AR')}\n` +
      `💰 *${subtotalLabel}:* $${liq.sueldoBruto.toLocaleString('es-AR')}\n` +
      (liq.bonoPresentismo > 0
        ? `🎁 *Bono Presentismo (+):* $${liq.bonoPresentismo.toLocaleString('es-AR')}\n`
        : isPeriodoProyectado
          ? `🎁 *Bono Presentismo:* pendiente; no incluido por falta de registros reales/consolidados suficientes.\n`
          : '') +
      (liq.adelanto > 0 ? `🔻 *Adelantos/Descuentos (-):* $${liq.adelanto.toLocaleString('es-AR')}\n` : '') +
      `---------------------------------------\n` +
      `💲 *${totalLabel}: $${liq.totalNeto.toLocaleString('es-AR')}*\n\n` +
      `_Por cualquier duda sobre el cómputo de horas, comunicate con el área de Recursos Humanos de PEIE._`;

    const url = buildWhatsAppLink(liq.empleado.whatsapp, text);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Encabezado y Acciones Principales */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-[#031530] via-[#042454] to-[#031530] p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-2xl">
              <DollarSign className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Liquidación de Sueldos y Tarifas</h1>
              <p className="text-xs text-blue-200 font-semibold">
                Cómputo de horas trabajadas, asignación de tarifa por hora y monto facturado por operario
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setIsMasivoModalOpen(true)}
            variant="outline"
            className="border-blue-400/40 bg-blue-900/30 hover:bg-blue-800/50 text-white text-xs font-bold rounded-xl gap-2 h-10 shadow-sm"
          >
            <Sliders className="h-4 w-4 text-blue-300" />
            Tarifas Masivas ($/h)
          </Button>

          <Button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl gap-2 h-10 shadow-md"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </Button>

          <Button
            onClick={loadData}
            variant="ghost"
            className="text-white hover:bg-white/10 p-2.5 rounded-xl h-10 w-10 shrink-0"
            title="Refrescar datos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BUSCADOR PROMINENTE DE OBRERO (NOMBRE O DNI CON PRECARGA)           */}
      {/* =================================================================== */}
      <div className="relative z-30">
        <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-md p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex-1 relative">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                <Search className="h-4 w-4 text-peie-blue" />
                <span>Buscar Obrero por Nombre o DNI (Cálculo y Proyecciones Salariales)</span>
              </Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  value={searchWorkerQuery}
                  onChange={(e) => {
                    setSearchWorkerQuery(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && suggestedWorkers.length > 0) {
                      e.preventDefault();
                      const first = suggestedWorkers[0];
                      setSelectedObreroId(first.id);
                      setSearchWorkerQuery(first.full_name);
                      setIsSearchDropdownOpen(false);
                    }
                  }}
                  placeholder="Escribí el nombre del obrero (ej. Acosta, Jimenez) o su DNI..."
                  className="pl-10 pr-10 h-12 rounded-2xl border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white text-slate-900 shadow-inner"
                />
                {searchWorkerQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchWorkerQuery('');
                      setSelectedObreroId(null);
                      setIsSearchDropdownOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* LISTA DESPLEGABLE CON PRECARGA / SUGERENCIAS */}
              {isSearchDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsSearchDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-h-80 overflow-y-auto divide-y divide-slate-100 z-50 animate-fadeIn">
                    <div className="p-2.5 px-3 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>{searchWorkerQuery ? 'Obreros Coincidentes' : '⚡ Precarga de Obreros sugeridos'}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{suggestedWorkers.length} encontrados</span>
                    </div>

                    {suggestedWorkers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                        <p className="font-bold">No encontramos obreros con esa búsqueda.</p>
                        <p className="text-[11px] text-slate-400">Probá con el apellido o parte del DNI.</p>
                      </div>
                    ) : (
                      suggestedWorkers.map(emp => {
                        const vHora = Number(tarifasEditadas[emp.id]) || Number(emp.valor_hora) || valorHoraDefecto;
                        const isSelected = emp.id === selectedObreroId;
                        return (
                          <div
                            key={emp.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSelectedObreroId(emp.id);
                              setSearchWorkerQuery(emp.full_name);
                              setIsSearchDropdownOpen(false);
                            }}
                            onClick={() => {
                              setSelectedObreroId(emp.id);
                              setSearchWorkerQuery(emp.full_name);
                              setIsSearchDropdownOpen(false);
                            }}
                            className={`p-3 px-4 flex items-center justify-between hover:bg-blue-50/70 cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/90 border-l-4 border-l-peie-blue' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 font-black text-sm flex items-center justify-center shrink-0">
                                {emp.full_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm text-slate-900">{emp.full_name}</span>
                                  {emp.dni && (
                                    <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                                      DNI: {emp.dni}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 font-medium">
                                  {emp.specialty || 'Personal de Obra'} • {emp.obras?.name || 'Obra Asignada'}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-700 block">
                                ${vHora.toLocaleString('es-AR')}/h
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5 justify-end">
                                Ver Sueldo <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {selectedObrero && (
              <Button
                type="button"
                onClick={() => {
                  setSelectedObreroId(null);
                  setSearchWorkerQuery('');
                }}
                variant="outline"
                className="h-12 rounded-2xl border-slate-300 text-slate-700 text-xs font-bold shrink-0 self-end md:self-auto gap-2"
              >
                <Users className="w-4 h-4 text-peie-blue" />
                <span>Ver Nómina General</span>
              </Button>
            )}

          </div>
        </Card>
      </div>

      {/* =================================================================== */}
      {/* VISTA DETALLADA DEL OBRERO O VISTA GENERAL DE LA NÓMINA             */}
      {/* =================================================================== */}
      {selectedObrero && selectedObreroLiquidacion ? (
        <ObreroSueldoProyecciones
          empleado={selectedObrero}
          novedades={novedades}
          valorHora={Number(tarifasEditadas[selectedObrero.id]) || Number(selectedObrero.valor_hora) || valorHoraDefecto}
          onUpdateValorHora={(val) => handleSaveTarifaIndividual(selectedObrero.id, val)}
          adelanto={getScopedValue(
            adelantosMap,
            selectedObrero.id,
            selectedYear,
            selectedMes,
            selectedPeriodoModo
          ) || 0}
          onUpdateAdelanto={(val) => handleAdelantoChange(
            selectedObrero.id,
            val,
            { year: selectedYear, month: selectedMes, mode: selectedPeriodoModo }
          )}
          porcentajeBonoPresentismo={porcentajeBonoPresentismo}
          periodYear={selectedYear}
          periodMonth={selectedMes}
          availableYears={availableYears}
          periodMode={selectedPeriodoModo}
          resumenPeriodo={selectedObreroLiquidacion}
          onChangePeriodYear={setSelectedYear}
          onChangePeriodMonth={setSelectedMes}
          onChangePeriodMode={setSelectedPeriodoModo}
          onClose={() => {
            setSelectedObreroId(null);
            setSearchWorkerQuery('');
          }}
        />
      ) : (
        <>
          {/* Banner Prominente de Período en Proyección (Septiembre en adelante) */}
          {isPeriodoProyectado && (
            <div className="bg-gradient-to-r from-amber-50 via-amber-100/50 to-orange-50 border-2 border-amber-300 p-5 rounded-3xl flex items-start gap-4 text-amber-950 shadow-sm animate-in fade-in">
              <div className="p-2.5 bg-amber-200/90 rounded-2xl text-amber-900 shrink-0 mt-0.5 shadow-inner">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-black text-sm sm:text-base text-amber-900 tracking-tight uppercase">
                    Período en Proyección Salarial ({selectedMes} {selectedYear})
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 uppercase tracking-wider border border-amber-300">
                    Provisorio / No Definitivo
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Última liquidación en firme: {LAST_CLOSED_PAYROLL_PERIOD_LABEL}
                  </span>
                </div>
                <p className="text-xs text-amber-800/95 leading-relaxed font-medium">
                  La liquidación salarial formal y consolidada corresponde hasta <strong>{LAST_CLOSED_PAYROLL_PERIOD_LABEL}</strong>.
                  Los cómputos de horas, tarifas y montos a cobrar para <strong>{selectedMes} {selectedYear}</strong> se calculan en carácter de <strong>proyección estimativa</strong> en curso. Se completan los días hábiles sin registro —excluyendo fines de semana, feriados nacionales y el día UOCRA— usando el promedio observado o, si todavía no hay datos, {HORAS_DIARIAS_PROYECCION_DEFAULT} horas por día.
                </p>
              </div>
            </div>
          )}

          {/* Tarjetas de Métricas Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total a Pagar / Estimado */}
        <Card className={`rounded-2xl border-slate-200 shadow-sm overflow-hidden border-l-4 ${
          isPeriodoProyectado
            ? 'bg-gradient-to-br from-amber-50 to-white border-l-amber-500'
            : 'bg-gradient-to-br from-emerald-50 to-white border-l-emerald-500'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {isPeriodoHistorico ? 'Total Histórico' : isPeriodoProyectado ? 'Total Proyectado' : 'Total Facturado'}
              </p>
              <div className={`p-2 rounded-xl ${isPeriodoProyectado ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-600'}`}>
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              ${totalMontoPagar.toLocaleString('es-AR')}
            </p>
            <p className={`text-[11px] font-semibold mt-1 ${isPeriodoProyectado ? 'text-amber-700 font-bold' : 'text-emerald-700'}`}>
              {isPeriodoHistorico
                ? `Acumulado informativo de ${selectedYear}`
                : isPeriodoProyectado
                  ? '⚡ Estimación provisoria de nómina'
                  : `Neto total para ${liquidaciones.length} trabajadores`}
            </p>
          </CardContent>
        </Card>

        {/* Total Horas Computadas */}
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 to-white overflow-hidden border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Horas Totales</p>
              <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {totalHorasLiquidadas.toLocaleString('es-AR')} hs
            </p>
            <p className="text-[11px] font-semibold text-blue-700 mt-1">
              {selectedPeriodoModo === 'HISTORICO' ? `Histórico ${selectedYear}` : `${selectedPeriodoModo} - ${selectedMes} ${selectedYear}`}
            </p>
          </CardContent>
        </Card>

        {/* Promedio Valor Hora */}
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-gradient-to-br from-amber-50 to-white overflow-hidden border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tarifa Promedio</p>
              <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              ${promedioValorHora.toLocaleString('es-AR')} <span className="text-xs font-bold text-slate-500">/h</span>
            </p>
            <p className="text-[11px] font-semibold text-amber-700 mt-1">
              Base global: ${valorHoraDefecto.toLocaleString('es-AR')}/h
            </p>
          </CardContent>
        </Card>

        {/* Cantidad de Operarios */}
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-gradient-to-br from-purple-50 to-white overflow-hidden border-l-4 border-l-purple-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Nómina Total</p>
              <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {liquidaciones.length} Operarios
            </p>
            <p className="text-[11px] font-semibold text-purple-700 mt-1">
              {liquidaciones.filter(l => l.horasFinales > 0).length} con horas computadas
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Barra de Filtros de Período y Búsqueda */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
        <CardContent className="p-5 space-y-4">
          
          {/* Selector de Modo de Período */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-peie-blue" /> Tramo Temporal:
            </span>

            <Button
              type="button"
              size="sm"
              onClick={() => setSelectedPeriodoModo('HISTORICO')}
              className={`rounded-xl text-xs font-bold h-8 px-3 transition-all ${
                selectedPeriodoModo === 'HISTORICO'
                  ? 'bg-peie-blue text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Histórico / Año Completo
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setSelectedPeriodoModo('MES')}
              className={`rounded-xl text-xs font-bold h-8 px-3 transition-all ${
                selectedPeriodoModo === 'MES'
                  ? 'bg-peie-blue text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Mes Completo
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setSelectedPeriodoModo('1Q')}
              className={`rounded-xl text-xs font-bold h-8 px-3 transition-all ${
                selectedPeriodoModo === '1Q'
                  ? 'bg-peie-blue text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              1ª Quincena (1 al 15)
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setSelectedPeriodoModo('2Q')}
              className={`rounded-xl text-xs font-bold h-8 px-3 transition-all ${
                selectedPeriodoModo === '2Q'
                  ? 'bg-peie-blue text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              2ª Quincena (16 al 31)
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Año */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-peie-blue" /> Año
              </Label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-peie-blue text-slate-800"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            {/* Mes (si no es histórico) */}
            {selectedPeriodoModo !== 'HISTORICO' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-peie-blue" /> Mes
                </Label>
                <select
                  value={selectedMes}
                  onChange={(e) => setSelectedMes(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-peie-blue text-slate-800"
                >
                  {MESES.map((m, idx) => (
                    <option key={m} value={m}>
                      {m} {selectedYear === LAST_CLOSED_PAYROLL_PERIOD.year && idx === LAST_CLOSED_PAYROLL_PERIOD.monthIndex
                        ? '• (Última liquidación en firme)'
                        : isAfterLastClosedPayrollPeriod(selectedYear, m)
                          ? '• (Proyección provisoria)'
                          : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Obra */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-peie-blue" /> Filtrar por Obra
              </Label>
              <select
                value={selectedObraId}
                onChange={(e) => setSelectedObraId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-peie-blue text-slate-800"
              >
                <option value="TODAS">Todas las Obras</option>
                {obrasList.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Buscador */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-peie-blue" /> Buscar Operario
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Nombre o especialidad..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 pl-9 text-xs rounded-xl border-slate-200 font-medium"
                />
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Banner Informativo sobre edición en vivo */}
      <div className="bg-blue-50/80 border border-blue-200/80 p-4 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
        <Sparkles className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold">Cálculo en tiempo real y edición directa</p>
          <p className="text-blue-800 font-medium">
            Las horas se leen automáticamente de los registros de asistencia. Si un operario no cargó asistencia aún o querés liquidarle horas fijas, <strong>podés tipear directamente las horas o la tarifa en la tabla</strong> y el total se actualizará al instante.
          </p>
        </div>
      </div>

      {/* Tabla Principal de Liquidaciones */}
      <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-black text-slate-900">
                Planilla de Liquidación y Sueldos ({selectedPeriodoModo === 'HISTORICO' ? `Histórico ${selectedYear}` : `${selectedPeriodoModo} - ${selectedMes} ${selectedYear}`})
              </h2>
              {isPeriodoProyectado && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                  ⚡ PROYECCIÓN ESTIMATIVA
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {isPeriodoHistorico
                ? 'Resumen anual informativo; no representa una liquidación ni un importe definitivo a pagar.'
                : isPeriodoProyectado
                ? 'Valores proyectados provisorios. Podés ajustar horas y tarifas para simular la liquidación.'
                : 'Podés ajustar horas, valor por hora y deducciones por operario.'}
            </p>
          </div>
          <span className="px-3 py-1 bg-peie-blue/10 text-peie-blue font-black text-xs rounded-full border border-peie-blue/20">
            {liquidaciones.length} Trabajadores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4">Operario</th>
                <th className="py-3.5 px-3">Obra</th>
                <th className="py-3.5 px-3 text-center">
                  {isPeriodoHistorico ? 'Horas Acumuladas' : isPeriodoProyectado ? 'Horas Estimadas' : 'Horas Trabajadas'}
                </th>
                <th className="py-3.5 px-3 text-center">Asistencias</th>
                <th className="py-3.5 px-3 text-right">Valor Hora ($)</th>
                <th className="py-3.5 px-3 text-right">
                  {isPeriodoHistorico ? 'Monto Histórico' : isPeriodoProyectado ? 'Subtotal Estimado' : 'Subtotal Facturado'}
                </th>
                <th className="py-3.5 px-3 text-right">Presentismo ($)</th>
                <th className="py-3.5 px-3 text-right">Adelantos ($)</th>
                <th className={`py-3.5 px-4 text-right ${isPeriodoProyectado ? 'bg-amber-100/70 text-amber-950 border-b border-amber-300' : 'bg-emerald-50/60 text-emerald-950'} font-extrabold`}>
                  {isPeriodoHistorico ? 'Total Informativo' : isPeriodoProyectado ? 'Total Estimado' : 'Total a Cobrar'}
                </th>
                <th className="py-3.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {liquidaciones.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 font-semibold">
                    No se encontraron trabajadores para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                liquidaciones.map((liq) => {
                  const emp = liq.empleado;
                  const currentValorHora = tarifasEditadas[emp.id] !== undefined ? tarifasEditadas[emp.id] : (emp.valor_hora || valorHoraDefecto);

                  return (
                    <tr key={emp.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* Operario */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black shrink-0 overflow-hidden border border-blue-200">
                            {emp.photo_url ? (
                              <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                            ) : (
                              emp.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 truncate">{emp.full_name}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">{emp.specialty || 'General'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Obra */}
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-800">
                          {emp.obras?.name || 'Base Central'}
                        </span>
                      </td>

                      {/* Input / Botón de Horas Trabajadas */}
                      <td className="py-3 px-3 text-center">
                        <div>
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={liq.horasFinales || ''}
                              placeholder="0"
                              onChange={(e) => handleHorasManualChange(
                                emp.id,
                                e.target.value === '' ? undefined : Number(e.target.value)
                              )}
                              className="w-16 h-8 text-center font-black text-xs rounded-lg border-blue-300 bg-blue-50/50 px-1 text-blue-900"
                              title="Editar horas computadas"
                            />
                            <span className="text-[11px] font-bold text-slate-400">hs</span>
                          </div>
                          {isPeriodoProyectado && !liq.ajusteManualHoras && (
                            <p className="mt-1 text-[9px] font-semibold text-amber-700 whitespace-nowrap">
                              {liq.horasCalculadasBase} reales + {liq.horasProyectadas} proy.
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Asistencias / Ausencias */}
                      <td className="py-3 px-3 text-center">
                        {liq.novedadesList.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedEmpleadoNovedades({ emp, items: liq.novedadesList })}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border"
                            title="Ver registros diarios de asistencia"
                          >
                            {liq.diasPresente} pres. / {liq.diasAusente} aus.
                          </button>
                        ) : (
                          <span className="text-slate-400 font-medium text-[10px]">Sin registro</span>
                        )}
                      </td>

                      {/* Input de Valor Hora */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-slate-400 font-bold">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={currentValorHora || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setTarifasEditadas(prev => ({ ...prev, [emp.id]: val }));
                            }}
                            className="w-24 h-8 text-right font-black text-xs rounded-lg border-slate-200 px-2 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveTarifaIndividual(emp.id)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200 transition-all active:scale-95"
                            title="Guardar tarifa para este trabajador"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Subtotal Facturado / Sueldo Bruto */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        ${liq.sueldoBruto.toLocaleString('es-AR')}
                      </td>

                      {/* Bono Presentismo */}
                      <td className="py-3 px-3 text-right">
                        {liq.bonoPresentismo > 0 ? (
                          <span className="font-bold text-emerald-600">
                            +${liq.bonoPresentismo.toLocaleString('es-AR')}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">
                            {isPeriodoProyectado ? 'Pendiente' : '$0'}
                          </span>
                        )}
                      </td>

                      {/* Adelantos / Deducciones */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-400 font-bold">-</span>
                          <Input
                            type="number"
                            min="0"
                            step="500"
                            placeholder="0"
                            value={liq.adelanto || ''}
                            onChange={(e) => handleAdelantoChange(
                              emp.id,
                              e.target.value === '' ? undefined : Number(e.target.value)
                            )}
                            className="w-20 h-8 text-right font-semibold text-xs rounded-lg border-slate-200 px-2 text-rose-600 bg-white"
                          />
                        </div>
                      </td>

                      {/* Total Neto */}
                      <td className={`py-3 px-4 text-right ${isPeriodoProyectado ? 'bg-amber-50/80 border-l border-amber-200' : 'bg-emerald-50/50'}`}>
                        <span className={`text-sm font-black ${isPeriodoProyectado ? 'text-amber-950' : 'text-emerald-900'}`}>
                          ${liq.totalNeto.toLocaleString('es-AR')}
                        </span>
                        {isPeriodoProyectado && (
                          <span className="block text-[9px] font-black text-amber-700 uppercase tracking-tighter">
                            Proyectado
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Ver Proyecciones & Sueldo Detallado */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedObreroId(emp.id);
                              setSearchWorkerQuery(emp.full_name);
                            }}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-all"
                            title="Ver proyecciones, cuánto cobrará este mes, próximos meses e historial"
                          >
                            <TrendingUp className="h-4 w-4" />
                          </button>

                          {/* Recibo Individual */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLiquidacionForReceipt(liq);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                            title="Ver e imprimir recibo de sueldo"
                          >
                            <FileText className="h-4 w-4" />
                          </button>

                          {/* WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppReceipt(liq)}
                            className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-all"
                            title="Enviar liquidación por WhatsApp"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer con Totales */}
            {liquidaciones.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs">
                  <td colSpan={2} className="py-4 px-4 uppercase tracking-wider">
                    Totales ({liquidaciones.length} Operarios)
                  </td>
                  <td className="py-4 px-3 text-center text-blue-300">
                    {totalHorasLiquidadas.toLocaleString('es-AR')} hs
                  </td>
                  <td className="py-4 px-3 text-center text-slate-400">
                    -
                  </td>
                  <td className="py-4 px-3 text-right text-amber-300">
                    Prom: ${promedioValorHora.toLocaleString('es-AR')}/h
                  </td>
                  <td className="py-4 px-3 text-right">
                    ${liquidaciones.reduce((a, b) => a + b.sueldoBruto, 0).toLocaleString('es-AR')}
                  </td>
                  <td className="py-4 px-3 text-right text-emerald-300">
                    +${liquidaciones.reduce((a, b) => a + b.bonoPresentismo, 0).toLocaleString('es-AR')}
                  </td>
                  <td className="py-4 px-3 text-right text-rose-300">
                    -${liquidaciones.reduce((a, b) => a + b.adelanto, 0).toLocaleString('es-AR')}
                  </td>
                  <td className={`py-4 px-4 text-right text-base ${isPeriodoProyectado ? 'text-amber-300' : 'text-emerald-400'}`}>
                    ${totalMontoPagar.toLocaleString('es-AR')}
                  </td>
                  <td className="py-4 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
      </>
      )}

      {/* MODAL 1: ASIGNACIÓN MASIVA DE TARIFAS */}
      <Dialog open={isMasivoModalOpen} onOpenChange={setIsMasivoModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-peie-blue" />
              Configurar Tarifas Masivas ($/hora)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Asigná el valor de la hora de forma masiva a toda la nómina o diferenciado por especialidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            
            {/* Opción 1: Tarifa Global para Todos */}
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-3">
              <p className="text-xs font-black text-blue-900 uppercase tracking-wide">1. Tarifa Plana General</p>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <Input
                    type="number"
                    step="100"
                    value={tarifaMasivaGlobal}
                    onChange={(e) => setTarifaMasivaGlobal(Number(e.target.value))}
                    className="pl-7 font-black text-sm h-10 rounded-xl bg-white border-slate-200"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAplicarTarifaGlobal}
                  disabled={savingTarifas}
                  className="bg-peie-blue hover:bg-blue-700 text-white font-bold text-xs rounded-xl h-10 px-4 shrink-0 shadow-sm"
                >
                  Aplicar a Todos
                </Button>
              </div>
              <p className="text-[10px] text-slate-500">Aplica este valor hora a todos los trabajadores registrados.</p>
            </div>

            {/* Opción 2: Tarifas por Especialidad */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <p className="text-xs font-black text-slate-800 uppercase tracking-wide">2. Tarifas por Especialidad / Oficio</p>
              
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {Object.keys(tarifasPorEspecialidad).map(spec => (
                  <div key={spec} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-700 w-32 truncate">{spec}:</span>
                    <div className="relative flex-1 max-w-[140px]">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <Input
                        type="number"
                        step="100"
                        value={tarifasPorEspecialidad[spec]}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setTarifasPorEspecialidad(prev => ({ ...prev, [spec]: val }));
                        }}
                        className="pl-6 h-8 text-right font-bold text-xs rounded-lg bg-white border-slate-200"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={handleAplicarTarifasPorEspecialidad}
                disabled={savingTarifas}
                variant="outline"
                className="w-full border-slate-300 text-slate-800 hover:bg-slate-100 font-bold text-xs rounded-xl h-9 mt-2"
              >
                Aplicar por Especialidad
              </Button>
            </div>

          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsMasivoModalOpen(false)}
              className="w-full text-slate-500 font-bold text-xs"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: RECIBO DE SUELDO INDIVIDUAL / IMPRIMIBLE */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 bg-white shadow-2xl">
          {selectedLiquidacionForReceipt && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {isPeriodoHistorico
                      ? 'Resumen Histórico Informativo'
                      : isPeriodoProyectado
                        ? 'Proyección Provisoria de Liquidación'
                        : 'Recibo de Liquidación'}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">PEIE - Soluciones Eléctricas e Industriales</p>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                    isPeriodoHistorico
                      ? 'bg-slate-100 text-slate-700 border border-slate-300'
                      : isPeriodoProyectado
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-blue-100 text-peie-blue'
                  }`}>
                    {isPeriodoHistorico ? 'INFORMATIVO / NO PAGABLE' : isPeriodoProyectado ? 'PROVISORIO / NO DEFINITIVO' : selectedPeriodoModo}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    {selectedPeriodoModo === 'HISTORICO' ? `Año ${selectedYear}` : `${selectedMes} ${selectedYear}`}
                  </p>
                </div>
              </div>

              {isPeriodoProyectado && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-black uppercase tracking-wide">Estimación sin valor de liquidación definitiva</p>
                  <p className="mt-1 font-medium">
                    Incluye horas proyectadas para completar los días hábiles de {selectedMes} {selectedYear}. La última liquidación cerrada es {LAST_CLOSED_PAYROLL_PERIOD_LABEL}.
                  </p>
                </div>
              )}

              {isPeriodoHistorico && (
                <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-3 text-xs text-slate-800">
                  <p className="font-black uppercase tracking-wide">Resumen anual sin valor de recibo</p>
                  <p className="mt-1 font-medium">
                    Este acumulado de {selectedYear} es informativo y no representa una liquidación ni un importe definitivo a pagar.
                  </p>
                </div>
              )}

              {/* Datos del Trabajador */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1 text-xs">
                <p className="text-sm font-extrabold text-slate-900">{selectedLiquidacionForReceipt.empleado.full_name}</p>
                <p className="text-slate-600"><strong>Especialidad:</strong> {selectedLiquidacionForReceipt.empleado.specialty || 'General'}</p>
                <p className="text-slate-600"><strong>Obra Asignada:</strong> {selectedLiquidacionForReceipt.empleado.obras?.name || 'Base Central'}</p>
                {selectedLiquidacionForReceipt.empleado.whatsapp && (
                  <p className="text-slate-600"><strong>Contacto:</strong> {selectedLiquidacionForReceipt.empleado.whatsapp}</p>
                )}
              </div>

              {/* Desglose de Liquidación */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <div className="bg-slate-100 px-4 py-2 font-black text-slate-700 uppercase tracking-wider text-[10px]">
                  {isPeriodoHistorico ? 'Conceptos Históricos' : isPeriodoProyectado ? 'Conceptos Estimados' : 'Conceptos Liquidados'}
                </div>
                <div className="divide-y divide-slate-100 p-4 space-y-2">
                  
                  <div className="flex justify-between items-center text-slate-700">
                    <span>{isPeriodoHistorico ? 'Horas acumuladas' : isPeriodoProyectado ? 'Horas estimadas' : 'Horas trabajadas'} ({selectedLiquidacionForReceipt.horasFinales} hs x ${selectedLiquidacionForReceipt.valorHora.toLocaleString('es-AR')})</span>
                    <span className="font-bold">${selectedLiquidacionForReceipt.sueldoBruto.toLocaleString('es-AR')}</span>
                  </div>

                  {isPeriodoProyectado && selectedLiquidacionForReceipt.horasProyectadas > 0 && (
                    <div className="flex justify-between items-center text-amber-800 text-[11px]">
                      <span>Detalle de horas: registradas/consolidadas + proyectadas</span>
                      <span className="font-bold">
                        {selectedLiquidacionForReceipt.horasCalculadasBase} + {selectedLiquidacionForReceipt.horasProyectadas} hs
                      </span>
                    </div>
                  )}

                  {selectedLiquidacionForReceipt.bonoPresentismo > 0 && (
                    <div className="flex justify-between items-center text-emerald-700 pt-2">
                      <span>Bono Presentismo y Puntualidad (+{porcentajeBonoPresentismo}%)</span>
                      <span className="font-bold">+${selectedLiquidacionForReceipt.bonoPresentismo.toLocaleString('es-AR')}</span>
                    </div>
                  )}

                  {isPeriodoProyectado && selectedLiquidacionForReceipt.bonoPresentismo === 0 && (
                    <div className="flex justify-between items-center text-amber-800 pt-2">
                      <span>Bono Presentismo y Puntualidad</span>
                      <span className="font-bold">Pendiente · no incluido</span>
                    </div>
                  )}

                  {selectedLiquidacionForReceipt.adelanto > 0 && (
                    <div className="flex justify-between items-center text-rose-700 pt-2">
                      <span>Adelantos / Descuentos varios</span>
                      <span className="font-bold">-${selectedLiquidacionForReceipt.adelanto.toLocaleString('es-AR')}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-slate-900 pt-3 text-sm font-black border-t border-slate-200">
                    <span>{isPeriodoHistorico ? 'TOTAL HISTÓRICO INFORMATIVO:' : isPeriodoProyectado ? 'TOTAL ESTIMADO A COBRAR:' : 'TOTAL FACTURADO / A COBRAR:'}</span>
                    <span className={`${isPeriodoHistorico ? 'text-slate-700' : isPeriodoProyectado ? 'text-amber-800' : 'text-emerald-700'} text-base`}>
                      ${selectedLiquidacionForReceipt.totalNeto.toLocaleString('es-AR')}
                    </span>
                  </div>

                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => handleSendWhatsAppReceipt(selectedLiquidacionForReceipt)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl h-11 gap-2"
                >
                  <Send className="h-4 w-4" />
                  Enviar por WhatsApp
                </Button>

                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  className="border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl h-11 gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 3: DESGLOSE DIARIO DE HORAS DEL OPERARIO */}
      <Dialog open={Boolean(selectedEmpleadoNovedades)} onOpenChange={() => setSelectedEmpleadoNovedades(null)}>
        <DialogContent className="max-w-lg rounded-3xl p-6 bg-white shadow-2xl">
          {selectedEmpleadoNovedades && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-lg font-black text-slate-900">
                  Asistencia Diaria: {selectedEmpleadoNovedades.emp.full_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Registros computados en {selectedPeriodoModo === 'HISTORICO' ? `el año ${selectedYear}` : `${selectedMes} ${selectedYear}`} ({selectedPeriodoModo})
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
                {selectedEmpleadoNovedades.items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-semibold">
                    No hay registros de asistencia cargados en este período.
                  </div>
                ) : (
                  selectedEmpleadoNovedades.items.map((item, idx) => (
                    <div key={item.id || idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <p className="font-bold text-slate-800">{item.fecha}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{item.obra_nombre || 'Sin obra'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.estado === 'PRESENTE' ? 'bg-emerald-100 text-emerald-700' :
                          item.estado === 'AUSENTE' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {item.estado}
                        </span>
                        <span className="font-black text-slate-900 text-sm">
                          {item.horas_trabajadas} hs
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={() => setSelectedEmpleadoNovedades(null)}
                  className="w-full bg-slate-900 text-white font-bold text-xs rounded-xl h-10"
                >
                  Entendido
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
