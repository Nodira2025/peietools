import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Truck, Clock, Package, CheckCircle, ArrowRight, Wrench, Search, FileSpreadsheet, AlertTriangle, Sparkles, ShoppingBag } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import FilterBar from '../components/FilterBar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { jsPDF } from 'jspdf';
import { buildWhatsAppLink } from '../lib/whatsapp';
import { normalizeWhatsAppPurchaseText } from '../lib/aiPurchaseFormatter';

interface LogisticaItem {
  id: string;
  type: 'herramienta' | 'personal';
  status: string;
  priority: string;
  created_at: string;
  needed_date?: string | null;
  item_name: string;
  item_code: string;
  source_name: string;
  target_name: string;
  requester_name: string;
}

export default function Logistica() {
  const [items, setItems] = useState<LogisticaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [filterRequester, setFilterRequester] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  // Opciones para filtros
  const [managers, setManagers] = useState<{value: string, label: string}[]>([]);
  const [requesters, setRequesters] = useState<{value: string, label: string}[]>([]);

  // Form State para registrar gasto
  const [activeObras, setActiveObras] = useState<{id: string, name: string}[]>([]);
  const [allEmpleados, setAllEmpleados] = useState<{id: string, full_name: string, obra_id: string | null}[]>([]);
  const [isGastoOpen, setIsGastoOpen] = useState(false);
  const [gastoObraId, setGastoObraId] = useState('');
  const [gastoEmpleadoId, setGastoEmpleadoId] = useState('');
  const [gastoConcepto, setGastoConcepto] = useState('');
  const [gastoMonto, setGastoMonto] = useState('');
  const [gastoDetalle, setGastoDetalle] = useState('');
  const [gastoPago, setGastoPago] = useState('Cuenta corriente BP');
  const [sendWpGasto, setSendWpGasto] = useState(false);


  // Form State para registrar orden de compra (WhatsApp + IA)
  const [isCompraOpen, setIsCompraOpen] = useState(false);
  const [compraRawText, setCompraRawText] = useState('');
  const [compraTitle, setCompraTitle] = useState('');
  const [compraDescription, setCompraDescription] = useState('');
  const [compraPriority, setCompraPriority] = useState('Normal');
  const [compraObraId, setCompraObraId] = useState('');
  const [compraEmpleadoName, setCompraEmpleadoName] = useState('');
  const [compraSaving, setCompraSaving] = useState(false);
  const [isAIFormatted, setIsAIFormatted] = useState(false);

  const handleApplyAI = () => {
    if (!compraRawText.trim()) {
      toast({ variant: 'destructive', title: 'Texto vacío', description: 'Pegá primero el texto del mensaje de WhatsApp.' });
      return;
    }
    const res = normalizeWhatsAppPurchaseText(compraRawText);
    setCompraTitle(res.formattedTitle);
    setCompraDescription(res.formattedDescription);
    setCompraPriority(res.detectedPriority);
    setIsAIFormatted(true);
    toast({ title: '✨ Texto estructurado con IA', description: 'Se identificaron ítems, cantidades y formato limpio.' });
  };

  const handleSaveCompra = async () => {
    if (!profile) return;
    const title = compraTitle.trim() || compraRawText.trim();
    if (!title) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Por favor ingresá o pegá el texto de la compra.' });
      return;
    }

    setCompraSaving(true);
    try {
      const payload: any = {
        tool_name: title,
        description: compraDescription.trim() || null,
        quantity: 1,
        priority: compraPriority,
        justification: 'Registrado desde cel de Logística',
        obra_id: compraObraId || null,
        requester_id: profile.id,
        status: 'Pendiente',
        raw_whatsapp_text: compraRawText.trim() || null,
        requested_employee: compraEmpleadoName.trim() || null
      };

      let { error } = await supabase.from('solicitudes_compras').insert([payload]);
      if (error && (error.message?.includes('raw_whatsapp_text') || error.message?.includes('requested_employee'))) {
        delete payload.raw_whatsapp_text;
        delete payload.requested_employee;
        const fallback = await supabase.from('solicitudes_compras').insert([payload]);
        error = fallback.error;
      }

      if (error) throw error;

      toast({ title: '¡Compra Registrada!', description: 'Guardada en el Registro de Compras (PC).' });
      setIsCompraOpen(false);
      setCompraRawText('');
      setCompraTitle('');
      setCompraDescription('');
      setCompraPriority('Normal');
      setCompraObraId('');
      setCompraEmpleadoName('');
      setIsAIFormatted(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: err.message });
    } finally {
      setCompraSaving(false);
    }
  };


  // Form State para Registro de Gastos (Historial)
  const [isHistorialGastosOpen, setIsHistorialGastosOpen] = useState(false);
  const [gastosList, setGastosList] = useState<any[]>([]);
  const [loadingGastos, setLoadingGastos] = useState(false);
  const [searchGastoText, setSearchGastoText] = useState('');

  const fetchGastosHistorial = async () => {
    setLoadingGastos(true);
    let { data, error } = await supabase
      .from('gastos_logistica')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Fallback al consultar gastos_logistica:', error.message);
      const res = await supabase
        .from('gastos_logistica')
        .select('*')
        .order('created_at', { ascending: false });
      data = res.data;
    }

    setGastosList(data || []);
    setLoadingGastos(false);
  };


  useEffect(() => {
    fetchSolicitudes();
    fetchFilterOptions();
    fetchActiveObras();
    fetchEmpleados();

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('nuevoGasto') === 'true') {
      setIsGastoOpen(true);
    }
    if (searchParams.get('nuevaCompra') === 'true') {
      setIsCompraOpen(true);
    }
    if (searchParams.get('verGastos') === 'true') {
      setIsHistorialGastosOpen(true);
      fetchGastosHistorial();
    }
  }, []);


  const fetchActiveObras = async () => {
    const { data } = await supabase.from('obras').select('id, name').eq('active', true).order('name');
    if (data) setActiveObras(data);
  };

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('id, full_name, obra_id').eq('active', true).order('full_name');
    if (data) setAllEmpleados(data);
  };

  const handleRegistrarGasto = async () => {

    if (!gastoConcepto || !gastoMonto) {
      toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Por favor, ingresá el concepto y el monto.' });
      return;
    }

    const obraSeleccionada = activeObras.find(o => o.id === gastoObraId)?.name || 'Sin obra específica';
    const empleadoSeleccionado = allEmpleados.find(e => e.id === gastoEmpleadoId)?.full_name || 'Sin especificar';
    const montoNum = parseFloat(gastoMonto);
    const fecha = new Date();
    const fechaStr = fecha.toLocaleDateString('es-AR');
    const horaStr = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    // 1. Generar PDF
    const doc = new jsPDF();
    
    // Configuración visual del PDF (Comprobante Premium)
    doc.setFillColor(3, 21, 48); // peie-blue background block at top
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("COMPROBANTE DE GASTO", 14, 26);
    
    doc.setFontSize(10);
    doc.setTextColor(230, 230, 230);
    doc.text("PEIE Tools - Logística & Control", 140, 26);

    // Contenedor principal de detalles
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(14, 50, 182, 130, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59); // slate-800
    
    // Dibujar textos
    let yPos = 65;
    const addLine = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(value, 80, yPos);
      yPos += 12;
    };

    addLine("Concepto:", gastoConcepto);
    addLine("Monto:", `$${montoNum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    addLine("Obra destino:", obraSeleccionada);
    addLine("Solicitado por:", empleadoSeleccionado);
    addLine("Método de pago:", gastoPago);
    addLine("Registrado por:", profile?.full_name || 'Personal Logística');
    addLine("Fecha y hora:", `${fechaStr} a las ${horaStr} hs`);
    
    if (gastoDetalle) {
      doc.setFont("helvetica", "bold");
      doc.text("Detalle / Observaciones:", 20, yPos);
      doc.setFont("helvetica", "normal");
      
      const splitText = doc.splitTextToSize(gastoDetalle, 110);
      doc.text(splitText, 80, yPos);
    }

    // Pie de página
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Este es un comprobante de gasto automático generado desde la aplicación PEIE Tools.", 14, 195);

    // Descargar PDF
    const fileName = `Comprobante_Gasto_${gastoConcepto.replace(/\s+/g, '_')}_${fecha.toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);

    // Guardar en la tabla de base de datos gastos_logistica
    const { error: insErr } = await supabase.from('gastos_logistica').insert([{
      concepto: gastoConcepto,
      monto: montoNum,
      obra_id: gastoObraId || null,
      obra_name: obraSeleccionada,
      empleado_name: empleadoSeleccionado,
      metodo_pago: gastoPago,
      detalle: gastoDetalle.trim() || null,
      registered_by: profile?.id || null
    }]);

    if (insErr) {
      console.error('Error insertando en gastos_logistica:', insErr);
      toast({
        variant: 'destructive',
        title: 'Aviso de Base de Datos',
        description: `Error al guardar en BD: ${insErr.message}`
      });
    } else {
      toast({
        title: 'Gasto Registrado',
        description: 'El gasto fue guardado con éxito en el historial.'
      });
    }



    // 2. Construir mensaje de WhatsApp para Federico Grande (+54 9 3814 01-5738)
    const federicoPhone = '5493814015738';
    const waMsg = [
      '*NUEVO REGISTRO DE GASTO (LOGÍSTICA)*',
      '',
      `Hola *Federico*, acabo de registrar un gasto desde la app:`,
      '',
      `- *Concepto:* ${gastoConcepto}`,
      `- *Monto:* $${montoNum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      `- *Obra:* ${obraSeleccionada}`,
      `- *Solicitó (Empleado):* ${empleadoSeleccionado}`,
      `- *Método de pago:* ${gastoPago}`,
      `- *Registró:* ${profile?.full_name || 'Logística'}`,
      `- *Fecha:* ${fechaStr} ${horaStr} hs`,
      gastoDetalle.trim() ? `- *Detalles:* ${gastoDetalle}` : '',
      '',
      'Se ha descargado el archivo PDF del comprobante en mi dispositivo para enviártelo.',
    ].filter(Boolean).join('\n');

    // Cerrar dialog y resetear
    setIsGastoOpen(false);
    setGastoConcepto('');
    setGastoMonto('');
    setGastoDetalle('');
    setGastoPago('Cuenta corriente BP');
    setGastoObraId('');
    setGastoEmpleadoId('');

    if (sendWpGasto) {
      toast({ title: 'Gasto Registrado', description: 'Se descargó el PDF del comprobante. Abriendo chat de Federico Grande...' });
      setTimeout(() => {
        window.open(buildWhatsAppLink(federicoPhone, waMsg), '_blank');
      }, 500);
    } else {
      toast({ title: 'Gasto Registrado', description: 'Se descargó el PDF del comprobante en tu dispositivo.' });
    }

  };

  const fetchFilterOptions = async () => {
    const { data: profiles } = await supabase.from('profiles').select('full_name, role').eq('active', true);
    if (profiles) {
      const logs = profiles.filter(p => p.role === 'logistica' || p.role === 'admin')
        .map(p => ({ value: p.full_name, label: p.full_name }));
      const reqs = profiles.map(p => ({ value: p.full_name, label: p.full_name }));
      setManagers(logs);
      setRequesters(reqs);
    }
  };

  const fetchSolicitudes = async () => {
    setLoading(true);
    try {
      // 1. Fetch Herramientas
      let { data: toolsData, error: toolsError } = await supabase
        .from('solicitudes')
        .select(`
          id, status, priority, created_at, needed_date, comments,
          herramientas!solicitudes_herramienta_id_fkey(name, code, obras!herramientas_current_obra_id_fkey(name)),
          target_obra:obras!solicitudes_target_obra_id_fkey(name),
          profiles!solicitudes_requester_id_fkey(full_name)
        `)
        .in('status', ['Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada']);

      if (toolsError && toolsError.message?.includes('needed_date')) {
        const fallback = await supabase
          .from('solicitudes')
          .select(`
            id, status, priority, created_at, comments,
            herramientas!solicitudes_herramienta_id_fkey(name, code, obras!herramientas_current_obra_id_fkey(name)),
            target_obra:obras!solicitudes_target_obra_id_fkey(name),
            profiles!solicitudes_requester_id_fkey(full_name)
          `)
          .in('status', ['Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada']);
        toolsData = fallback.data;
        toolsError = fallback.error;
      }

      if (toolsError) throw toolsError;


      // 2. Fetch Personal
      const { data: personalData, error: personalError } = await supabase
        .from('traslados_personal')
        .select(`
          id, status, created_at,
          empleados!traslados_personal_empleado_id_fkey(full_name),
          source_obra:obras!traslados_personal_source_obra_id_fkey(name),
          target_obra:obras!traslados_personal_target_obra_id_fkey(name),
          requester:profiles!traslados_personal_requester_id_fkey(full_name)
        `)
        .eq('status', 'Pendiente'); // De personal solo mostramos los pendientes en este panel rapido

      if (personalError) throw personalError;

      // 3. Unified
      const unified: LogisticaItem[] = [
        ...(toolsData || []).map((s: any) => {
          const isFree = !s.herramientas;
          const cleanComment = s.comments ? s.comments.replace(/^Pedido libre:\s*/i, '').trim() : '';
          return {
            id: s.id,
            type: 'herramienta' as const,
            status: s.status,
            priority: s.priority,
            created_at: s.created_at,
            needed_date: s.needed_date,
            item_name: s.herramientas?.name || cleanComment || 'Herramienta solicitada',
            item_code: s.herramientas?.code || 'LIBRE',
            source_name: s.herramientas?.obras?.name || 'A determinar por Logística',
            target_name: s.target_obra?.name,
            requester_name: s.profiles?.full_name
          };
        }),
        ...(personalData || []).map((s: any) => ({
          id: s.id,
          type: 'personal' as const,
          status: s.status,
          priority: 'Normal',
          created_at: s.created_at,
          item_name: s.empleados?.full_name,
          item_code: 'PERS',
          source_name: s.source_obra?.name || 'Sin obra',
          target_name: s.target_obra?.name,
          requester_name: s.requester?.full_name
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(unified);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
    setLoading(false);
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Pendiente': return { bg: 'bg-orange-50 border-orange-200', icon: <Clock className="h-6 w-6 text-orange-500" />, color: 'text-orange-600', label: 'PENDIENTE' };
      case 'Asignada': return { bg: 'bg-blue-50 border-blue-200', icon: <CheckCircle className="h-6 w-6 text-blue-500" />, color: 'text-blue-600', label: 'RECIBIDO/LEÍDO' };
      case 'En retiro':
      case 'En traslado': return { bg: 'bg-sky-50 border-sky-200', icon: <Truck className="h-6 w-6 text-sky-500" />, color: 'text-sky-600', label: 'EN CURSO' };
      case 'Entregada':
      case 'Confirmada': return { bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="h-6 w-6 text-green-500" />, color: 'text-green-600', label: 'ENTREGADO' };
      default: return { bg: 'bg-slate-50 border-slate-200', icon: <Clock className="h-6 w-6 text-slate-400" />, color: 'text-slate-500', label: status.toUpperCase() };
    }
  };

  const getPriorityDot = (p: string) => {
    switch(p) {
      case 'Urgente': return 'bg-red-500';
      case 'Alta': return 'bg-orange-500';
      case 'Normal': return 'bg-blue-400';
      default: return 'bg-green-400';
    }
  };

  const filteredItems = items.filter(s => {
    const matchSearch = !searchTerm || 
      s.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.requester_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchType = !filterType || s.type === filterType;
    const matchRequester = !filterRequester || s.requester_name === filterRequester;
    const matchDate = !filterDate || s.created_at.startsWith(filterDate);
    // Nota: filterManager no se aplica directamente aca porque no tenemos el manager en LogisticaItem aun,
    // lo agregare a la interfaz.
    return matchSearch && matchType && matchRequester && matchDate;
  });

  const pendientes = filteredItems.filter(s => s.status === 'Pendiente');
  const enCurso = filteredItems.filter(s => s.status !== 'Pendiente');

  return (
    <div className="space-y-6 pb-safe">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Panel de Logística</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión unificada de pedidos y traslados</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            onClick={() => navigate('/reportes')}
            variant="outline"
            className="bg-white border-rose-200 text-rose-700 hover:bg-rose-50 font-bold rounded-xl text-xs h-10 px-3 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 shadow-sm"
          >
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>Historial de Reportes</span>
          </Button>

          {/* Botón para Reportar Orden de Compra (Pegar WhatsApp + IA) */}
          <Dialog open={isCompraOpen} onOpenChange={setIsCompraOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs h-10 px-3 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 shadow-md">
                🛍️ Reportar Compra
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl w-[92%] max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold text-peie-blue flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-600" /> Reportar Orden de Compra
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Pegá el texto crudo del mensaje de WhatsApp del empleado y la IA lo estructurará automáticamente para el Registro de Compras (PC).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* 1. Área de Pegado del Texto Crudo */}
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>1. Pegar Texto de WhatsApp *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Copia directa del chat</span>
                  </label>
                  <Textarea
                    rows={4}
                    placeholder="Ej: Hola Santi, necesito 2 discos de amoladora de 7 pulgadas y 3 pares de guantes de baqueta urgente para la obra..."
                    value={compraRawText}
                    onChange={(e) => setCompraRawText(e.target.value)}
                    className="rounded-xl bg-white border-slate-200 text-sm font-semibold p-3"
                  />
                  <Button
                    type="button"
                    onClick={handleApplyAI}
                    disabled={!compraRawText.trim()}
                    className="w-full h-11 bg-gradient-to-r from-peie-blue to-peie-light hover:opacity-90 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 mt-2 shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    ✨ Estructurar y Limpiar con IA
                  </Button>
                </div>

                {/* 2. Resultado Procesado por IA */}
                <div className="space-y-3 bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" /> Resultado Procesado por IA
                  </span>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Título / Ítems Principales:</label>
                    <Input
                      value={compraTitle}
                      onChange={(e) => setCompraTitle(e.target.value)}
                      placeholder="Ej: Discos de amoladora 7 pulgadas (2u) y Guantes de baqueta (3u)"
                      className="rounded-xl bg-white h-10 border-slate-200 text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Detalle Estructurado con Cantidades:</label>
                    <Textarea
                      rows={3}
                      value={compraDescription}
                      onChange={(e) => setCompraDescription(e.target.value)}
                      placeholder="• [2u] Discos de amoladora 7 pulgadas&#10;• [3u] Guantes de baqueta"
                      className="rounded-xl bg-white border-slate-200 text-xs font-medium p-2.5"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Prioridad Detectada:</label>
                    <select
                      value={compraPriority}
                      onChange={(e) => setCompraPriority(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
                    >
                      <option value="Baja">Baja</option>
                      <option value="Normal">Normal</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>
                </div>

                {/* 3. Campos Opcionales (Empleado y Obra) */}
                <div className="space-y-3 pt-1 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Campos Opcionales</span>

                  {/* Empleado que solicita */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Empleado que solicita (Seleccionar de la lista):</label>
                    <select
                      value={compraEmpleadoName}
                      onChange={(e) => setCompraEmpleadoName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
                    >
                      <option value="">-- Sin Empleado Específico --</option>
                      {allEmpleados.map((emp) => (
                        <option key={emp.id} value={emp.full_name}>
                          👷 {emp.full_name}
                        </option>
                      ))}
                    </select>
                  </div>


                  {/* Obra asociada */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Obra asociada (Opcional):</label>
                    <select
                      value={compraObraId}
                      onChange={(e) => setCompraObraId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                    >
                      <option value="">-- Sin Obra Específica / Base --</option>
                      {activeObras.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleSaveCompra}
                  disabled={compraSaving || (!compraTitle && !compraRawText)}
                  className="w-full h-12 bg-peie-blue hover:bg-peie-blue/90 text-white font-extrabold rounded-2xl text-sm mt-4 shadow-lg"
                >
                  {compraSaving ? 'Guardando...' : '💾 Guardar en Registro de Compras (PC)'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isGastoOpen} onOpenChange={setIsGastoOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs h-10 px-3 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 shadow-md">
                💵 Registrar Gasto
              </Button>
            </DialogTrigger>
          <DialogContent className="rounded-3xl w-[92%] max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="text-xl">💵</span> Registrar Gasto de Logística
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Crea un comprobante de compra para enviárselo a Federico Grande por WhatsApp.
              </DialogDescription>
            </DialogHeader>



            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Concepto / ¿Qué se compró? *</label>
                <Input 
                  placeholder="Ej: Nafta, Clavos, Cinta aisladora" 
                  value={gastoConcepto}
                  onChange={e => setGastoConcepto(e.target.value)}
                  className="rounded-xl h-10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Monto total *</label>
                <Input 
                  type="number"
                  placeholder="Ej: 8500" 
                  value={gastoMonto}
                  onChange={e => setGastoMonto(e.target.value)}
                  className="rounded-xl h-10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Obra asociada (Opcional)</label>
                <select 
                  value={gastoObraId}
                  onChange={e => {
                    setGastoObraId(e.target.value);
                    setGastoEmpleadoId(''); // Reset empleado si cambia la obra
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="">Ninguna o General</option>
                  {activeObras.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Método de pago</label>
                <select 
                  value={gastoPago}
                  onChange={e => setGastoPago(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="Cuenta corriente BP">Cuenta corriente BP</option>
                  <option value="Cuenta corriente LA MADRID">Cuenta corriente LA MADRID</option>
                  <option value="Cuenta corriente DI MATER">Cuenta corriente DI MATER</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                  <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Empleado que solicitó (Opcional)</label>
                <select 
                  value={gastoEmpleadoId}
                  onChange={e => setGastoEmpleadoId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="">Seleccionar empleado...</option>
                  {(gastoObraId 
                    ? allEmpleados.filter(e => e.obra_id === gastoObraId)
                    : allEmpleados
                  ).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
                {gastoObraId && (
                  <p className="text-[10px] text-slate-400 font-semibold">
                    Filtrados por la obra seleccionada ({allEmpleados.filter(e => e.obra_id === gastoObraId).length} empleados)
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Detalles adicionales</label>
                <Textarea 
                  placeholder="Ej: Compras varias de ferretería pedidas por encargado" 
                  value={gastoDetalle}
                  onChange={e => setGastoDetalle(e.target.value)}
                  className="rounded-xl min-h-[70px]"
                />
              </div>
              <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">

                <input
                  type="checkbox"
                  id="sendWpGasto"
                  checked={sendWpGasto}
                  onChange={(e) => setSendWpGasto(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="sendWpGasto" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  📲 Enviar resumen por WhatsApp a Federico Grande (Opcional)
                </label>
              </div>
            </div>

            <DialogFooter className="flex-row gap-2">
              <DialogClose asChild>
                <Button variant="ghost" className="flex-1 rounded-xl">Cancelar</Button>
              </DialogClose>
              <Button 
                onClick={handleRegistrarGasto}
                disabled={!gastoConcepto || !gastoMonto}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
              >
                Generar y Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Botón y Modal de Registro de Gastos */}
        <Dialog open={isHistorialGastosOpen} onOpenChange={(open) => {
          setIsHistorialGastosOpen(open);
          if (open) fetchGastosHistorial();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs h-10 px-3 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 shadow-md">
              📋 Registro de Gastos
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl w-[94%] max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="text-xl">📋</span> Registro de Gastos de Logística
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Historial completo de gastos registrados por logística y comprobantes generados.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Buscar por concepto, obra, empleado o método de pago..." 
                  value={searchGastoText}
                  onChange={e => setSearchGastoText(e.target.value)}
                  className="pl-9 h-10 rounded-xl text-xs border-slate-200"
                />
              </div>

              {loadingGastos ? (
                <div className="p-8 text-center text-xs text-slate-500 font-medium">
                  Cargando gastos...
                </div>
              ) : gastosList.length === 0 ? (
                <div className="p-8 text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-700">No hay gastos registrados aún</p>
                  <p className="text-xs text-slate-400">Los gastos que registres aparecerán en este historial.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {gastosList.filter(g => {
                    const term = searchGastoText.toLowerCase().trim();
                    if (!term) return true;
                    return (
                      g.concepto.toLowerCase().includes(term) ||
                      (g.obra_name && g.obra_name.toLowerCase().includes(term)) ||
                      (g.empleado_name && g.empleado_name.toLowerCase().includes(term)) ||
                      g.metodo_pago.toLowerCase().includes(term)
                    );
                  }).map((g) => (
                    <div key={g.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">{g.concepto}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                            ${g.monto?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">
                          🏗️ <strong>Obra:</strong> {g.obra_name || 'Sin obra'} | 👷 <strong>Solicitó:</strong> {g.empleado_name || 'Sin especificar'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          💳 <strong>Pago:</strong> {g.metodo_pago} | 🕒 {new Date(g.created_at).toLocaleDateString('es-AR')} {new Date(g.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        </p>
                        {g.detalle && <p className="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-100 italic mt-1">{g.detalle}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>


      {/* Buscador y Filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar herramienta, código o solicitante..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        
        <FilterBar
          filters={[
            { key: 'type', label: 'Tipo', value: filterType, options: [{ value: 'herramienta', label: 'Herramienta' }, { value: 'personal', label: 'Personal' }] },
            { key: 'requester', label: 'Solicitante', value: filterRequester, options: requesters },
            { key: 'date', label: 'Fecha', value: filterDate, type: 'date' },
          ]}
          onFilterChange={(key, val) => {
            if (key === 'type') setFilterType(val);
            if (key === 'requester') setFilterRequester(val);
            if (key === 'date') setFilterDate(val);
          }}
        />
      </div>

      {/* Contadores rapidos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-orange-600">{pendientes.length}</p>
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mt-1">Pendientes</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-blue-600">{enCurso.length}</p>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mt-1">En Curso</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando pedidos...</div>
      ) : (
        <>
          {/* PEDIDOS PENDIENTES - Seccion destacada */}
          {pendientes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider">Requieren tu atencion</h2>
              {pendientes.map(s => {
                const style = getStatusStyle(s.status);
                return (
                  <Card 
                    key={s.id} 
                    className={`${style.bg} border-2 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform shadow-sm hover:shadow-md`}
                    onClick={() => navigate(s.type === 'herramienta' ? '/solicitudes/' + s.id : '/personal/traslados/' + s.id, { state: { from: '/logistica' } })}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {style.icon}
                          <span className={`text-[10px] font-black uppercase tracking-widest ${style.color}`}>{style.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${getPriorityDot(s.priority)}`} />
                          <span className="text-[10px] text-slate-400 font-medium">{s.priority}</span>
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-800 text-base">{s.item_name}</h3>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{s.item_code}</p>
                      {s.needed_date && (
                        <div className="mt-2 bg-amber-100/90 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1.5 w-max">
                          <Clock size={12} className="text-amber-700 shrink-0" />
                          Necesidad en obra: {new Date(s.needed_date).toLocaleString('es-AR')}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3 text-xs">
                        <span className="bg-white/70 px-2 py-1 rounded-lg text-slate-600 truncate max-w-[40%]">{s.source_name}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="bg-white/70 px-2 py-1 rounded-lg text-slate-700 font-semibold truncate max-w-[40%]">{s.target_name}</span>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200/50">
                        <span className="text-xs text-slate-400">Solicita: <strong className="text-slate-600">{s.requester_name}</strong></span>
                        <span className="text-[10px] text-slate-300 font-mono">{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* PEDIDOS EN CURSO */}
          {enCurso.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-blue-500 uppercase tracking-wider">En curso</h2>
              {enCurso.map(s => {
                const style = getStatusStyle(s.status);
                return (
                  <Card 
                    key={s.id} 
                    className={`${style.bg} border rounded-2xl cursor-pointer active:scale-[0.98] transition-transform`}
                    onClick={() => navigate(s.type === 'herramienta' ? '/solicitudes/' + s.id : '/personal/traslados/' + s.id, { state: { from: '/logistica' } })}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {style.icon}
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">{s.item_name}</h3>
                            <p className="text-[10px] text-slate-400">{s.source_name} → {s.target_name}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase ${style.color}`}>{style.label}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* SIN PEDIDOS */}
          {items.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <Truck className="mx-auto h-16 w-16 text-slate-200 mb-4" />
              <h3 className="text-lg font-bold text-slate-400">Sin pedidos pendientes</h3>
              <p className="text-sm text-slate-300 mt-1">Todo tranquilo por ahora</p>
            </div>
          )}

          {/* Boton rapido a herramientas */}
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-peie-blue text-peie-blue hover:bg-peie-blue/5 font-semibold"
            onClick={() => navigate('/herramientas')}
          >
            <Wrench className="mr-2 h-4 w-4" />
            Ver Catalogo de Herramientas
          </Button>
        </>
      )}
    </div>
  );
}
