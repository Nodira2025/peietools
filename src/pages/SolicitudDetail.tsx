import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Clock, CheckCircle, Truck, AlertCircle, Package, Search, User, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';
import { WhatsAppPreviewModal } from '../components/WhatsAppPreviewModal';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function SolicitudDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [solicitud, setSolicitud] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [empleados, setEmpleados] = useState<{id: string; full_name: string}[]>([]);
  const [empleadoSearch, setEmpleadoSearch] = useState('');
  const [selectedEmpleado, setSelectedEmpleado] = useState<string>('');
  const [receivedByName, setReceivedByName] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [isRejectionOpen, setIsRejectionOpen] = useState(false);

  const [inputSecurityCode, setInputSecurityCode] = useState('');

  // WhatsApp Preview state
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');
  const [waPreviewMessage, setWaPreviewMessage] = useState('');
  const [waPreviewRecipientName, setWaPreviewRecipientName] = useState('');

  const userRole = profile?.role?.toLowerCase();
  const isLogistica = userRole === 'logistica' || userRole === 'admin';
  const isRequester = solicitud?.requester_id === profile?.id;

  useEffect(() => {
    if (id) fetchSolicitud();
    fetchEmpleados();
  }, [id]);

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('id, full_name').eq('active', true).order('full_name');
    if (data) setEmpleados(data);
  };

  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  const filteredEmpleados = empleados.filter(e => {
    const searchNorm = normalizeString(empleadoSearch);
    if (!searchNorm) return true;
    
    const nameNorm = normalizeString(e.full_name);
    return nameNorm.includes(searchNorm);
  });

  const fetchSolicitud = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('solicitudes')
      .select(`
        *,
        profiles!solicitudes_requester_id_fkey(full_name, whatsapp),
        herramientas!solicitudes_herramienta_id_fkey(name, code, brand, model, obras!herramientas_current_obra_id_fkey(name)),
        target_obra:obras!solicitudes_target_obra_id_fkey(name),
        assigned:profiles!solicitudes_assigned_to_fkey(full_name, whatsapp)
      `)
      .eq('id', id)
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Solicitud no encontrada.' });
      navigate('/solicitudes');
    } else {
      setSolicitud(data);
      if (data.received_by) setReceivedByName(data.received_by);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pendiente': return <span className="flex items-center text-orange-600 bg-orange-100 px-3 py-1.5 rounded-full text-xs font-bold"><Clock className="w-3 h-3 mr-1" /> Pendiente</span>;
      case 'Asignada': return <span className="flex items-center text-blue-600 bg-blue-100 px-3 py-1.5 rounded-full text-xs font-bold"><CheckCircle className="w-3 h-3 mr-1" /> Recibido/Leído</span>;
      case 'En retiro':
      case 'En traslado': return <span className="flex items-center text-peie-blue bg-peie-light/20 px-3 py-1.5 rounded-full text-xs font-bold"><Truck className="w-3 h-3 mr-1" /> En curso</span>;
      case 'Entregada':
      case 'Confirmada': return <span className="flex items-center text-green-600 bg-green-100 px-3 py-1.5 rounded-full text-xs font-bold"><CheckCircle className="w-3 h-3 mr-1" /> Entregado</span>;
      case 'Rechazada': return <span className="flex items-center text-red-700 bg-red-100 px-3 py-1.5 rounded-full text-xs font-bold"><AlertCircle className="w-3 h-3 mr-1" /> Rechazada</span>;
      case 'Cancelada': return <span className="flex items-center text-rose-700 bg-rose-100 px-3 py-1.5 rounded-full text-xs font-bold"><AlertCircle className="w-3 h-3 mr-1" /> Cancelada</span>;
      default: return <span className="bg-gray-100 px-3 py-1.5 rounded-full text-xs">{status}</span>;
    }
  };

  const updateStatus = async (newStatus: string, recipientName?: string) => {
    if (!solicitud || !profile) return;
    
    const payload: any = { status: newStatus };
    if (newStatus === 'Asignada') {
      payload.assigned_to = profile.id;
    }
    if (recipientName) {
      payload.received_by = recipientName;
    }

    const { error } = await supabase.from('solicitudes').update(payload).eq('id', solicitud.id);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }

    const finalRecipient = recipientName || selectedEmpleado || solicitud.received_by;

    // Registrar movimiento en bitacora
    const movNotes = (newStatus === 'Confirmada' || newStatus === 'Entregada') && finalRecipient
      ? 'Recibio en obra: ' + finalRecipient + ' | Gestionado por ' + profile.full_name
      : 'Gestionado por ' + profile.full_name;
    
    await supabase.from('movimientos').insert([{
      herramienta_id: solicitud.herramienta_id,
      solicitud_id: solicitud.id,
      user_id: profile.id,
      action: 'Cambio de estado a: ' + newStatus,
      notes: movNotes
    }]);

    // --- SINCRONIZAR ESTADO DE LA HERRAMIENTA ---
    if (newStatus === 'Asignada' || newStatus === 'En retiro') {
      await supabase.from('herramientas')
        .update({ status: 'Reservada' })
        .eq('id', solicitud.herramienta_id);
    } else if (newStatus === 'En traslado') {
      await supabase.from('herramientas')
        .update({ status: 'En traslado' })
        .eq('id', solicitud.herramienta_id);
    } else if (newStatus === 'Entregada' || newStatus === 'Confirmada') {
      // Al confirmar recepcion: herramienta pasa a "En uso" y se mueve a la obra destino
      await supabase.from('herramientas')
        .update({ 
          status: 'En uso',
          current_obra_id: solicitud.target_obra_id 
        })
        .eq('id', solicitud.herramienta_id);
    }

    if (newStatus === 'Asignada') {
      // Logistica acepta → avisar al encargado solicitante
      toast({ title: 'Pedido Aceptado!', description: 'Abriendo plantilla de WhatsApp...' });
      const requesterPhone = solicitud.profiles?.whatsapp;
      if (requesterPhone) {
        const msg = [
          '*PEDIDO ACEPTADO*',
          '',
          'Hola *' + solicitud.profiles.full_name.split(' ')[0] + '*!',
          'Tu solicitud de traslado fue autorizada por Logistica:',
          '',
          '- *Equipo:* ' + (solicitud.herramientas?.name || solicitud.comments || 'Herramienta solicitada'),
          '- *Codigo:* ' + (solicitud.herramientas?.code || 'LIBRE'),
          '- *Responsable:* ' + profile.full_name,
          '- *Destino:* ' + solicitud.target_obra.name,
          '',
          'El envio ya se encuentra en curso. Segui el estado aca:',
          APP_URL + '/solicitudes/' + solicitud.id
        ].join('\n');
        setWaPreviewPhone(requesterPhone);
        setWaPreviewMessage(msg);
        setWaPreviewRecipientName(solicitud.profiles.full_name);
        setWaPreviewOpen(true);
      }
    } else if (newStatus === 'Confirmada') {
      // Recepcion confirmada → avisar al de logistica
      toast({ title: 'Recepcion Confirmada!', description: 'Generando comprobante y abriendo plantilla de WhatsApp...' });
      setReceivedByName(finalRecipient);
      setShowReceipt(true);
      const logisticaPhone = solicitud.assigned?.whatsapp;
      if (logisticaPhone) {
        const msg = [
          '*RECEPCION CONFIRMADA*',
          '',
          `*${profile.full_name}* confirmo la recepcion de:`,
          '',
          '- *Equipo:* ' + (solicitud.herramientas?.name || solicitud.comments || 'Herramienta solicitada'),
          '- *Codigo:* ' + (solicitud.herramientas?.code || 'LIBRE'),
          '- *Destino:* ' + solicitud.target_obra.name,
          '- *Recibio:* ' + finalRecipient,
          '',
          'El traslado fue completado exitosamente.',
          '',
          'Ver comprobante:',
          APP_URL + '/solicitudes/' + solicitud.id
        ].join('\n');
        setWaPreviewPhone(logisticaPhone);
        setWaPreviewMessage(msg);
        setWaPreviewRecipientName(solicitud.assigned?.full_name || 'Logística');
        setWaPreviewOpen(true);
      }
    } else {
      toast({ title: 'Estado actualizado', description: 'Nuevo estado: ' + newStatus });
    }

    fetchSolicitud();
    setIsValidationOpen(false);
  };

  const handleReject = async () => {
    if (!solicitud || !profile || !rejectionReason.trim()) return;
    
    setRejecting(true);
    const { error } = await supabase
      .from('solicitudes')
      .update({ 
        status: 'Rechazada', 
        rejection_reason: rejectionReason 
      })
      .eq('id', solicitud.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setRejecting(false);
      return;
    }

    // Registrar movimiento
    await supabase.from('movimientos').insert([{
      herramienta_id: solicitud.herramienta_id,
      solicitud_id: solicitud.id,
      user_id: profile.id,
      action: 'Solicitud RECHAZADA',
      notes: 'Motivo: ' + rejectionReason
    }]);

    // Devolver herramienta a En uso (si está en obra) o Disponible
    const { data: hData } = await supabase.from('herramientas').select('current_obra_id').eq('id', solicitud.herramienta_id).single();
    await supabase.from('herramientas')
      .update({ status: hData?.current_obra_id ? 'En uso' : 'Disponible' })
      .eq('id', solicitud.herramienta_id);

    toast({ title: 'Solicitud Rechazada', description: 'Notificando al encargado...' });

    const requesterPhone = solicitud.profiles?.whatsapp;
    if (requesterPhone) {
      const msg = [
        '*SOLICITUD RECHAZADA*',
        '',
        'Hola *' + solicitud.profiles.full_name.split(' ')[0] + '*!',
        'Tu solicitud de traslado para *' + solicitud.herramientas.name + '* fue rechazada.',
        '',
        '*Motivo:* ' + rejectionReason,
        '',
        'Podés ver los detalles o volver a solicitar acá:',
        APP_URL + '/solicitudes/' + solicitud.id
      ].join('\n');
      setWaPreviewPhone(requesterPhone);
      setWaPreviewMessage(msg);
      setWaPreviewRecipientName(solicitud.profiles.full_name);
      setWaPreviewOpen(true);
    }

    setRejecting(false);
    setIsRejectionOpen(false);
    fetchSolicitud();
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este movimiento permanentemente? Esta acción no se puede deshacer.')) return;
    try {
      // 1. Revertir el estado de la herramienta si es necesario
      if (solicitud.herramienta_id) {
        const { data: hData } = await supabase.from('herramientas').select('current_obra_id').eq('id', solicitud.herramienta_id).single();
        await supabase
          .from('herramientas')
          .update({ status: hData?.current_obra_id ? 'En uso' : 'Disponible' })
          .eq('id', solicitud.herramienta_id);
      }

      // 2. Eliminar primero los movimientos relacionados para evitar violar la Foreign Key
      const { error: movError } = await supabase
        .from('movimientos')
        .delete()
        .eq('solicitud_id', id);

      if (movError) {
        console.error('Error al eliminar movimientos relacionados:', movError);
        // Continuamos de todas formas, el error de FK saltará si realmente falló el borrado de hijos
      }

      // 3. Eliminar la solicitud
      const { error } = await supabase
        .from('solicitudes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Movimiento Eliminado', description: 'El movimiento fue borrado de la base de datos.' });
      navigate('/solicitudes');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando solicitud...</div>;
  if (!solicitud) return null;

  const canAct = solicitud.status !== 'Confirmada' && solicitud.status !== 'Cancelada' && solicitud.status !== 'Rechazada';
  const isAdminOrLogistica = profile?.role === 'admin' || profile?.role === 'logistica';
  const canDelete = isAdminOrLogistica || (isRequester && solicitud?.status === 'Pendiente');

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-safe">
      <div className="flex items-center mb-4">
        <Button 
          variant="ghost" 
          onClick={() => {
            if (location.state?.from) {
              navigate(location.state.from);
            } else {
              navigate('/pedidos-herramientas');
            }
          }} 
          className="p-0 hover:bg-transparent"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>

      {/* TARJETA PRINCIPAL DEL PEDIDO */}
      <Card className="shadow-sm border-0 ring-1 ring-slate-100 rounded-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-peie-light via-peie-blue to-peie-light" />
        <CardHeader className="pb-4 pt-6">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl font-bold text-peie-blue">
                {solicitud.herramientas?.name || solicitud.comments || 'Herramienta solicitada'}
              </CardTitle>
              <CardDescription className="text-sm font-mono mt-1 bg-slate-100 w-max px-2 py-1 rounded">
                {solicitud.herramientas?.code || 'PEDIDO LIBRE'}
              </CardDescription>
            </div>
            {getStatusBadge(solicitud.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Info del traslado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Origen</p>
              <p className="font-semibold text-red-700 text-sm mt-0.5">{solicitud.herramientas?.obras?.name || 'A determinar por Logística'}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-xl border border-green-100">
              <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Destino</p>
              <p className="font-semibold text-green-700 text-sm mt-0.5">{solicitud.target_obra.name}</p>
            </div>
          </div>

          {/* Detalles */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-sm">
            <p><strong className="text-slate-500">Solicitante:</strong> <span className="text-slate-800 font-medium">{solicitud.profiles.full_name}</span></p>
            <p><strong className="text-slate-500">Prioridad:</strong> <span className="text-slate-800 font-medium">{solicitud.priority}</span></p>
            <p><strong className="text-slate-500">Fecha:</strong> <span className="text-slate-800 font-medium">{new Date(solicitud.created_at).toLocaleString()}</span></p>
            {solicitud.assigned && <p><strong className="text-slate-500">Responsable:</strong> <span className="text-slate-800 font-medium">{solicitud.assigned.full_name}</span></p>}
            {solicitud.comments && <p><strong className="text-slate-500">Notas:</strong> <span className="text-slate-800">{solicitud.comments}</span></p>}
            {solicitud.status === 'Rechazada' && solicitud.rejection_reason && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs font-bold text-red-600 uppercase mb-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Motivo del Rechazo
                </p>
                <p className="text-sm text-red-800 italic">"{solicitud.rejection_reason}"</p>
              </div>
            )}
          </div>

          {/* Mostrar código de seguridad al solicitante */}
          {isRequester && solicitud.security_code && solicitud.status !== 'Confirmada' && solicitud.status !== 'Cancelada' && solicitud.status !== 'Rechazada' && (
            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Código de Seguridad para Entrega</p>
                <p className="text-2xl font-black text-amber-800 tracking-widest mt-1 font-mono">{solicitud.security_code}</p>
              </div>
              <p className="text-[10px] text-amber-600/80 max-w-[180px] leading-tight text-right">
                Facilitá este código al personal de logística cuando entreguen la herramienta en la obra para confirmar la entrega.
              </p>
            </div>
          )}

          {/* Tarjeta de seguimiento en tiempo real */}
          {solicitud.status === 'En traslado' && (
            <div className="p-4 bg-gradient-to-r from-peie-blue to-peie-light text-white rounded-2xl flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0">
                  <Truck className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Trazabilidad en tiempo real</p>
                  <p className="text-sm font-bold mt-0.5">El traslado está en curso</p>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/solicitudes/${solicitud.id}/seguimiento`)}
                className="bg-white text-peie-blue hover:bg-white/95 font-black text-xs px-4 h-9 rounded-xl shadow-sm flex items-center gap-1 shrink-0"
              >
                🚚 Seguir Envío
              </Button>
            </div>
          )}

          {/* ========================================================= */}
          {/* BOTONES SEGUN ROL                                         */}
          {/* ========================================================= */}

          {/* --- ACCIONES DE LOGISTICA / ADMIN --- */}
          {isLogistica && canAct && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acciones de Logistica</h4>
              <div className="flex flex-col gap-2">
                {solicitud.status === 'Pendiente' && (
                  <Button 
                    onClick={() => updateStatus('Asignada')} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full h-12 rounded-xl shadow-md text-sm"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Marcar como Recibido/Leído y Avisar por WhatsApp
                  </Button>
                )}
                {solicitud.status === 'Asignada' && (
                  <Button onClick={() => updateStatus('En traslado')} className="bg-peie-blue hover:bg-peie-blue/90 text-white w-full h-12 rounded-xl text-sm font-bold">
                    <Truck className="mr-2 h-4 w-4" />
                    Marcar En curso
                  </Button>
                )}
                {(solicitud.status === 'En retiro' || solicitud.status === 'En traslado') && (
                  <Dialog open={isValidationOpen} onOpenChange={(open) => { setIsValidationOpen(open); if(!open) setInputSecurityCode(''); }}>
                    <DialogTrigger asChild>
                      <Button className="bg-green-600 hover:bg-green-700 text-white w-full h-12 rounded-xl text-sm font-bold">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Validar y Marcar como Entregado
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-3xl w-[90%] max-w-md">
                      <DialogHeader>
                        <DialogTitle>Validación de Entrega</DialogTitle>
                        <DialogDescription>
                          Seleccioná quién recibe la herramienta y solicitá el código de seguridad de 6 dígitos que figura en la app del solicitante.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        {/* Buscador de empleado que recibe */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-slate-700">¿Quién recibe la herramienta en obra? *</label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              placeholder="Buscar empleado por nombre..."
                              value={empleadoSearch}
                              onChange={(e) => { setEmpleadoSearch(e.target.value); setSelectedEmpleado(''); }}
                              className="pl-9 h-11 rounded-xl text-sm"
                            />
                          </div>
                          {empleadoSearch.length > 0 && !selectedEmpleado && (
                            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 mt-1 shadow-sm">
                              {filteredEmpleados.map(emp => (
                                <button
                                  key={emp.id}
                                  type="button"
                                  onClick={() => { setSelectedEmpleado(emp.full_name); setEmpleadoSearch(emp.full_name); }}
                                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
                                >
                                  {emp.full_name}
                                </button>
                              ))}
                              {filteredEmpleados.length === 0 && (
                                <p className="px-3 py-2 text-xs text-slate-400">No se encontró ese empleado</p>
                              )}
                            </div>
                          )}
                          {selectedEmpleado && (
                            <div className="flex items-center gap-2 bg-emerald-50/50 rounded-xl px-3 py-2 border border-emerald-200 mt-1">
                              <User className="h-4 w-4 text-emerald-600" />
                              <span className="text-sm font-semibold text-emerald-800">{selectedEmpleado}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-slate-700">Código de Seguridad *</label>
                          <Input
                            placeholder="Código de 6 dígitos"
                            type="text"
                            maxLength={6}
                            value={inputSecurityCode}
                            onChange={(e) => setInputSecurityCode(e.target.value.replace(/\D/g, ''))}
                            className="text-center text-2xl font-mono tracking-widest h-12 rounded-xl"
                          />
                        </div>
                      </div>
                      <DialogFooter className="flex-row gap-2">
                        <DialogClose asChild>
                          <Button variant="ghost" className="flex-1 rounded-xl">Cancelar</Button>
                        </DialogClose>
                        <Button
                          onClick={() => {
                            if (!selectedEmpleado) {
                              toast({ variant: 'destructive', title: 'Falta destinatario', description: 'Por favor, selecciona quién recibe la herramienta.' });
                              return;
                            }
                            if (solicitud.security_code && inputSecurityCode !== solicitud.security_code) {
                              toast({ variant: 'destructive', title: 'Código Incorrecto', description: 'El código ingresado no coincide con el código de seguridad del solicitante.' });
                              return;
                            }
                            updateStatus('Confirmada', selectedEmpleado);
                          }}
                          disabled={!selectedEmpleado || (solicitud.security_code && inputSecurityCode.length !== 6)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl"
                        >
                          Confirmar Entrega
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {/* BOTON DE RECHAZO */}
                <Dialog open={isRejectionOpen} onOpenChange={(open) => { setIsRejectionOpen(open); if(!open) setRejectionReason(''); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-12 rounded-xl text-red-600 border-red-200 hover:bg-red-50 font-bold mt-2">
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Rechazar Solicitud
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl w-[90%] max-w-md">
                    <DialogHeader>
                      <DialogTitle>Rechazar Solicitud</DialogTitle>
                      <CardDescription>
                        Por favor, explicá el motivo del rechazo para informar al encargado.
                      </CardDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Textarea 
                        placeholder="Ej: La herramienta no se encuentra en condiciones, obra destino con deudas, etc."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="min-h-[100px] rounded-xl"
                      />
                    </div>
                    <DialogFooter className="flex-row gap-2">
                      <DialogClose asChild>
                        <Button variant="ghost" className="flex-1 rounded-xl" disabled={rejecting}>Cancelar</Button>
                      </DialogClose>
                      <Button 
                        onClick={handleReject} 
                        disabled={!rejectionReason.trim() || rejecting}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                      >
                        {rejecting ? 'Rechazando...' : 'Confirmar Rechazo'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}

          {/* --- ACCIONES DEL ENCARGADO (solicitante) --- */}
          {!isLogistica && canAct && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tus Acciones</h4>
              <div className="flex flex-col gap-2">

                {/* Confirmar recepcion - solo cuando Logistica marco Entregada */}
                {solicitud.status === 'Entregada' && (
                  <div className="space-y-3">
                    {/* Buscador de empleado que recibe */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                        <User className="h-3.5 w-3.5" /> Quien recibe la herramienta en obra?
                      </p>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Buscar empleado..."
                          value={empleadoSearch}
                          onChange={(e) => { setEmpleadoSearch(e.target.value); setSelectedEmpleado(''); }}
                          className="pl-9 h-10 rounded-lg text-sm"
                        />
                      </div>
                      {empleadoSearch.length > 0 && !selectedEmpleado && (
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                          {filteredEmpleados.map(emp => (
                            <button
                              key={emp.id}
                              onClick={() => { setSelectedEmpleado(emp.full_name); setEmpleadoSearch(emp.full_name); }}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
                            >
                              {emp.full_name}
                            </button>
                          ))}
                          {filteredEmpleados.length === 0 && (
                            <p className="px-3 py-2 text-xs text-slate-400">No se encontro ese empleado</p>
                          )}
                        </div>
                      )}
                      {selectedEmpleado && (
                        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-emerald-300">
                          <User className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-800">{selectedEmpleado}</span>
                        </div>
                      )}
                    </div>
                    <Button 
                      onClick={() => updateStatus('Confirmada')}
                      disabled={!selectedEmpleado}
                      className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white font-bold w-full h-14 rounded-xl shadow-lg text-base disabled:opacity-40"
                    >
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Confirmar Recepcion y Generar Comprobante
                    </Button>
                  </div>
                )}

                {/* Mensaje de estado para el encargado */}
                {solicitud.status === 'Pendiente' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                    <Clock className="mx-auto h-8 w-8 text-orange-400 mb-2" />
                    <p className="text-sm font-semibold text-orange-700">Esperando confirmacion de Logistica</p>
                    <p className="text-xs text-orange-500 mt-1">El responsable asignado recibio tu solicitud por WhatsApp</p>
                  </div>
                )}
                {(solicitud.status === 'Asignada' || solicitud.status === 'En retiro' || solicitud.status === 'En traslado') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <Truck className="mx-auto h-8 w-8 text-blue-400 mb-2" />
                    <p className="text-sm font-semibold text-blue-700">Herramienta en camino</p>
                    <p className="text-xs text-blue-500 mt-1">Estado actual: *{solicitud.status}* - Cuando la recibas, aparecera el boton para confirmar</p>
                  </div>
                )}

                {/* Reportar problema - siempre visible si no esta confirmado */}
                <Button 
                  variant="outline"
                  onClick={() => {
                    const logisticaPhone = solicitud.assigned?.whatsapp;
                    if (!logisticaPhone) {
                      toast({ variant: 'destructive', title: 'Sin contacto', description: 'El responsable no tiene WhatsApp configurado.' });
                      return;
                    }
                    const msg = [
                      '*REPORTE DE PROBLEMA*',
                      '',
                      '*' + (profile?.full_name || 'Encargado') + '* reporta un inconveniente con el pedido:',
                      '',
                      '- *Herramienta:* ' + solicitud.herramientas.name,
                      '- *Codigo:* ' + solicitud.herramientas.code,
                      '- *Estado actual:* ' + solicitud.status,
                      '',
                      'Por favor revisar lo antes posible.',
                      '',
                      'Ver solicitud:',
                      APP_URL + '/solicitudes/' + solicitud.id
                    ].join('\n');
                    setWaPreviewPhone(logisticaPhone);
                    setWaPreviewMessage(msg);
                    setWaPreviewRecipientName(solicitud.assigned?.full_name || 'Logística');
                    setWaPreviewOpen(true);
                  }}
                  className="w-full h-12 rounded-xl text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 text-sm font-semibold"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Reportar Problema por WhatsApp
                </Button>

              </div>
            </div>
          )}

          {/* BOTON GENERAL DE ELIMINACION / CANCELACION (ADMIN O SOLICITANTE DE PENDIENTES) */}
          {canDelete && (
            <div className="pt-4 border-t border-slate-100 mt-4">
              <Button 
                variant="destructive"
                onClick={handleDelete}
                className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 duration-150"
              >
                <Trash2 className="h-4 w-4" />
                {isAdminOrLogistica ? 'Eliminar Movimiento Permanentemente' : 'Cancelar y Eliminar Solicitud'}
              </Button>
            </div>
          )}

          {/* COMPROBANTE FINAL - cuando el pedido esta Confirmado */}
          {(solicitud.status === 'Confirmada' || showReceipt) && (
            <div className="pt-4">
              <div ref={receiptRef} className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-lg">
                {/* Header del comprobante con logo */}
                <div className="bg-gradient-to-r from-peie-blue to-peie-light p-5 text-white text-center relative">
                  <img 
                    src="/logo-peie.png" 
                    alt="PEIE" 
                    className="h-10 mx-auto mb-2 brightness-0 invert"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <h3 className="text-lg font-bold tracking-wide">PEIE TOOLS</h3>
                  <p className="text-[10px] text-white/70 font-medium tracking-widest uppercase mt-0.5">Comprobante de Traslado</p>
                  <div className="absolute top-3 right-4 text-[9px] text-white/50 font-mono">
                    #{solicitud.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>

                {/* Cuerpo del comprobante */}
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha de emision</span>
                    <span className="text-xs font-mono text-slate-700">{new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Herramienta</span>
                      <span className="font-bold text-slate-800">{solicitud.herramientas?.name || solicitud.comments || 'Herramienta solicitada'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Codigo</span>
                      <span className="font-mono text-slate-700">{solicitud.herramientas?.code || 'PEDIDO LIBRE'}</span>
                    </div>
                    {solicitud.herramientas?.brand && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-xs">Marca / Modelo</span>
                        <span className="text-slate-700">{solicitud.herramientas.brand} {solicitud.herramientas.model || ''}</span>
                      </div>
                    )}
                    
                    <div className="h-px bg-slate-100 my-2" />
                    
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Origen</span>
                      <span className="text-red-600 font-medium">{solicitud.herramientas?.obras?.name || 'A determinar por Logística'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Destino</span>
                      <span className="text-green-600 font-medium">{solicitud.target_obra.name}</span>
                    </div>
                    
                    <div className="h-px bg-slate-100 my-2" />
                    
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Solicitante</span>
                      <span className="font-medium text-slate-800">{solicitud.profiles.full_name}</span>
                    </div>
                    {solicitud.assigned && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-xs">Responsable Logistica</span>
                        <span className="font-medium text-slate-800">{solicitud.assigned.full_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Prioridad</span>
                      <span className="text-slate-700">{solicitud.priority}</span>
                    </div>
                    {receivedByName && (
                      <div className="flex justify-between bg-emerald-50 px-2 py-1.5 rounded-lg -mx-1">
                        <span className="text-emerald-600 text-xs font-bold">Recibio en obra</span>
                        <span className="font-bold text-emerald-800">{receivedByName}</span>
                      </div>
                    )}
                  </div>

                  {/* Estado final */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center mt-4">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Estado</p>
                    <p className="text-lg font-black text-emerald-700 mt-0.5">TRASLADO COMPLETADO</p>
                  </div>

                  {/* Firmas */}
                  <div className="grid grid-cols-2 gap-4 pt-4 mt-2 border-t border-dashed border-slate-200">
                    <div className="text-center">
                      <div className="h-8 border-b border-slate-300 mb-1" />
                      <p className="text-[10px] text-slate-400 font-medium">Entrego (Logistica)</p>
                      <p className="text-[11px] font-semibold text-slate-600">{solicitud.assigned?.full_name || '-'}</p>
                    </div>
                    <div className="text-center">
                      <div className="h-8 border-b border-slate-300 mb-1" />
                      <p className="text-[10px] text-slate-400 font-medium">Recibio (Encargado)</p>
                      <p className="text-[11px] font-semibold text-slate-600">{solicitud.profiles.full_name}</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-5 py-3 text-center border-t border-slate-100">
                  <p className="text-[9px] text-slate-400 font-mono">PEIE Tools - Sistema de Trazabilidad de Herramientas</p>
                  <p className="text-[9px] text-slate-300 font-mono mt-0.5">Generado automaticamente el {new Date().toLocaleString('es-AR')}</p>
                </div>
              </div>

              {/* Boton para capturar screenshot del comprobante */}
              <p className="text-center text-xs text-slate-400 mt-3">
                Hace una captura de pantalla para guardar el comprobante
              </p>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Botón flotante para el seguimiento en vivo */}
      {solicitud.status === 'En traslado' && (
        <div className="fixed bottom-20 right-4 z-50 md:right-8 animate-bounce">
          <Button
            onClick={() => navigate(`/solicitudes/${solicitud.id}/seguimiento`)}
            className="shadow-2xl rounded-full bg-peie-blue hover:bg-peie-blue/90 text-white px-5 h-14 font-black text-xs flex items-center gap-2 border-2 border-white"
          >
            <Truck className="h-5 w-5" />
            SEGUIMIENTO EN VIVO
          </Button>
        </div>
      )}

      {/* Reusable WhatsApp Preview Modal */}
      <WhatsAppPreviewModal
        isOpen={waPreviewOpen}
        onClose={() => setWaPreviewOpen(false)}
        phone={waPreviewPhone}
        message={waPreviewMessage}
        recipientName={waPreviewRecipientName}
      />
    </div>
  );
}
