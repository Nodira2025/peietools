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
  User,
  Plus,
  Edit,
  Trash2,
  Save,
  Check,
  X,
  ShieldCheck,
  Utensils,
  BarChart3
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { buildWhatsAppLink } from '../lib/whatsapp';
import { TrabajadoresReportesTab } from '../components/TrabajadoresReportesTab';
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

// Helper para calcular Quincena y Mes
function getQuincenaFromDate(dateStr: string): { quincena: string; mes: string } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  return {
    quincena: day <= 15 ? '1Q' : '2Q',
    mes: meses[d.getMonth()]
  };
}

export default function Trabajadores() {
  const { toast } = useToast();
  
  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'reportes' | 'ficha' | 'novedades' | 'computo'>('reportes');
  
  const [novedades, setNovedades] = useState<NovedadDiaria[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoScorecard[]>([]);
  const [obrasList, setObrasList] = useState<{ id: string; name: string }[]>([]);
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

  // Modal: Carga Manual RRHH
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    empleado_id: '',
    fecha: new Date().toISOString().split('T')[0],
    obra_id: '',
    estado: 'PRESENTE' as 'PRESENTE' | 'AUSENTE' | 'LLEGADA TARDE' | 'SE RETIRO',
    hora_ingreso: '08:00',
    hora_egreso: '18:00',
    almuerzo: false,
    horas_trabajadas: 10,
    tipo_licencia: 'Ninguno',
    certificado_medico: false,
    observaciones: ''
  });

  // Modal: Editar Novedad Existente
  const [editingNovedad, setEditingNovedad] = useState<NovedadDiaria | null>(null);
  const [savingEditNovedad, setSavingEditNovedad] = useState(false);

  // Modal: Editar Datos del Empleado
  const [isEditWorkerModalOpen, setIsEditWorkerModalOpen] = useState(false);
  const [savingWorker, setSavingWorker] = useState(false);
  const [workerForm, setWorkerForm] = useState({
    id: '',
    full_name: '',
    specialty: '',
    whatsapp: '',
    obra_id: '',
    fecha_ingreso: ''
  });

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
        .select('id, full_name, role, specialty, whatsapp, obra_id, created_at')
        .eq('active', true)
        .order('full_name');

      if (empData) {
        setEmpleados(empData);
        if (!selectedEmpleadoId && empData.length > 0) {
          setSelectedEmpleadoId(empData[0].id);
        }
      }

      // 3. Cargar obras
      const { data: obrasData } = await supabase
        .from('obras')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (obrasData) setObrasList(obrasData);

      // 4. Cargar novedades de Supabase
      const { data: novData } = await supabase
        .from('novedades_diarias')
        .select('*')
        .order('fecha', { ascending: false });

      setNovedades(novData || []);
    } catch (err: any) {
      console.error('Error cargando datos:', err);
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

  // Calcular horas netas en formulario manual
  const calcularHorasNetas = (inicio: string, egreso: string, conAlmuerzo: boolean) => {
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = egreso.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    let netHours = diff / 60;
    if (conAlmuerzo && netHours > 4) netHours = Math.max(0, netHours - 1);
    return Math.round(netHours * 10) / 10;
  };

  // Guardar Reglas
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

      await supabase.from('reglas_horas_trabajadores').upsert([payload]);

      toast({
        title: 'Reglas y Horarios Guardados',
        description: `Ventana: ${horaInicioPermitida} a ${horaFinPermitida} hs. Bono: +${porcentajeBono}%.`
      });
      setIsRulesModalOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al guardar reglas', description: err.message });
    } finally {
      setSavingRules(false);
    }
  };

  // Empleado seleccionado para la Ficha
  const selectedEmpleado = useMemo(() => {
    return empleados.find(e => e.id === selectedEmpleadoId) || empleados[0];
  }, [empleados, selectedEmpleadoId]);

  // Abrir modal de edición de datos de empleado
  const handleOpenEditWorker = () => {
    if (!selectedEmpleado) return;
    setWorkerForm({
      id: selectedEmpleado.id,
      full_name: selectedEmpleado.full_name,
      specialty: selectedEmpleado.specialty || selectedEmpleado.role || '',
      whatsapp: selectedEmpleado.whatsapp || '',
      obra_id: selectedEmpleado.obra_id || '',
      fecha_ingreso: selectedEmpleado.created_at ? selectedEmpleado.created_at.split('T')[0] : '2024-12-11'
    });
    setIsEditWorkerModalOpen(true);
  };

  // Guardar edición de datos de empleado
  const handleSaveWorkerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWorker(true);
    try {
      const { error } = await supabase
        .from('empleados')
        .update({
          full_name: workerForm.full_name.trim(),
          specialty: workerForm.specialty.trim(),
          whatsapp: workerForm.whatsapp.trim() || null,
          obra_id: workerForm.obra_id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', workerForm.id);

      if (error) throw error;

      toast({
        title: 'Perfil de Trabajador Actualizado',
        description: `Los datos de ${workerForm.full_name} se guardaron con éxito.`
      });

      setIsEditWorkerModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al actualizar', description: err.message });
    } finally {
      setSavingWorker(false);
    }
  };

  // Abrir modal de carga manual RRHH
  const handleOpenManualModal = () => {
    setManualForm({
      empleado_id: selectedEmpleadoId || (empleados[0]?.id || ''),
      fecha: new Date().toISOString().split('T')[0],
      obra_id: selectedEmpleado?.obra_id || '',
      estado: 'PRESENTE',
      hora_ingreso: '08:00',
      hora_egreso: '18:00',
      almuerzo: false,
      horas_trabajadas: 10,
      tipo_licencia: 'Ninguno',
      certificado_medico: false,
      observaciones: 'Cargado manualmente por RRHH'
    });
    setIsManualModalOpen(true);
  };

  // Guardar Carga Manual RRHH
  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.empleado_id) {
      toast({ variant: 'destructive', title: 'Seleccioná un trabajador' });
      return;
    }

    setSubmittingManual(true);
    try {
      const emp = empleados.find(e => e.id === manualForm.empleado_id);
      const obra = obrasList.find(o => o.id === manualForm.obra_id);
      const { quincena, mes } = getQuincenaFromDate(manualForm.fecha);
      
      const netHours = manualForm.estado === 'AUSENTE'
        ? 0
        : calcularHorasNetas(manualForm.hora_ingreso, manualForm.hora_egreso, manualForm.almuerzo);

      const payload = {
        empleado_id: manualForm.empleado_id,
        empleado_nombre: emp?.full_name || 'Trabajador',
        fecha: manualForm.fecha,
        mes: mes,
        quincena: quincena,
        obra_id: manualForm.obra_id || null,
        obra_nombre: obra?.name || 'Obra Asignada',
        hora_ingreso: manualForm.hora_ingreso,
        hora_egreso: manualForm.hora_egreso,
        almuerzo: manualForm.almuerzo,
        horas_ausente: manualForm.estado === 'AUSENTE' ? 8 : 0,
        horas_trabajadas: netHours,
        estado: manualForm.estado,
        tipo_licencia: manualForm.tipo_licencia,
        certificado_medico: manualForm.certificado_medico,
        observaciones: manualForm.observaciones.trim() || 'Ajuste manual de RRHH',
        fuente: 'MANUAL_COORDINADOR'
      };

      const { error } = await supabase.from('novedades_diarias').insert([payload]);
      if (error) throw error;

      toast({
        title: 'Asistencia Registrada por RRHH',
        description: `Se registró la jornada de ${emp?.full_name} (${netHours} hs).`
      });

      setIsManualModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al registrar', description: err.message });
    } finally {
      setSubmittingManual(false);
    }
  };

  // Abrir modal de edición de novedad
  const handleOpenEditNovedad = (nov: NovedadDiaria) => {
    setEditingNovedad({ ...nov });
  };

  // Guardar edición de novedad existente
  const handleSaveEditNovedad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNovedad) return;

    setSavingEditNovedad(true);
    try {
      const netHours = editingNovedad.estado === 'AUSENTE'
        ? 0
        : calcularHorasNetas(editingNovedad.hora_ingreso || '08:00', editingNovedad.hora_egreso || '18:00', !!editingNovedad.almuerzo);

      const { error } = await supabase
        .from('novedades_diarias')
        .update({
          estado: editingNovedad.estado,
          tipo_licencia: editingNovedad.tipo_licencia,
          certificado_medico: editingNovedad.certificado_medico,
          hora_ingreso: editingNovedad.hora_ingreso,
          hora_egreso: editingNovedad.hora_egreso,
          almuerzo: editingNovedad.almuerzo,
          horas_trabajadas: netHours,
          observaciones: editingNovedad.observaciones,
          fuente: 'MANUAL_COORDINADOR',
          updated_at: new Date().toISOString()
        })
        .eq('id', editingNovedad.id);

      if (error) throw error;

      toast({
        title: 'Novedad Actualizada',
        description: 'La incidencia ha sido modificada correctamente.'
      });

      setEditingNovedad(null);
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al modificar', description: err.message });
    } finally {
      setSavingEditNovedad(false);
    }
  };

  // Eliminar novedad
  const handleDeleteNovedad = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro de asistencia?')) return;
    try {
      const { error } = await supabase.from('novedades_diarias').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Registro eliminado', description: 'La novedad fue eliminada.' });
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: err.message });
    }
  };

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
    
    // Premio por Asistencia Perfecta
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

  // Novedades filtradas para la tabla
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

  // Exportar a Excel con el formato idéntico original (3 Hojas)
  const handleExportNovedades = () => {
    if (novedades.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay novedades cargadas para exportar.' });
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. HOJA 1: NOVEDADES DIARIAS GENERALES
    const sheet1Data: any[][] = [
      ["NOVEDADES DIARIAS - PEIE", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["", "MES", "QUINCENA", "FECHA", "APELLIDO Y NOMBRE", "ESTADO", "TIPO DE LICENCIA", "SE JUSTIFICA", "CERTIFICADO\nMEDICO", "DESDE", "HASTA", "MONTO", "ENFERMEDAD TRABAJADOR", "FAMILIAR ENFERMO", "FALLECIMIENTO", "OBSERVACIONES"]
    ];

    novedades.forEach((n, idx) => {
      const isSick = n.tipo_licencia === 'Enfermedad Trabajador';
      const isFam = n.tipo_licencia === 'Familiar Enfermo';
      const isDuelo = n.tipo_licencia === 'Fallecimiento';

      sheet1Data.push([
        idx + 1,
        n.mes || 'AGOSTO',
        n.quincena || '2Q',
        n.fecha,
        n.empleado_nombre,
        n.estado,
        n.tipo_licencia || '',
        '',
        n.certificado_medico ? 'Si' : 'No',
        n.desde || '',
        n.hasta || '',
        '',
        isSick ? 1 : '',
        isFam ? 1 : '',
        isDuelo ? 1 : '',
        n.observaciones || ''
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, 'NOVEDADES DIARIAS GENERALES ');

    // 2. HOJA 2: RECUENTO DE LICENCIAS
    const totalEnf = novedades.filter(n => n.tipo_licencia === 'Enfermedad Trabajador').length;
    const totalNoJust = novedades.filter(n => n.tipo_licencia === 'No justificado' || (n.estado === 'AUSENTE' && n.tipo_licencia === 'Ninguno')).length;
    const totalTardes = novedades.filter(n => n.estado === 'LLEGADA TARDE' || n.tipo_licencia === 'Llegada tarde').length;
    const totalFam = novedades.filter(n => n.tipo_licencia === 'Familiar Enfermo').length;
    const totalDuelo = novedades.filter(n => n.tipo_licencia === 'Fallecimiento').length;

    const sheet2Data: any[][] = [
      ["", "", "", "", "", "", "Sin Cargas de Familia", "Con Cargas de Familia", "", "", "", "", "", ""],
      ["", "Total Nómina Evaluada", empleados.length, "", "", "< 5 años de antigüedad", "3 meses pagos", "6 meses pagos", "", "", "", "", "", ""],
      ["", "Días por Enfermedad del trabajador", totalEnf, "", "", "> 5 años de antigüedad", "6 meses pagos", "12 meses pagos", "", "", "", "", "", ""],
      ["", "Días de ausencia: No justificados", totalNoJust, "", "", "* Vencido el plazo de pago, corre 1 año de conservación del puesto", "", "", "", "", "", "", "", ""],
      ["", "Llegadas tardes", totalTardes, "", "", "", "", "", "", "", "", "", "", ""],
      ["", "Días por Familiar enfermo", totalFam, "", "", "", "", "", "", "", "", "", "", ""],
      ["", "Días por Duelo", totalDuelo, "", "", "", "", "", "", "", "", "", "", ""]
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    XLSX.utils.book_append_sheet(wb, ws2, 'RECUENTO DE LICENCIAS');

    // 3. HOJA 3: FICHA PERSONAL (del empleado seleccionado o primero)
    const empNombre = selectedEmpleado?.full_name || 'Personal General';
    const sheet3Data: any[][] = [
      ["", "", "", "", "", ""],
      ["FICHA DEL TRABAJADOR - 2026", "", "", "", "", ""],
      ["APELLIDO Y NOMBRE ", empNombre, "", "Inasistencias acumuladas", "", "Presentismo Real \n(a la fecha)"],
      ["Fecha de ingreso", selectedEmpleado?.created_at ? selectedEmpleado.created_at.split('T')[0] : '2024-12-11', "", scorecardMetrics.totalInasistencias, "", scorecardMetrics.presentismoReal / 100],
      ["Antigüedad", 1, "", "Llegadas tardes", "", ""],
      ["", "", "", scorecardMetrics.llegadasTarde, "", "Tasa de cumplimiento\nideal (a la fecha)"],
      ["Días acumulados por enfermedad del trabajador", scorecardMetrics.enfermedad, "", "", "", scorecardMetrics.cumplimientoIdeal / 100],
      ["Faltas no justificadas", scorecardMetrics.noJustificadas, "", "Asistencia perfecta", "", ""],
      ["Llegadas tardes", scorecardMetrics.llegadasTarde, "", scorecardMetrics.premioGanado ? "PREMIO GANADO" : "PREMIO PERDIDO", "", ""],
      ["Días por familiar enfermo", scorecardMetrics.familiarEnfermo, "", "*Sin faltas y sin llegadas tardes", "", ""],
      ["Días por duelo", scorecardMetrics.duelo, "", "", "", ""]
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(wb, ws3, 'FICHA PERSONAL');

    // Descargar archivo Excel idéntico
    XLSX.writeFile(wb, `NOVEDADES DIARIAS - PEIE (Exportado ${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}).xlsx`);

    toast({
      title: 'Excel Generado en Formato Idéntico',
      description: 'Se descargó el libro con las 3 hojas originales (Novedades, Recuento y Ficha).'
    });
  };

  // Importar archivo Excel desde la UI
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets['NOVEDADES DIARIAS GENERALES '] || wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      const recordsToInsert: any[] = [];

      for (let i = 2; i < rawRows.length; i++) {
        const row = rawRows[i];
        const mes = (row[1] || '').toString().trim();
        const quincena = (row[2] || '').toString().trim() || '2Q';
        const fechaRaw = row[3];
        const nombre = (row[4] || '').toString().trim();
        const estadoRaw = (row[5] || '').toString().trim();
        const tipoLicenciaRaw = (row[6] || '').toString().trim();
        const seJustifica = (row[7] || '').toString().trim();
        const certMedicoRaw = (row[8] || '').toString().trim();
        const desdeRaw = row[9];
        const hastaRaw = row[10];
        const obs = (row[15] || '').toString().trim();

        if (!nombre && !fechaRaw && !mes) continue;
        if (!nombre) continue;

        let estado = 'PRESENTE';
        const estUpper = estadoRaw.toUpperCase();
        if (estUpper.includes('AUSENTE')) estado = 'AUSENTE';
        else if (estUpper.includes('TARDE')) estado = 'LLEGADA TARDE';
        else if (estUpper.includes('RETIRO') || estUpper.includes('RETIRA')) estado = 'SE RETIRO';
        else if (estUpper.includes('ART')) estado = 'AUSENTE';
        else if (tipoLicenciaRaw.toLowerCase().includes('enfermedad')) estado = 'AUSENTE';

        recordsToInsert.push({
          empleado_nombre: nombre,
          fecha: typeof fechaRaw === 'string' ? fechaRaw : new Date().toISOString().split('T')[0],
          mes: mes || 'AGOSTO',
          quincena: quincena || '2Q',
          estado: estado,
          tipo_licencia: tipoLicenciaRaw || 'Ninguno',
          certificado_medico: certMedicoRaw.toLowerCase().includes('si'),
          horas_trabajadas: estado === 'PRESENTE' ? 10 : (estado === 'LLEGADA TARDE' ? 8 : 0),
          horas_ausente: estado === 'AUSENTE' ? 8 : 0,
          observaciones: obs || (seJustifica ? `Justificación: ${seJustifica}` : null),
          fuente: 'MANUAL_COORDINADOR'
        });
      }

      if (recordsToInsert.length > 0) {
        await supabase.from('novedades_diarias').insert(recordsToInsert);
        toast({
          title: 'Importación Exitosa',
          description: `Se importaron ${recordsToInsert.length} registros desde el Excel.`
        });
        fetchData();
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al importar', description: err.message });
    }
  };

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
              Gestión & Auditoría RRHH
            </span>
            <span className="text-xs text-slate-300 font-medium">
              (Ventana: {horaInicioPermitida} a {horaFinPermitida} hs • Puntualidad: {horaLimitePuntualidad} hs)
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
            Panel de Trabajadores, Asistencia & RRHH
          </h1>
          <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Ficha de presentismo, carga y justificación manual por RRHH, libro de novedades por quincena y reglas anti-fraude.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 relative z-10">
          {/* Botón Carga Manual RRHH */}
          <Button
            onClick={handleOpenManualModal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl px-4 py-2.5 shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Cargar Asistencia (RRHH)</span>
          </Button>

          <Button
            onClick={() => setIsRulesModalOpen(true)}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-2xl px-3.5 py-2.5 shadow-sm transition-all flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4" />
            <span>Reglas</span>
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
          { id: 'reportes', label: '📊 Dashboard & Reportes KPI', icon: BarChart3 },
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
      {/* PESTAÑA: DASHBOARD Y REPORTES KPI (NUEVO)                           */}
      {/* =================================================================== */}
      {activeTab === 'reportes' && (
        <TrabajadoresReportesTab
          novedades={novedades}
          empleados={empleados}
          obrasList={obrasList}
          horasObjetivo={horasObjetivo}
          porcentajeBono={porcentajeBono}
        />
      )}

      {/* =================================================================== */}
      {/* PESTAÑA 1: FICHA DEL TRABAJADOR (SCORECARD INDIVIDUAL)              */}
      {/* =================================================================== */}
      {activeTab === 'ficha' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Selector de Empleado y Botón de Edición de Perfil */}
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={handleOpenEditWorker}
                variant="outline"
                className="rounded-xl border-slate-300 text-xs font-bold flex items-center gap-1.5 text-slate-700"
              >
                <Edit className="w-3.5 h-3.5 text-blue-600" />
                <span>Editar Datos Operario</span>
              </Button>

              {selectedEmpleado?.whatsapp && (
                <Button
                  onClick={() => handleContactWorker()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 shadow-sm"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </Button>
              )}
            </div>
          </div>

          {/* Ficha Principal */}
          {selectedEmpleado ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Columna Izquierda: Métricas en Tabla */}
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
      {/* PESTAÑA 2: LIBRO DE NOVEDADES DIARIAS (CON EDICIÓN Y AUDITORÍA)    */}
      {/* =================================================================== */}
      {activeTab === 'novedades' && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* Barra de Filtros y Acciones */}
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

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
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
                onClick={handleOpenManualModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Novedad</span>
              </Button>

              <label className="cursor-pointer bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl px-3 py-2 flex items-center gap-1.5 transition-colors shadow-xs">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>Importar Excel</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <Button
                onClick={handleExportNovedades}
                variant="outline"
                className="border-slate-300 text-slate-700 font-bold text-xs rounded-xl px-3 py-2 flex items-center gap-1.5"
                title="Exportar en formato idéntico (3 Hojas: Novedades, Recuento y Ficha)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Exportar Excel (3 Hojas)</span>
              </Button>
            </div>
          </div>

          {/* Tabla de Novedades Diarias con Acciones */}
          {filteredNovedades.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">Sin novedades registradas</h3>
              <p className="text-xs text-slate-400">No hay incidencias para el mes y quincena seleccionados.</p>
              <Button onClick={handleOpenManualModal} className="bg-blue-600 text-white text-xs rounded-xl">
                + Cargar Asistencia Manual por RRHH
              </Button>
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
                      <th className="py-3 px-4">Fuente</th>
                      <th className="py-3 px-4">Observaciones</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredNovedades.map((nov) => {
                      const isSick = nov.tipo_licencia?.toLowerCase().includes('enfermedad');
                      const isManual = nov.fuente === 'MANUAL_COORDINADOR';
                      const isWpp = nov.fuente === 'WHATSAPP_N8N';

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
                          <td className="py-3 px-4">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                              isManual 
                                ? 'bg-purple-50 text-purple-800 border-purple-200' 
                                : isWpp 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}>
                              {isManual ? '👔 RRHH' : isWpp ? '🤖 WhatsApp' : '📱 Web'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate text-[11px]">
                            {nov.observaciones || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditNovedad(nov)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar jornada / justificación"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteNovedad(nov.id)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              {isSick && (
                                <button
                                  onClick={() => handleContactWorker(undefined, nov.empleado_nombre)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Enviar mensaje de salud por WhatsApp"
                                >
                                  <HeartHandshake className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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

      {/* =================================================================== */}
      {/* MODAL 1: CARGA MANUAL O JUSTIFICACIÓN POR RRHH                       */}
      {/* =================================================================== */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Cargar / Justificar Asistencia (RRHH)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registrá la jornada o licencia médica en nombre del trabajador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveManualEntry} className="space-y-4 pt-2">
            
            {/* Selección de Trabajador */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Trabajador *</Label>
              <select
                value={manualForm.empleado_id}
                onChange={(e) => setManualForm({ ...manualForm, empleado_id: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                required
              >
                <option value="">Seleccionar empleado...</option>
                {empleados.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.specialty || emp.role})</option>
                ))}
              </select>
            </div>

            {/* Fecha y Obra */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Fecha *</Label>
                <Input
                  type="date"
                  value={manualForm.fecha}
                  onChange={(e) => setManualForm({ ...manualForm, fecha: e.target.value })}
                  className="rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Obra</Label>
                <select
                  value={manualForm.obra_id}
                  onChange={(e) => setManualForm({ ...manualForm, obra_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="">Seleccionar obra...</option>
                  {obrasList.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Estado */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Estado de Asistencia *</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'PRESENTE', label: 'Presente' },
                  { id: 'LLEGADA TARDE', label: 'Tarde' },
                  { id: 'SE RETIRO', label: 'Se Retiró' },
                  { id: 'AUSENTE', label: 'Ausente' }
                ].map(est => (
                  <button
                    key={est.id}
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, estado: est.id as any })}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      manualForm.estado === est.id
                        ? 'bg-[#031530] text-white border-[#031530]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {est.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Horarios (si presente) o Licencia (si ausente) */}
            {manualForm.estado !== 'AUSENTE' ? (
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Hora Inicio</Label>
                    <Input
                      type="time"
                      value={manualForm.hora_ingreso}
                      onChange={(e) => setManualForm({ ...manualForm, hora_ingreso: e.target.value })}
                      className="bg-white rounded-xl text-xs font-black text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Hora Egreso</Label>
                    <Input
                      type="time"
                      value={manualForm.hora_egreso}
                      onChange={(e) => setManualForm({ ...manualForm, hora_egreso: e.target.value })}
                      className="bg-white rounded-xl text-xs font-black text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-slate-700">¿Descontar 1h de almuerzo?</span>
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, almuerzo: !manualForm.almuerzo })}
                    className={`px-3 py-1 rounded-lg text-xs font-black ${
                      manualForm.almuerzo ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {manualForm.almuerzo ? 'SÍ (-1h)' : 'NO'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-rose-900">Tipo de Licencia</Label>
                  <select
                    value={manualForm.tipo_licencia}
                    onChange={(e) => setManualForm({ ...manualForm, tipo_licencia: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-rose-200 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="Enfermedad Trabajador">Enfermedad del Trabajador</option>
                    <option value="Familiar Enfermo">Familiar Enfermo a cargo</option>
                    <option value="Fallecimiento">Fallecimiento / Duelo</option>
                    <option value="No justificado">Falta No Justificada</option>
                    <option value="Llegada tarde">Llegada tarde</option>
                    <option value="Otro">Otro motivo</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900">¿Tiene Certificado Médico?</span>
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, certificado_medico: !manualForm.certificado_medico })}
                    className={`px-3 py-1 rounded-lg text-xs font-black ${
                      manualForm.certificado_medico ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {manualForm.certificado_medico ? 'SÍ (Válido)' : 'NO'}
                  </button>
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Observaciones / Motivo de RRHH</Label>
              <Input
                value={manualForm.observaciones}
                onChange={(e) => setManualForm({ ...manualForm, observaciones: e.target.value })}
                placeholder="Ej: Presentó certificado médico por WhatsApp / Se le rompió la moto"
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsManualModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingManual}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold px-5"
              >
                {submittingManual ? 'Guardando...' : 'Registrar Jornada'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 2: EDITAR NOVEDAD EXISTENTE                                   */}
      {/* =================================================================== */}
      <Dialog open={!!editingNovedad} onOpenChange={(open) => !open && setEditingNovedad(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              <span>Editar Novedad • {editingNovedad?.empleado_nombre}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Fecha: {editingNovedad?.fecha} ({editingNovedad?.quincena} {editingNovedad?.mes})
            </DialogDescription>
          </DialogHeader>

          {editingNovedad && (
            <form onSubmit={handleSaveEditNovedad} className="space-y-4 pt-2">
              
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Estado</Label>
                <select
                  value={editingNovedad.estado}
                  onChange={(e) => setEditingNovedad({ ...editingNovedad, estado: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="PRESENTE">PRESENTE</option>
                  <option value="LLEGADA TARDE">LLEGADA TARDE</option>
                  <option value="SE RETIRO">SE RETIRÓ</option>
                  <option value="AUSENTE">AUSENTE</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tipo de Licencia</Label>
                <select
                  value={editingNovedad.tipo_licencia}
                  onChange={(e) => setEditingNovedad({ ...editingNovedad, tipo_licencia: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="Ninguno">Ninguno</option>
                  <option value="Enfermedad Trabajador">Enfermedad del Trabajador</option>
                  <option value="Familiar Enfermo">Familiar Enfermo</option>
                  <option value="Fallecimiento">Fallecimiento / Duelo</option>
                  <option value="No justificado">No justificado</option>
                  <option value="Llegada tarde">Llegada tarde</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">Certificado Médico Presentado</span>
                <input
                  type="checkbox"
                  checked={editingNovedad.certificado_medico}
                  onChange={(e) => setEditingNovedad({ ...editingNovedad, certificado_medico: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Observaciones</Label>
                <Input
                  value={editingNovedad.observaciones || ''}
                  onChange={(e) => setEditingNovedad({ ...editingNovedad, observaciones: e.target.value })}
                  className="rounded-xl text-xs font-medium"
                />
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingNovedad(null)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingEditNovedad}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold px-5"
                >
                  {savingEditNovedad ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 3: EDITAR PERFIL DE OPERARIO                                   */}
      {/* =================================================================== */}
      <Dialog open={isEditWorkerModalOpen} onOpenChange={setIsEditWorkerModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <span>Editar Datos de Trabajador</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Modificá el nombre, rol, WhatsApp u obra habitual del operario.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveWorkerProfile} className="space-y-4 pt-2">
            
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Nombre Completo *</Label>
              <Input
                value={workerForm.full_name}
                onChange={(e) => setWorkerForm({ ...workerForm, full_name: e.target.value })}
                className="rounded-xl text-xs font-bold"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Especialidad / Rol</Label>
              <Input
                value={workerForm.specialty}
                onChange={(e) => setWorkerForm({ ...workerForm, specialty: e.target.value })}
                placeholder="Ej: Electricista Oficial / Ayudante"
                className="rounded-xl text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Teléfono / WhatsApp</Label>
              <Input
                value={workerForm.whatsapp}
                onChange={(e) => setWorkerForm({ ...workerForm, whatsapp: e.target.value })}
                placeholder="Ej: +54 9 381 123-4567"
                className="rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Obra Habitual Asignada</Label>
              <select
                value={workerForm.obra_id}
                onChange={(e) => setWorkerForm({ ...workerForm, obra_id: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
              >
                <option value="">Sin obra fija</option>
                {obrasList.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditWorkerModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingWorker}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold px-5"
              >
                {savingWorker ? 'Guardando...' : 'Guardar Perfil'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 4: REGLAS, HORARIOS Y ANTI-FRAUDE                              */}
      {/* =================================================================== */}
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
