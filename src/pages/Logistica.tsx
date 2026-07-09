import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Truck, Clock, Package, CheckCircle, ArrowRight, Wrench, Search } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import FilterBar from '../components/FilterBar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { jsPDF } from 'jspdf';
import { buildWhatsAppLink } from '../lib/whatsapp';

interface LogisticaItem {
  id: string;
  type: 'herramienta' | 'personal';
  status: string;
  priority: string;
  created_at: string;
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
  const [isGastoOpen, setIsGastoOpen] = useState(false);
  const [gastoObraId, setGastoObraId] = useState('');
  const [gastoConcepto, setGastoConcepto] = useState('');
  const [gastoMonto, setGastoMonto] = useState('');
  const [gastoDetalle, setGastoDetalle] = useState('');
  const [gastoPago, setGastoPago] = useState('Efectivo');

  useEffect(() => {
    fetchSolicitudes();
    fetchFilterOptions();
    fetchActiveObras();
  }, []);

  const fetchActiveObras = async () => {
    const { data } = await supabase.from('obras').select('id, name').eq('active', true).order('name');
    if (data) setActiveObras(data);
  };

  const handleRegistrarGasto = () => {
    if (!gastoConcepto || !gastoMonto) {
      toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Por favor, ingresá el concepto y el monto.' });
      return;
    }

    const obraSeleccionada = activeObras.find(o => o.id === gastoObraId)?.name || 'Sin obra específica';
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
    doc.rect(14, 50, 182, 120, 'F');
    
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
    doc.text("Este es un comprobante de gasto automático generado desde la aplicación PEIE Tools.", 14, 190);

    // Descargar PDF
    const fileName = `Comprobante_Gasto_${gastoConcepto.replace(/\s+/g, '_')}_${fecha.toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);

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
    setGastoPago('Efectivo');
    setGastoObraId('');

    toast({ title: 'Gasto Registrado', description: 'Se descargó el PDF del comprobante. Abriendo chat de Federico Grande...' });

    // Enviar WhatsApp al solicitante
    setTimeout(() => {
      window.open(buildWhatsAppLink(federicoPhone, waMsg), '_blank');
    }, 500);
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
      const { data: toolsData, error: toolsError } = await supabase
        .from('solicitudes')
        .select(`
          id, status, priority, created_at,
          herramientas!solicitudes_herramienta_id_fkey(name, code, obras!herramientas_current_obra_id_fkey(name)),
          target_obra:obras!solicitudes_target_obra_id_fkey(name),
          profiles!solicitudes_requester_id_fkey(full_name)
        `)
        .in('status', ['Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada']);

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
        ...(toolsData || []).map((s: any) => ({
          id: s.id,
          type: 'herramienta' as const,
          status: s.status,
          priority: s.priority,
          created_at: s.created_at,
          item_name: s.herramientas?.name,
          item_code: s.herramientas?.code,
          source_name: s.herramientas?.obras?.name || '?',
          target_name: s.target_obra?.name,
          requester_name: s.profiles?.full_name
        })),
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Panel de Logística</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión unificada de pedidos y traslados</p>
        </div>
        <Dialog open={isGastoOpen} onOpenChange={setIsGastoOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs h-10 px-3 shrink-0 flex items-center gap-1.5 shadow-md">
              💵 Registrar Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl w-[90%] max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Gasto de Logística</DialogTitle>
              <DialogDescription>
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
                  onChange={e => setGastoObraId(e.target.value)}
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
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                  <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                </select>
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
                    onClick={() => navigate(s.type === 'herramienta' ? '/solicitudes/' + s.id : '/personal/traslados/' + s.id)}
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
                    onClick={() => navigate(s.type === 'herramienta' ? '/solicitudes/' + s.id : '/personal/traslados/' + s.id)}
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
