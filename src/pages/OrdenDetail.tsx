import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  MessageCircle, 
  FileText, 
  Clock, 
  CheckCircle2, 
  PlayCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface Orden {
  id: string;
  title: string;
  objective: string;
  start_date: string;
  due_date: string;
  priority: string;
  status: string;
  attachment_url: string | null;
  assigned_to: string;
  created_by: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    whatsapp: string | null;
  };
  creator?: {
    full_name: string | null;
    whatsapp: string | null;
  };
}

export default function OrdenDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [orden, setOrden] = useState<Orden | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchOrden = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select('*, assigned_to(full_name, whatsapp), created_by(full_name, whatsapp)')
      .eq('id', id)
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar la orden' });
      navigate('/ordenes');
    } else {
      setOrden(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrden();
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!orden) return;
    setUpdating(true);
    const { error } = await supabase
      .from('ordenes_trabajo')
      .update({ status: newStatus })
      .eq('id', orden.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Estado actualizado', description: `La orden ahora está en estado: ${newStatus}` });
      
      // Notificar por WhatsApp el cambio de estado
      const recipient = (newStatus === 'Realizada' || newStatus === 'Finalizada') ? orden.created_by : (orden as any).assigned_to;
      
      if (recipient?.whatsapp) {
        const msg = [
          `*ACTUALIZACIÓN DE ORDEN #${orden.id.slice(0, 8)}*`,
          '',
          `Hola *${recipient.full_name?.split(' ')[0]}*!`,
          `La tarea "*${orden.title}*" cambió su estado a: *${newStatus}*`,
          '',
          `Ver detalles: ${window.location.origin}/ordenes/${orden.id}`
        ].join('\n');
        
        window.open(`https://wa.me/${recipient.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
      }

      fetchOrden();
    }
    setUpdating(false);
  };

  const sendWhatsApp = () => {
    if (!orden || !(orden as any).assigned_to?.whatsapp) {
      toast({ variant: 'destructive', title: 'Error', description: 'El usuario asignado no tiene WhatsApp configurado.' });
      return;
    }

    const message = `*ORDEN DE TRABAJO #${orden.id.slice(0, 8)}*\n\n` +
      `📌 *Título:* ${orden.title}\n` +
      `🎯 *Objetivo:* ${orden.objective}\n` +
      `📅 *Vence:* ${orden.due_date ? new Date(orden.due_date).toLocaleDateString() : 'Pendiente'}\n` +
      `⚡ *Prioridad:* ${orden.priority}\n` +
      `🔄 *Estado Actual:* ${orden.status}\n\n` +
      `Ver más detalles en: ${window.location.origin}/ordenes/${orden.id}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${(orden as any).assigned_to.whatsapp}?text=${encodedMessage}`, '_blank');
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-peie-blue mb-4" size={40} />
      <p className="text-muted-foreground">Cargando detalles de la orden...</p>
    </div>
  );

  if (!orden) return null;

  const isAssignedToMe = profile?.id === orden.assigned_to;
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-safe">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ordenes')} className="rounded-full">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-peie-blue">Detalle de Orden</h1>
        </div>
        <Button 
          variant="outline" 
          onClick={sendWhatsApp}
          className="border-green-200 text-green-600 hover:bg-green-50 rounded-xl flex items-center gap-2"
        >
          <MessageCircle size={18} />
          <span className="hidden sm:inline">Compartir</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    orden.priority === 'Urgente' ? 'bg-red-100 text-red-700 border-red-200' :
                    orden.priority === 'Alta' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                    'bg-blue-100 text-blue-700 border-blue-200'
                  }`}>
                    {orden.priority}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {orden.status}
                  </span>
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">{orden.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                {orden.objective || 'Sin descripción detallada.'}
              </div>

              {orden.attachment_url && (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Archivo Adjunto</h4>
                  <a 
                    href={orden.attachment_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-peie-blue/5 rounded-xl border border-peie-blue/10 hover:bg-peie-blue/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <FileText className="text-peie-blue" size={20} />
                      </div>
                      <span className="text-sm font-medium text-peie-blue">Ver Documento / Imagen</span>
                    </div>
                    <ExternalLink size={16} className="text-peie-blue" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Acciones de Estado</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button 
                  variant="outline" 
                  disabled={updating || orden.status === 'Aceptada'}
                  onClick={() => updateStatus('Aceptada')}
                  className="rounded-xl flex items-center gap-2 h-12"
                >
                  <Clock size={18} />
                  Aceptar
                </Button>
                <Button 
                  variant="outline"
                  disabled={updating || orden.status === 'En Progreso'}
                  onClick={() => updateStatus('En Progreso')}
                  className="rounded-xl flex items-center gap-2 h-12 border-amber-200 text-amber-600 hover:bg-amber-50"
                >
                  <PlayCircle size={18} />
                  En Progreso
                </Button>
                <Button 
                  disabled={updating || (orden.status === 'Realizada' || orden.status === 'Finalizada')}
                  onClick={() => updateStatus('Realizada')}
                  className="rounded-xl flex items-center gap-2 h-12 bg-green-600 hover:bg-green-700 text-white shadow-md"
                >
                  <CheckCircle2 size={18} />
                  Marcar Realizada
                </Button>
              </div>

              {/* Boton de confirmación final para el creador */}
              {profile?.id === orden.created_by && orden.status === 'Realizada' && (
                <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center text-center">
                    <CheckCircle2 className="text-emerald-500 mb-2" size={32} />
                    <h4 className="font-bold text-emerald-900">¿La tarea fue completada correctamente?</h4>
                    <p className="text-xs text-emerald-700 mt-1 mb-4">Como solicitante, debés confirmar que el trabajo se realizó según lo esperado.</p>
                    <Button 
                      onClick={() => updateStatus('Finalizada')}
                      disabled={updating}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-emerald-200/50"
                    >
                      Sí, Confirmar y Finalizar
                    </Button>
                  </div>
                </div>
              )}

              {orden.status === 'Finalizada' && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                  <p className="text-sm font-bold text-slate-500">Esta orden ha sido FINALIZADA y confirmada.</p>
                </div>
              )}

              <p className="text-[10px] text-center text-slate-400 mt-4">
                * El cambio de estado queda registrado inmediatamente y se enviará una notificación a la otra parte.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Detalles de Seguimiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <User size={18} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Asignado a</p>
                  <p className="text-sm font-medium text-slate-700">{(orden as any).assigned_to?.full_name || 'Sin nombre'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Calendar size={18} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Fecha Inicio</p>
                  <p className="text-sm font-medium text-slate-700">{new Date(orden.start_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Calendar size={18} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Fecha Vencimiento</p>
                  <p className="text-sm font-medium text-slate-700">{orden.due_date ? new Date(orden.due_date).toLocaleDateString() : 'No definida'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Clock size={18} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Creada el</p>
                  <p className="text-sm font-medium text-slate-700">{new Date(orden.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {(orden as any).assigned_to?.whatsapp && (
             <Card className="bg-green-600 border-none text-white shadow-lg overflow-hidden relative">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <MessageCircle size={80} />
               </div>
               <CardContent className="p-6 relative z-10">
                 <h4 className="font-bold mb-1">WhatsApp Directo</h4>
                 <p className="text-xs text-green-50 mb-4">¿Necesitas coordinar con {(orden as any).assigned_to.full_name?.split(' ')[0]}?</p>
                 <Button 
                   onClick={sendWhatsApp}
                   className="w-full bg-white text-green-600 hover:bg-green-50 font-bold rounded-xl"
                 >
                   Abrir Chat
                 </Button>
               </CardContent>
             </Card>
          )}
        </div>
      </div>
    </div>
  );
}
