import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Truck, MessageCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';

interface Obra {
  id: string;
  name: string;
}

interface Herramienta {
  id: string;
  name: string;
  code: string;
  current_obra_id: string | null;
  obras?: { name: string } | null;
}

interface PersonalLogistica {
  id: string;
  full_name: string;
  whatsapp: string | null;
  role: string;
}

export default function NuevaSolicitud() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  
  // Si viene desde la vista de detalle de herramienta, tomamos el ID pre-cargado
  const preselectedToolId = location.state?.herramientaId || '';

  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [personalLogistica, setPersonalLogistica] = useState<PersonalLogistica[]>([]);
  
  const [selectedToolId, setSelectedToolId] = useState(preselectedToolId);
  const [targetObraId, setTargetObraId] = useState('');
  const [selectedLogisticaId, setSelectedLogisticaId] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // 1. Cargar herramientas disponibles
      const { data: toolsData } = await supabase
        .from('herramientas')
        .select('id, name, code, current_obra_id, obras(name)')
        .eq('status', 'Disponible')
        .order('name');
      if (toolsData) setHerramientas(toolsData as unknown as Herramienta[]);

      // 2. Cargar Obras destino
      const { data: obrasData } = await supabase
        .from('obras')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (obrasData) setObras(obrasData);

      // 3. Cargar Personal de Logística (y Admins como respaldo) para notificar por WhatsApp
      const { data: logisticaData } = await supabase
        .from('profiles')
        .select('id, full_name, whatsapp, role')
        .eq('active', true)
        .in('role', ['logistica', 'admin'])
        .order('full_name');
      if (logisticaData) setPersonalLogistica(logisticaData as PersonalLogistica[]);
    }

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!selectedToolId || !targetObraId || !selectedLogisticaId) {
      toast({ 
        variant: 'destructive', 
        title: 'Faltan datos', 
        description: 'Debes seleccionar la herramienta, la obra de destino y el responsable de logística.' 
      });
      return;
    }

    const tool = herramientas.find(h => h.id === selectedToolId);
    const logisticaUser = personalLogistica.find(p => p.id === selectedLogisticaId);
    const targetObra = obras.find(o => o.id === targetObraId);

    if (!tool || !logisticaUser || !targetObra) return;

    if (!logisticaUser.whatsapp) {
      toast({ 
        variant: 'destructive', 
        title: 'Contacto Incompleto', 
        description: `El agente ${logisticaUser.full_name} no tiene un número de WhatsApp configurado en el sistema.` 
      });
      return;
    }

    setLoading(true);

    // 1. Guardar la solicitud en base de datos
    const { data: newSolicitud, error } = await supabase.from('solicitudes').insert([{
      requester_id: profile.id,
      herramienta_id: selectedToolId,
      source_obra_id: tool.current_obra_id,
      target_obra_id: targetObraId,
      assigned_to: selectedLogisticaId, // Asignamos directamente al de logística elegido
      priority,
      status: 'Pendiente',
      comments: comments.trim() || null
    }]).select().single();

    if (newSolicitud) {
      // Registrar el movimiento inicial de trazabilidad
      await supabase.from('movimientos').insert([{
        herramienta_id: selectedToolId,
        solicitud_id: newSolicitud.id,
        user_id: profile.id,
        action: 'Generó solicitud de traslado',
        notes: `Hacia obra destino con prioridad ${priority}`
      }]);
    }

    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error al solicitar', description: error.message });
    } else {
      toast({ title: '¡Solicitud Generada!', description: 'Notificando de inmediato al encargado de logística por WhatsApp...' });
      
      // 2. Construir el mensaje de WhatsApp y abrir en pestaña nueva
      const waMessage = [
        '*NUEVA SOLICITUD DE TRASLADO*',
        '',
        'Hola *' + logisticaUser.full_name.split(' ')[0] + '*, tenes un nuevo pedido de logistica:',
        '',
        '- *Solicita:* ' + profile.full_name + ' (' + profile.role + ')',
        '- *Herramienta:* ' + tool.name,
        '- *Codigo:* ' + tool.code,
        '- *Origen:* ' + (tool.obras?.name || 'Base Desconocida'),
        '- *Destino:* ' + targetObra.name,
        '- *Prioridad:* ' + priority,
        '',
        '*Notas:* ' + (comments.trim() || 'Sin especificaciones'),
        '',
        'Aprobar o gestionar el envio desde aca:',
        APP_URL + '/solicitudes/' + newSolicitud.id
      ].join('\n');

      // Redirigir a la vista de solicitudes para limpiar y abrir el WhatsApp
      navigate('/solicitudes');
      setTimeout(() => {
        window.open(buildWhatsAppLink(logisticaUser.whatsapp!, waMessage), '_blank');
      }, 300);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-safe">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate(-1)} className="p-0 hover:bg-transparent text-peie-blue">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver atrás
        </Button>
      </div>

      <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-2xl">
        <div className="h-1.5 bg-gradient-to-r from-peie-light via-peie-blue to-peie-light" />
        
        <CardHeader className="pb-4 pt-6 px-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-peie-light/10 text-peie-blue font-bold">
              <Truck size={20} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-peie-blue">Solicitar Herramienta</CardTitle>
              <CardDescription className="text-xs">Coordina el traslado seguro seleccionando al personal de logística</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1.5">
              <Label htmlFor="tool" className="text-xs font-semibold text-slate-700">Herramienta Disponible *</Label>
              <Select value={selectedToolId} onValueChange={setSelectedToolId} required>
                <SelectTrigger className="h-11 rounded-xl text-slate-800">
                  <SelectValue placeholder="Selecciona qué herramienta necesitas" />
                </SelectTrigger>
                <SelectContent>
                  {herramientas.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-mono text-xs text-slate-400 mr-2">[{t.code}]</span> 
                      <span className="font-medium text-slate-800">{t.name}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({t.obras?.name || 'Sin obra'})</span>
                    </SelectItem>
                  ))}
                  {herramientas.length === 0 && (
                    <div className="p-2 text-center text-xs text-slate-400">No hay herramientas con estado 'Disponible'</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetObra" className="text-xs font-semibold text-slate-700">Obra o Base de Destino *</Label>
              <Select value={targetObraId} onValueChange={setTargetObraId} required>
                <SelectTrigger className="h-11 rounded-xl text-slate-800">
                  <SelectValue placeholder="¿Hacia dónde debe enviarse?" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SELECCIÓN ESPECÍFICA DE EMPLEADO DE LOGÍSTICA PARA EL WA.ME */}
            <div className="space-y-1.5 bg-peie-blue/5 p-3.5 rounded-xl border border-peie-blue/10">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageCircle size={14} className="text-green-600" />
                <Label htmlFor="logistica" className="text-xs font-bold text-peie-blue uppercase tracking-wide">
                  Despachar mensaje a Logística *
                </Label>
              </div>
              <p className="text-[11px] text-slate-600 mb-2.5 leading-snug">
                Elige de la lista al empleado o administrador encargado para que reciba la orden instantánea en su WhatsApp.
              </p>

              <Select value={selectedLogisticaId} onValueChange={setSelectedLogisticaId} required>
                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 text-slate-800">
                  <SelectValue placeholder="Selecciona un responsable de logística" />
                </SelectTrigger>
                <SelectContent>
                  {personalLogistica.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-medium text-slate-800">{p.full_name}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5 capitalize">({p.role})</span>
                      {p.whatsapp ? (
                        <span className="text-[9px] text-emerald-600 ml-1 font-mono">✓ WA</span>
                      ) : (
                        <span className="text-[9px] text-rose-500 ml-1 font-mono">⚠ Sin Tel</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-xs font-semibold text-slate-700">Nivel de Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-11 rounded-xl text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baja">🟢 Baja</SelectItem>
                    <SelectItem value="Normal">🔵 Normal</SelectItem>
                    <SelectItem value="Alta">🟠 Alta</SelectItem>
                    <SelectItem value="Urgente">🔴 Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comments" className="text-xs font-semibold text-slate-700">Comentarios Adicionales</Label>
                <Input 
                  id="comments" 
                  placeholder="Ej: Se requiere para hormigonado de losa..." 
                  value={comments} 
                  onChange={e => setComments(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 mt-4 rounded-xl bg-peie-blue hover:bg-peie-blue/90 text-white font-medium flex items-center justify-center gap-2"
              disabled={loading}
            >
              <MessageCircle size={18} className="text-peie-light animate-bounce" />
              <span>{loading ? 'Procesando...' : 'Confirmar y Notificar por WhatsApp'}</span>
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
