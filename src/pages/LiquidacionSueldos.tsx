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
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { buildWhatsAppLink } from '../lib/whatsapp';
import * as XLSX from 'xlsx';

interface EmpleadoSueldo {
  id: string;
  full_name: string;
  specialty?: string | null;
  whatsapp?: string | null;
  photo_url?: string | null;
  obra_id?: string | null;
  obras?: { name: string } | null;
  valor_hora?: number | null;
  valor_hora_extra?: number | null;
}

interface NovedadRegistro {
  id: string;
  empleado_id?: string;
  empleado_nombre: string;
  fecha: string;
  mes: string;
  quincena: string;
  obra_id?: string;
  obra_nombre?: string;
  horas_trabajadas: number;
  horas_ausente?: number;
  estado: string;
}

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

export default function LiquidacionSueldos() {
  const { toast } = useToast();

  // Estados principales
  const [empleados, setEmpleados] = useState<EmpleadoSueldo[]>([]);
  const [novedades, setNovedades] = useState<NovedadRegistro[]>([]);
  const [obrasList, setObrasList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de Período
  const currentMonthIdx = new Date().getMonth();
  const currentDay = new Date().getDate();
  const [selectedMes, setSelectedMes] = useState<string>(MESES[currentMonthIdx] || 'AGOSTO');
  const [selectedQuincena, setSelectedQuincena] = useState<'1Q' | '2Q' | 'TODO_EL_MES'>(currentDay <= 15 ? '1Q' : '2Q');
  const [selectedObraId, setSelectedObraId] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Tarifas en memoria / edición
  const [tarifasEditadas, setTarifasEditadas] = useState<Record<string, number>>({});
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

  // 1. Cargar Datos
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Empleados
      const { data: empData, error: empErr } = await supabase
        .from('empleados')
        .select('id, full_name, specialty, whatsapp, photo_url, obra_id, valor_hora, valor_hora_extra, obras(name)')
        .order('full_name');

      if (empErr) console.warn('Error al cargar empleados:', empErr.message);

      // Cargar tarifas guardadas en localStorage como backup/fallback
      const localTarifasSaved: Record<string, number> = {};
      try {
        const raw = localStorage.getItem('peie_tarifas_horas');
        if (raw) Object.assign(localTarifasSaved, JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }

      const formattedEmps: EmpleadoSueldo[] = (empData || []).map((e: any) => {
        const obraObj = Array.isArray(e.obras) ? e.obras[0] : e.obras;
        const vHora = Number(e.valor_hora) || localTarifasSaved[e.id] || 0;
        return {
          ...e,
          obras: obraObj,
          valor_hora: vHora
        };
      });

      setEmpleados(formattedEmps);

      // Poblar el mapa de edición
      const mapInicial: Record<string, number> = {};
      formattedEmps.forEach(emp => {
        mapInicial[emp.id] = emp.valor_hora || 0;
      });
      setTarifasEditadas(mapInicial);

      // 2. Cargar Novedades Diarias
      const { data: novData } = await supabase
        .from('novedades_diarias')
        .select('*')
        .order('fecha', { ascending: true });

      setNovedades((novData as NovedadRegistro[]) || []);

      // 3. Cargar Obras
      const { data: oData } = await supabase
        .from('obras')
        .select('id, name')
        .eq('active', true)
        .order('name');

      setObrasList(oData || []);

      // 4. Cargar Reglas de Sueldos
      const { data: regData } = await supabase
        .from('reglas_horas_trabajadores')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (regData) {
        if (regData.valor_hora_defecto) setValorHoraDefecto(Number(regData.valor_hora_defecto));
        if (regData.porcentaje_bono) setPorcentajeBonoPresentismo(Number(regData.porcentaje_bono));
        if (regData.horas_objetivo_quincena) setHorasObjetivoQuincena(Number(regData.horas_objetivo_quincena));
      }
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos de liquidación.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Guardar mapa de adelantos en localStorage
  const handleAdelantoChange = (empId: string, valor: number) => {
    const next = { ...adelantosMap, [empId]: valor };
    setAdelantosMap(next);
    localStorage.setItem('peie_adelantos_sueldos', JSON.stringify(next));
  };

  // Guardar Tarifa de un empleado individual
  const handleSaveTarifaIndividual = async (empId: string) => {
    const valor = Number(tarifasEditadas[empId]) || 0;
    try {
      // Guardar local
      const localTarifas: Record<string, number> = {};
      try {
        const raw = localStorage.getItem('peie_tarifas_horas');
        if (raw) Object.assign(localTarifas, JSON.parse(raw));
      } catch {}
      localTarifas[empId] = valor;
      localStorage.setItem('peie_tarifas_horas', JSON.stringify(localTarifas));

      // Guardar en Supabase (con fallback seguro si la columna no existe aún)
      const { error } = await supabase
        .from('empleados')
        .update({ valor_hora: valor })
        .eq('id', empId);

      if (error) {
        console.warn('Columna valor_hora no disponible en base aún. Guardado en caché local.', error.message);
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

      // Guardar en Supabase
      await supabase
        .from('empleados')
        .update({ valor_hora: tarifaMasivaGlobal })
        .neq('id', '00000000-0000-0000-0000-000000000000');

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

  // 2. Filtro de Novedades del Período
  const filteredNovedades = useMemo(() => {
    return novedades.filter(nov => {
      // Filtro de mes
      if (nov.mes?.toUpperCase() !== selectedMes.toUpperCase()) return false;

      // Filtro de quincena
      if (selectedQuincena !== 'TODO_EL_MES') {
        const day = Number(nov.fecha?.split('-')[2]) || 0;
        if (selectedQuincena === '1Q' && day > 15) return false;
        if (selectedQuincena === '2Q' && day <= 15) return false;
      }

      return true;
    });
  }, [novedades, selectedMes, selectedQuincena]);

  // 3. Cómputo y Liquidación para cada empleado
  const liquidaciones = useMemo(() => {
    return empleados
      .filter(emp => {
        if (selectedObraId !== 'TODAS' && emp.obra_id !== selectedObraId) return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase().trim();
          const matchName = emp.full_name.toLowerCase().includes(term);
          const matchSpec = (emp.specialty || '').toLowerCase().includes(term);
          const matchObra = (emp.obras?.name || '').toLowerCase().includes(term);
          if (!matchName && !matchSpec && !matchObra) return false;
        }
        return true;
      })
      .map(emp => {
        // Novedades de este empleado en el período
        const empNovs = filteredNovedades.filter(n => 
          (n.empleado_id && n.empleado_id === emp.id) || 
          (n.empleado_nombre && n.empleado_nombre.trim().toLowerCase() === emp.full_name.trim().toLowerCase())
        );

        // Sumatorias de horas
        const horasTrabajadas = empNovs.reduce((acc, curr) => acc + (Number(curr.horas_trabajadas) || 0), 0);
        const horasAusente = empNovs.reduce((acc, curr) => acc + (Number(curr.horas_ausente) || 0), 0);
        const diasPresente = empNovs.filter(n => n.estado === 'PRESENTE' || n.horas_trabajadas > 0).length;
        const diasAusente = empNovs.filter(n => n.estado === 'AUSENTE').length;
        const diasTardanza = empNovs.filter(n => n.estado === 'LLEGADA TARDE').length;

        // Valor Hora (de la grilla de edición o fallback)
        const valorHora = Number(tarifasEditadas[emp.id]) || Number(emp.valor_hora) || valorHoraDefecto;
        const sueldoBruto = horasTrabajadas * valorHora;

        // Bono Presentismo (si no tuvo ausencias injustificadas y cumplió las horas quincenales)
        const cumplePresentismo = diasAusente === 0 && (horasTrabajadas >= horasObjetivoQuincena || diasPresente >= 10);
        const bonoPresentismo = cumplePresentismo ? Math.round((sueldoBruto * porcentajeBonoPresentismo) / 100) : 0;

        // Adelantos / deducciones
        const adelanto = Number(adelantosMap[emp.id]) || 0;

        // Total Neto
        const totalNeto = Math.max(0, sueldoBruto + bonoPresentismo - adelanto);

        return {
          empleado: emp,
          horasTrabajadas,
          horasAusente,
          diasPresente,
          diasAusente,
          diasTardanza,
          valorHora,
          sueldoBruto,
          bonoPresentismo,
          cumplePresentismo,
          adelanto,
          totalNeto,
          novedadesList: empNovs
        };
      });
  }, [
    empleados, 
    filteredNovedades, 
    selectedObraId, 
    searchTerm, 
    tarifasEditadas, 
    valorHoraDefecto, 
    porcentajeBonoPresentismo, 
    horasObjetivoQuincena,
    adelantosMap
  ]);

  // Métricas Consolidadas
  const totalMontoPagar = useMemo(() => liquidaciones.reduce((acc, curr) => acc + curr.totalNeto, 0), [liquidaciones]);
  const totalHorasLiquidadas = useMemo(() => liquidaciones.reduce((acc, curr) => acc + curr.horasTrabajadas, 0), [liquidaciones]);
  const promedioValorHora = useMemo(() => {
    if (liquidaciones.length === 0) return 0;
    const sum = liquidaciones.reduce((acc, curr) => acc + curr.valorHora, 0);
    return Math.round(sum / liquidaciones.length);
  }, [liquidaciones]);

  // Exportar a Excel
  const handleExportExcel = () => {
    if (liquidaciones.length === 0) {
      toast({ variant: 'destructive', title: 'Sin datos', description: 'No hay liquidaciones para exportar en este período.' });
      return;
    }

    const rows: any[] = liquidaciones.map((liq, idx) => ({
      'N°': idx + 1,
      'Trabajador': liq.empleado.full_name,
      'Especialidad': liq.empleado.specialty || 'General',
      'Obra Asignada': liq.empleado.obras?.name || 'Base / Sin Asignar',
      'Días Trabajados': liq.diasPresente,
      'Días Ausente': liq.diasAusente,
      'Horas Totales': liq.horasTrabajadas,
      'Valor Hora ($)': liq.valorHora,
      'Sueldo Bruto ($)': liq.sueldoBruto,
      'Bono Presentismo ($)': liq.bonoPresentismo,
      'Adelantos / Descuentos ($)': liq.adelanto,
      'TOTAL NETO A PAGAR ($)': liq.totalNeto,
      'Período': `${selectedQuincena === 'TODO_EL_MES' ? 'Mes Completo' : selectedQuincena} - ${selectedMes}`
    }));

    // Fila de Totales
    rows.push({
      'N°': '',
      'Trabajador': 'TOTALES CONSOLIDADOS',
      'Especialidad': '',
      'Obra Asignada': '',
      'Días Trabajados': '',
      'Días Ausente': '',
      'Horas Totales': totalHorasLiquidadas,
      'Valor Hora ($)': promedioValorHora,
      'Sueldo Bruto ($)': liquidaciones.reduce((a, b) => a + b.sueldoBruto, 0),
      'Bono Presentismo ($)': liquidaciones.reduce((a, b) => a + b.bonoPresentismo, 0),
      'Adelantos / Descuentos ($)': liquidaciones.reduce((a, b) => a + b.adelanto, 0),
      'TOTAL NETO A PAGAR ($)': totalMontoPagar,
      'Período': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Liquidacion_Sueldos');

    const fileName = `PEIE_Liquidacion_Sueldos_${selectedMes}_${selectedQuincena}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({ title: 'Planilla Descargada', description: `Se exportó ${fileName} con éxito.` });
  };

  // Generar Mensaje de WhatsApp con el recibo
  const handleSendWhatsAppReceipt = (liq: any) => {
    if (!liq.empleado.whatsapp) {
      toast({ variant: 'destructive', title: 'Sin teléfono', description: 'El trabajador no tiene número de WhatsApp registrado.' });
      return;
    }

    const periodoText = selectedQuincena === 'TODO_EL_MES' 
      ? `Mes de ${selectedMes}` 
      : `${selectedQuincena} (${selectedQuincena === '1Q' ? '1 al 15' : '16 al fin de mes'}) de ${selectedMes}`;

    const text = `*PEIE TOOLS - RESUMEN DE LIQUIDACIÓN DE SUELDO*\n\n` +
      `👤 *Trabajador:* ${liq.empleado.full_name}\n` +
      `📅 *Período:* ${periodoText}\n` +
      `🏗️ *Obra:* ${liq.empleado.obras?.name || 'Base Central'}\n` +
      `---------------------------------------\n` +
      `⏱️ *Horas Trabajadas:* ${liq.horasTrabajadas} hs\n` +
      `💵 *Valor Hora:* $${liq.valorHora.toLocaleString('es-AR')}\n` +
      `💰 *Subtotal Bruto:* $${liq.sueldoBruto.toLocaleString('es-AR')}\n` +
      (liq.bonoPresentismo > 0 ? `🎁 *Bono Presentismo (+):* $${liq.bonoPresentismo.toLocaleString('es-AR')}\n` : '') +
      (liq.adelanto > 0 ? `🔻 *Adelantos/Descuentos (-):* $${liq.adelanto.toLocaleString('es-AR')}\n` : '') +
      `---------------------------------------\n` +
      `💲 *TOTAL NETO A COBRAR: $${liq.totalNeto.toLocaleString('es-AR')}*\n\n` +
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
              <h1 className="text-2xl font-black tracking-tight">Liquidación de Sueldos</h1>
              <p className="text-xs text-blue-200 font-semibold">Cómputo automático de horas, asignación de tarifas y liquidación quincenal</p>
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
            Configurar Tarifas Masivas
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

      {/* Tarjetas de Métricas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total a Pagar */}
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50 to-white overflow-hidden border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Liquidado</p>
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              ${totalMontoPagar.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] font-semibold text-emerald-700 mt-1">
              Neto total para {liquidaciones.length} trabajadores
            </p>
          </CardContent>
        </Card>

        {/* Total Horas Computadas */}
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 to-white overflow-hidden border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Horas Trabajadas</p>
              <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {totalHorasLiquidadas.toLocaleString('es-AR')} hs
            </p>
            <p className="text-[11px] font-semibold text-blue-700 mt-1">
              Registradas en {selectedMes} ({selectedQuincena})
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
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Nómina Activa</p>
              <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {liquidaciones.length} Operarios
            </p>
            <p className="text-[11px] font-semibold text-purple-700 mt-1">
              {liquidaciones.filter(l => l.horasTrabajadas > 0).length} con horas en este período
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Barra de Filtros de Período y Búsqueda */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Mes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-peie-blue" /> Mes
              </Label>
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-peie-blue text-slate-800"
              >
                {MESES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Quincena */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-peie-blue" /> Quincena / Tramo
              </Label>
              <select
                value={selectedQuincena}
                onChange={(e) => setSelectedQuincena(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-peie-blue text-slate-800"
              >
                <option value="1Q">1ª Quincena (Días 1 al 15)</option>
                <option value="2Q">2ª Quincena (Días 16 al fin de mes)</option>
                <option value="TODO_EL_MES">Mes Completo (1 al 31)</option>
              </select>
            </div>

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

      {/* Tabla Principal de Liquidaciones */}
      <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Detalle de Liquidación ({selectedQuincena === 'TODO_EL_MES' ? 'Mes Completo' : selectedQuincena} - {selectedMes})
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Ingresá el valor hora para cada operario o modificalo en vivo. Las horas se computan de la asistencia.
            </p>
          </div>
          <span className="px-3 py-1 bg-peie-blue/10 text-peie-blue font-black text-xs rounded-full border border-peie-blue/20">
            {liquidaciones.length} Registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4">Operario</th>
                <th className="py-3.5 px-3">Obra</th>
                <th className="py-3.5 px-3 text-center">Horas Reg.</th>
                <th className="py-3.5 px-3 text-center">Ausencias</th>
                <th className="py-3.5 px-3 text-right">Valor Hora ($)</th>
                <th className="py-3.5 px-3 text-right">Bruto ($)</th>
                <th className="py-3.5 px-3 text-right">Presentismo ($)</th>
                <th className="py-3.5 px-3 text-right">Adelantos ($)</th>
                <th className="py-3.5 px-4 text-right bg-emerald-50/50 text-emerald-950 font-extrabold">Neto a Cobrar</th>
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
                  const currentValorHora = tarifasEditadas[emp.id] !== undefined ? tarifasEditadas[emp.id] : (emp.valor_hora || 0);

                  return (
                    <tr key={emp.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* Operario */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black shrink-0 overflow-hidden border border-blue-200">
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

                      {/* Horas Trabajadas */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedEmpleadoNovedades({ emp, items: liq.novedadesList })}
                          className="font-black text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
                          title="Ver desglose diario de horas"
                        >
                          {liq.horasTrabajadas} hs
                        </button>
                      </td>

                      {/* Ausencias */}
                      <td className="py-3 px-3 text-center">
                        {liq.diasAusente > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                            {liq.diasAusente} d ({liq.horasAusente} hs)
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px]">0</span>
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

                      {/* Sueldo Bruto */}
                      <td className="py-3 px-3 text-right font-bold text-slate-800">
                        ${liq.sueldoBruto.toLocaleString('es-AR')}
                      </td>

                      {/* Bono Presentismo */}
                      <td className="py-3 px-3 text-right">
                        {liq.bonoPresentismo > 0 ? (
                          <span className="font-bold text-emerald-600">
                            +${liq.bonoPresentismo.toLocaleString('es-AR')}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">$0</span>
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
                            onChange={(e) => handleAdelantoChange(emp.id, Number(e.target.value) || 0)}
                            className="w-20 h-8 text-right font-semibold text-xs rounded-lg border-slate-200 px-2 text-rose-600 bg-white"
                          />
                        </div>
                      </td>

                      {/* Total Neto */}
                      <td className="py-3 px-4 text-right bg-emerald-50/40">
                        <span className="text-sm font-black text-emerald-800">
                          ${liq.totalNeto.toLocaleString('es-AR')}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Recibo Individual */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLiquidacionForReceipt(liq);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                            title="Ver e imprimir recibo"
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
                  <td className="py-4 px-4 text-right text-emerald-400 text-base">
                    ${totalMontoPagar.toLocaleString('es-AR')}
                  </td>
                  <td className="py-4 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* MODAL 1: ASIGNACIÓN MASIVA DE TARIFAS */}
      <Dialog open={isMasivoModalOpen} onOpenChange={setIsMasivoModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-peie-blue" />
              Configurar Tarifas Masivas
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
                  <h3 className="text-lg font-black text-slate-900">Recibo de Liquidación</h3>
                  <p className="text-xs text-slate-500 font-semibold">PEIE - Soluciones Eléctricas e Industriales</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-peie-blue font-black text-xs">
                    {selectedQuincena === 'TODO_EL_MES' ? 'Mes Completo' : selectedQuincena}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{selectedMes} 2026</p>
                </div>
              </div>

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
                  Conceptos Liquidados
                </div>
                <div className="divide-y divide-slate-100 p-4 space-y-2">
                  
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Horas Trabajadas ({selectedLiquidacionForReceipt.horasTrabajadas} hs x ${selectedLiquidacionForReceipt.valorHora.toLocaleString('es-AR')})</span>
                    <span className="font-bold">${selectedLiquidacionForReceipt.sueldoBruto.toLocaleString('es-AR')}</span>
                  </div>

                  {selectedLiquidacionForReceipt.bonoPresentismo > 0 && (
                    <div className="flex justify-between items-center text-emerald-700 pt-2">
                      <span>Bono Presentismo y Puntualidad (+{porcentajeBonoPresentismo}%)</span>
                      <span className="font-bold">+${selectedLiquidacionForReceipt.bonoPresentismo.toLocaleString('es-AR')}</span>
                    </div>
                  )}

                  {selectedLiquidacionForReceipt.adelanto > 0 && (
                    <div className="flex justify-between items-center text-rose-700 pt-2">
                      <span>Adelantos / Descuentos varios</span>
                      <span className="font-bold">-${selectedLiquidacionForReceipt.adelanto.toLocaleString('es-AR')}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-slate-900 pt-3 text-sm font-black border-t border-slate-200">
                    <span>TOTAL NETO A COBRAR:</span>
                    <span className="text-emerald-700 text-base">${selectedLiquidacionForReceipt.totalNeto.toLocaleString('es-AR')}</span>
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
                  Registros computados en {selectedMes} ({selectedQuincena})
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
