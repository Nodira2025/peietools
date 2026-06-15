import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Clock, CheckCircle, MapPin, HardHat, AlertCircle, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';
import { FileText, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function TrasladoPersonalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [traslado, setTraslado] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (id) fetchTraslado();
  }, [id]);

  const fetchTraslado = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('traslados_personal')
      .select(`
        *,
        empleados!traslados_personal_empleado_id_fkey(full_name),
        source_obra:obras!traslados_personal_source_obra_id_fkey(name, encargado_name),
        target_obra:obras!traslados_personal_target_obra_id_fkey(name, encargado_name),
        requester:profiles!traslados_personal_requester_id_fkey(full_name, whatsapp),
        confirmed_profile:profiles!traslados_personal_confirmed_by_fkey(full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Traslado no encontrado.' });
      navigate('/personal');
    } else {
      setTraslado(data);
      if (data.status === 'Confirmado') setShowReceipt(true);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pendiente': return <span className="flex items-center text-orange-600 bg-orange-100 px-3 py-1.5 rounded-full text-xs font-bold"><Clock className="w-3 h-3 mr-1" /> Pendiente</span>;
      case 'Confirmado': return <span className="flex items-center text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full text-xs font-bold"><CheckCircle className="w-3 h-3 mr-1" /> Confirmado</span>;
      case 'Rechazado': return <span className="flex items-center text-red-700 bg-red-100 px-3 py-1.5 rounded-full text-xs font-bold"><AlertCircle className="w-3 h-3 mr-1" /> Rechazado</span>;
      case 'Cancelado': return <span className="flex items-center text-red-600 bg-red-100 px-3 py-1.5 rounded-full text-xs font-bold"><AlertCircle className="w-3 h-3 mr-1" /> Cancelado</span>;
      default: return <span className="bg-gray-100 px-3 py-1.5 rounded-full text-xs">{status}</span>;
    }
  };

  const confirmarRecepcion = async () => {
    if (!traslado || !profile) return;

    try {
      // 1. Actualizar estado del traslado
      const { error: trasError } = await supabase
        .from('traslados_personal')
        .update({
          status: 'Confirmado',
          confirmed_by: profile.id,
          confirmed_at: new Date().toISOString()
        })
        .eq('id', traslado.id);

      if (trasError) throw trasError;

      // 2. Actualizar la ubicación del empleado
      const { error: empError } = await supabase
        .from('empleados')
        .update({ 
          obra_id: traslado.target_obra_id,
          status: 'Trabajando'
        })
        .eq('id', traslado.empleado_id);

      if (empError) throw empError;

      toast({ 
        title: 'Recepción Confirmada!', 
        description: 'El personal ya figura en su nueva obra.',
        className: 'bg-emerald-50 border-emerald-200'
      });

      // 3. Generar WhatsApp al Encargado Origen (requester)
      if (traslado.requester?.whatsapp) {
        const msg = [
          '*RECEPCIÓN DE PERSONAL CONFIRMADA*',
          '',
          `*${profile.full_name}* confirmó la llegada del personal a *${traslado.target_obra.name}*:`,
          '',
          `- *Empleado:* ${traslado.empleados.full_name}`,
          `- *Origen:* ${traslado.source_obra?.name || 'Desconocida'}`,
          '',
          'El traslado se completó con éxito.',
          '',
          'Ver comprobante:',
          `${APP_URL}/personal/traslados/${traslado.id}`
        ].join('\n');

        window.open(buildWhatsAppLink(traslado.requester.whatsapp.replace(/\D/g, ''), msg), '_blank'); 
      }
      
      fetchTraslado();

    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleReject = async () => {
    if (!traslado || !profile || !rejectionReason.trim()) return;
    
    setRejecting(true);
    const { error } = await supabase
      .from('traslados_personal')
      .update({ 
        status: 'Rechazado', 
        rejection_reason: rejectionReason 
      })
      .eq('id', traslado.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setRejecting(false);
      return;
    }

    // Reset the employee status back to Disponible
    await supabase
      .from('empleados')
      .update({ status: 'Disponible' })
      .eq('id', traslado.empleado_id);

    toast({ title: 'Traslado Rechazado', description: 'Notificando al encargado...' });

    const requesterPhone = traslado.requester?.whatsapp;
    if (requesterPhone) {
      const msg = [
        '*TRASLADO DE PERSONAL RECHAZADO*',
        '',
        'Hola *' + traslado.requester.full_name.split(' ')[0] + '*!',
        'La solicitud de traslado para *' + traslado.empleados.full_name + '* fue rechazada.',
        '',
        '*Motivo:* ' + rejectionReason,
        '',
        'Podés ver los detalles acá:',
        APP_URL + '/personal/traslados/' + traslado.id
      ].join('\n');
      window.open(buildWhatsAppLink(requesterPhone, msg), '_blank');
    }

    setRejecting(false);
    fetchTraslado();
  };

  const handleWhatsAppShare = () => {
    if (!traslado) return;
    
    const msg = [
      '*SOLICITUD DE TRASLADO DE PERSONAL*',
      '',
      `Se solicita trasladar a: *${traslado.empleados.full_name}*`,
      `- *Desde:* ${traslado.source_obra?.name || 'Sin obra'}`,
      `- *Hacia:* ${traslado.target_obra.name}`,
      '',
      'Ver detalles y confirmar:',
      `${APP_URL}/personal/traslados/${traslado.id}`
    ].join('\n');

    const phone = traslado.requester?.whatsapp || '';
    window.open(buildWhatsAppLink(phone.replace(/\D/g, ''), msg), '_blank');
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este traslado permanentemente? Esta acción no se puede deshacer.')) return;
    try {
      if (traslado.empleado_id) {
        await supabase
          .from('empleados')
          .update({ 
            status: 'Disponible',
            obra_id: traslado.source_obra_id || null
          })
          .eq('id', traslado.empleado_id);
      }

      const { error } = await supabase
        .from('traslados_personal')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Traslado Eliminado', description: 'El traslado de personal fue borrado de la base de datos.' });
      navigate('/pedidos-personal');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando traslado...</div>;
  if (!traslado) return null;

  const userRole = profile?.role?.toLowerCase();
  const isSourceEncargado = !!(traslado.source_obra?.encargado_name && profile?.full_name && 
    profile.full_name.toLowerCase().trim() === traslado.source_obra.encargado_name.toLowerCase().trim());
  
  const isTargetEncargado = !!(traslado.target_obra?.encargado_name && profile?.full_name && 
    profile.full_name.toLowerCase().trim() === traslado.target_obra.encargado_name.toLowerCase().trim());

  const canConfirm = traslado.status === 'Pendiente' && (
    profile?.obra_id === traslado.target_obra_id || 
    profile?.obra_id === traslado.source_obra_id ||
    userRole === 'admin' || 
    isSourceEncargado || 
    isTargetEncargado
  );
  
  const isLogistica = userRole === 'logistica' || userRole === 'admin';
  const isAdminOrLogistica = userRole === 'admin' || userRole === 'logistica';
  const isRequester = profile?.id === traslado?.requester_id;
  const canDelete = isAdminOrLogistica || (isRequester && traslado?.status === 'Pendiente');

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-safe">
      <div className="flex items-center mb-4">
        <Button variant="ghost" onClick={() => navigate('/personal')} className="p-0 hover:bg-transparent">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>

      <Card className="shadow-sm border-0 ring-1 ring-slate-100 rounded-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-peie-light via-peie-blue to-peie-light" />
        <CardHeader className="pb-4 pt-6">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold text-peie-blue flex items-center gap-2">
                <HardHat className="h-6 w-6" />
                {traslado.empleados.full_name}
              </CardTitle>
              <CardDescription className="text-sm mt-1 flex items-center gap-1">
                <FileText size={14} /> ID: {traslado.id.slice(0, 8).toUpperCase()}
              </CardDescription>
            </div>
            {getStatusBadge(traslado.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center py-2">
             <Button variant="outline" size="sm" onClick={handleWhatsAppShare} className="rounded-full gap-2 text-green-600 border-green-200 hover:bg-green-50">
               <Share2 size={16} /> Compartir por WhatsApp
             </Button>
          </div>
          {/* Info del traslado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3"/> Origen</p>
              <p className="font-semibold text-red-700 text-sm mt-0.5">{traslado.source_obra?.name || 'Sin obra previa'}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-xl border border-green-100">
              <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3"/> Destino</p>
              <p className="font-semibold text-green-700 text-sm mt-0.5">{traslado.target_obra?.name}</p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-sm">
            <p><strong className="text-slate-500">Solicitado por:</strong> <span className="text-slate-800 font-medium">{traslado.requester?.full_name || '-'}</span></p>
            <p><strong className="text-slate-500">Fecha de inicio:</strong> <span className="text-slate-800 font-medium">{new Date(traslado.created_at).toLocaleString()}</span></p>
            {traslado.status === 'Rechazado' && traslado.rejection_reason && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs font-bold text-red-600 uppercase mb-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Motivo del Rechazo
                </p>
                <p className="text-sm text-red-800 italic">"{traslado.rejection_reason}"</p>
              </div>
            )}
          </div>

          {/* Acciones */}
          {canConfirm && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tus Acciones</h4>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center mb-3">
                <CheckCircle className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-emerald-700">El personal ha sido enviado a tu obra.</p>
                <p className="text-xs text-emerald-600/80 mt-1">Presioná confirmar cuando el empleado llegue al lugar.</p>
              </div>
              <Button 
                onClick={confirmarRecepcion}
                className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white font-bold w-full h-14 rounded-xl shadow-lg text-base"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Confirmar Recepción
              </Button>
            </div>
          )}

          {isLogistica && traslado.status === 'Pendiente' && (
            <div className="pt-4 border-t border-slate-100">
               <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-12 rounded-xl text-red-600 border-red-200 hover:bg-red-50 font-bold">
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Rechazar Traslado
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl w-[90%] max-w-md">
                    <DialogHeader>
                      <DialogTitle>Rechazar Traslado de Personal</DialogTitle>
                      <CardDescription>
                        Por favor, explicá el motivo del rechazo.
                      </CardDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Textarea 
                        placeholder="Ej: Falta de documentación, obra destino completa, etc."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="min-h-[100px] rounded-xl"
                      />
                    </div>
                    <DialogFooter className="flex-row gap-2">
                      <Button variant="ghost" className="flex-1 rounded-xl" disabled={rejecting}>Cancelar</Button>
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
          )}

          {!canConfirm && traslado.status === 'Pendiente' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center mt-4">
              <Clock className="mx-auto h-8 w-8 text-orange-400 mb-2" />
              <p className="text-sm font-semibold text-orange-700">Esperando confirmación de destino</p>
              <p className="text-xs text-orange-500 mt-1">El encargado de {traslado.target_obra?.name} debe confirmar la recepción al llegar.</p>
            </div>
          )}

          {/* BOTON GENERAL DE ELIMINACION / CANCELACION */}
          {canDelete && (
            <div className="pt-4 border-t border-slate-100 mt-4">
              <Button 
                variant="destructive"
                onClick={handleDelete}
                className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 duration-150"
              >
                <Trash2 className="h-4 w-4" />
                {isAdminOrLogistica ? 'Eliminar Traslado Permanentemente' : 'Cancelar y Eliminar Traslado'}
              </Button>
            </div>
          )}

          {/* COMPROBANTE FINAL */}
          {(showReceipt) && (
            <div className="pt-4 mt-4 border-t border-slate-100">
              <div ref={receiptRef} className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-peie-blue to-peie-light p-5 text-white text-center relative">
                  <h3 className="text-lg font-bold tracking-wide">PEIE TOOLS</h3>
                  <p className="text-[10px] text-white/70 font-medium tracking-widest uppercase mt-0.5">Comprobante de Personal</p>
                  <div className="absolute top-3 right-4 text-[9px] text-white/50 font-mono">
                    #{traslado.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha</span>
                    <span className="text-xs font-mono text-slate-700">{new Date(traslado.confirmed_at).toLocaleDateString('es-AR')}</span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Empleado</span>
                      <span className="font-bold text-slate-800">{traslado.empleados.full_name}</span>
                    </div>
                    
                    <div className="h-px bg-slate-100 my-2" />
                    
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Origen</span>
                      <span className="text-red-600 font-medium">{traslado.source_obra?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Destino</span>
                      <span className="text-green-600 font-medium">{traslado.target_obra?.name}</span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center mt-4">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Estado</p>
                    <p className="text-lg font-black text-emerald-700 mt-0.5">TRASLADO COMPLETADO</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 mt-2 border-t border-dashed border-slate-200">
                    <div className="text-center">
                      <div className="h-8 border-b border-slate-300 mb-1" />
                      <p className="text-[10px] text-slate-400 font-medium">Envió</p>
                      <p className="text-[11px] font-semibold text-slate-600">{traslado.requester?.full_name}</p>
                    </div>
                    <div className="text-center">
                      <div className="h-8 border-b border-slate-300 mb-1" />
                      <p className="text-[10px] text-slate-400 font-medium">Recibió</p>
                      <p className="text-[11px] font-semibold text-slate-600">{traslado.confirmed_profile?.full_name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
