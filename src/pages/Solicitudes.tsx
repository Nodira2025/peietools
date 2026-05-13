import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Clock, CheckCircle, Truck, AlertCircle, FileText } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';

interface Solicitud {
  id: string;
  requester_id: string;
  herramienta_id: string;
  source_obra_id: string | null;
  target_obra_id: string;
  assigned_to: string | null;
  priority: string;
  status: string;
  comments: string | null;
  created_at: string;
  profiles: { full_name: string, whatsapp: string | null };
  herramientas: { name: string, code: string, obras: { name: string } | null };
  target_obra: { name: string };
  assigned?: { full_name: string };
}

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  const fetchSolicitudes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('solicitudes')
      .select(`
        *,
        profiles!solicitudes_requester_id_fkey(full_name, whatsapp),
        herramientas!solicitudes_herramienta_id_fkey(name, code, obras!herramientas_current_obra_id_fkey(name)),
        target_obra:obras!solicitudes_target_obra_id_fkey(name),
        assigned:profiles!solicitudes_assigned_to_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las solicitudes' });
    } else {
      setSolicitudes(data as unknown as Solicitud[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSolicitudes();
  }, []);



  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pendiente': return <span className="flex items-center text-orange-600 bg-orange-100 px-2 py-1 rounded text-xs font-semibold"><Clock className="w-3 h-3 mr-1" /> Pendiente</span>;
      case 'Asignada': return <span className="flex items-center text-blue-600 bg-blue-100 px-2 py-1 rounded text-xs font-semibold"><AlertCircle className="w-3 h-3 mr-1" /> Asignada</span>;
      case 'En retiro': return <span className="flex items-center text-purple-600 bg-purple-100 px-2 py-1 rounded text-xs font-semibold"><Truck className="w-3 h-3 mr-1" /> En Retiro</span>;
      case 'En traslado': return <span className="flex items-center text-peie-blue bg-peie-light/20 px-2 py-1 rounded text-xs font-semibold"><Truck className="w-3 h-3 mr-1" /> En Traslado</span>;
      case 'Entregada': return <span className="flex items-center text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-semibold"><CheckCircle className="w-3 h-3 mr-1" /> Entregada</span>;
      case 'Confirmada': return <span className="flex items-center text-gray-600 bg-gray-100 px-2 py-1 rounded text-xs font-semibold"><CheckCircle className="w-3 h-3 mr-1" /> Confirmada</span>;
      default: return <span className="bg-gray-100 px-2 py-1 rounded text-xs">{status}</span>;
    }
  };

  const getLogisticaPhone = async () => {
    const { data } = await supabase.from('profiles').select('full_name, whatsapp, role').eq('active', true);
    if (!data) return null;
    const logistica = data.find(p => p.role === 'logistica' && p.whatsapp);
    if (logistica) return logistica;
    const admin = data.find(p => p.role === 'admin' && p.whatsapp);
    return admin || null;
  };

  const handleWhatsApp = async (solicitud: Solicitud) => {
    let recipientName = 'Logística';
    let phone = '';

    if (solicitud.status === 'Pendiente') {
      const recipient = await getLogisticaPhone();
      if (recipient) {
        recipientName = recipient.full_name;
        phone = recipient.whatsapp;
      }
    } else {
      phone = solicitud.profiles.whatsapp || '';
      recipientName = solicitud.profiles.full_name;
    }

    if (!phone) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se encontró un número de WhatsApp destino válido.' });
      return;
    }

    const message = [
      'Hola ' + recipientName + '.',
      '',
      solicitud.profiles.full_name + ' solicita la siguiente herramienta:',
      '',
      '- *Herramienta:* ' + solicitud.herramientas.name,
      '- *Codigo:* ' + solicitud.herramientas.code,
      '- *Ubicacion actual:* ' + (solicitud.herramientas.obras?.name || 'Desconocida'),
      '- *Destino:* ' + solicitud.target_obra.name,
      '- *Prioridad:* ' + solicitud.priority,
      '',
      'Revisar solicitud:',
      APP_URL + '/solicitudes/' + solicitud.id
    ].join('\n');

    window.open(buildWhatsAppLink(phone, message), '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-peie-blue">Solicitudes</h1>
          <p className="text-muted-foreground">Gestiona las solicitudes de traslado de herramientas.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando solicitudes...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {solicitudes.map(solicitud => (
            <Card key={solicitud.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-muted-foreground">{new Date(solicitud.created_at).toLocaleDateString()}</span>
                  {getStatusBadge(solicitud.status)}
                </div>
                <CardTitle className="text-lg line-clamp-1">{solicitud.herramientas.name}</CardTitle>
                <p className="text-sm font-medium">De: {solicitud.herramientas.obras?.name || 'Desconocida'} ➔ A: {solicitud.target_obra.name}</p>
              </CardHeader>
              <CardContent className="text-sm space-y-2 mt-2 text-muted-foreground">
                <p><strong>Solicitante:</strong> {solicitud.profiles.full_name}</p>
                <p><strong>Prioridad:</strong> {solicitud.priority}</p>
                {solicitud.assigned && <p><strong>Asignado a:</strong> {solicitud.assigned.full_name}</p>}
                
                <div className="pt-4 flex justify-between gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleWhatsApp(solicitud)}>
                    <MessageCircle className="w-4 h-4 mr-2 text-green-600" /> WhatsApp
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-peie-blue text-peie-blue hover:bg-peie-blue/10"
                    onClick={() => navigate('/solicitudes/' + solicitud.id)}
                  >
                    Ver Detalles
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {solicitudes.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No hay solicitudes</h3>
              <p className="mt-1 text-gray-500">Todo está al día.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
