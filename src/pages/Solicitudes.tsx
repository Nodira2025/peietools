import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Clock, CheckCircle, Truck, AlertCircle, FileText, Search } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';
import { Input } from '@/components/ui/input';
import FilterBar from '../components/FilterBar';

interface Solicitud {
  id: string;
  type: 'herramienta' | 'personal';
  requester_id: string;
  priority: string;
  status: string;
  created_at: string;
  source_name?: string;
  target_name?: string;
  item_name?: string;
  item_code?: string;
  requester_name: string;
  requester_whatsapp: string | null;
  assigned_name?: string;
  // Raw data for backward compatibility or detail navigation
  raw_id?: string;
}

export default function Solicitudes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuthStore();
  const { toast } = useToast();

  const isHerramientasPage = location.pathname.startsWith('/pedidos-herramientas');
  const isPersonalPage = location.pathname.startsWith('/pedidos-personal');

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState(() => {
    if (location.pathname.startsWith('/pedidos-herramientas')) return 'herramienta';
    if (location.pathname.startsWith('/pedidos-personal')) return 'personal';
    return '';
  });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);
  const [filterMisPedidos, setFilterMisPedidos] = useState(profile?.role !== 'admin' && profile?.role !== 'logistica');

  useEffect(() => {
    if (isHerramientasPage) setFilterType('herramienta');
    else if (isPersonalPage) setFilterType('personal');
    else setFilterType('');
  }, [location.pathname]);

  useEffect(() => {
    if (profile) {
      setFilterMisPedidos(profile.role !== 'admin' && profile.role !== 'logistica');
    }
  }, [profile]);

  const fetchSolicitudes = async () => {
    setLoading(true);
    try {
      // 1. Fetch Herramientas (Solicitudes)
      const { data: toolsData, error: toolsError } = await supabase
        .from('solicitudes')
        .select(`
          id, requester_id, priority, status, created_at,
          profiles!solicitudes_requester_id_fkey(full_name, whatsapp),
          herramientas!solicitudes_herramienta_id_fkey(name, code, obras!herramientas_current_obra_id_fkey(name)),
          target_obra:obras!solicitudes_target_obra_id_fkey(name),
          assigned:profiles!solicitudes_assigned_to_fkey(full_name)
        `);

      if (toolsError) throw toolsError;

      // 2. Fetch Personal (Traslados)
      const { data: personalData, error: personalError } = await supabase
        .from('traslados_personal')
        .select(`
          id, requester_id, status, created_at,
          empleados!traslados_personal_empleado_id_fkey(full_name),
          source_obra:obras!traslados_personal_source_obra_id_fkey(name),
          target_obra:obras!traslados_personal_target_obra_id_fkey(name),
          requester:profiles!traslados_personal_requester_id_fkey(full_name, whatsapp)
        `);

      if (personalError) throw personalError;

      // 3. Unify data
      const unified: Solicitud[] = [
        ...(toolsData || []).map((s: any) => ({
          id: s.id,
          type: 'herramienta' as const,
          requester_id: s.requester_id,
          priority: s.priority,
          status: s.status,
          created_at: s.created_at,
          source_name: s.herramientas?.obras?.name || 'Desconocida',
          target_name: s.target_obra?.name || 'Desconocida',
          item_name: s.herramientas?.name,
          item_code: s.herramientas?.code,
          requester_name: s.profiles?.full_name,
          requester_whatsapp: s.profiles?.whatsapp,
          assigned_name: s.assigned?.full_name
        })),
        ...(personalData || []).map((s: any) => ({
          id: s.id,
          type: 'personal' as const,
          requester_id: s.requester_id,
          priority: 'Normal', // Traslados de personal no tienen prioridad en schema
          status: s.status,
          created_at: s.created_at,
          source_name: s.source_obra?.name || 'Sin obra',
          target_name: s.target_obra?.name || 'Desconocida',
          item_name: s.empleados?.full_name,
          item_code: 'PERSONAL',
          requester_name: s.requester?.full_name,
          requester_whatsapp: s.requester?.whatsapp
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setSolicitudes(unified);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
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
      phone = solicitud.requester_whatsapp || '';
      recipientName = solicitud.requester_name;
    }

    if (!phone) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se encontró un número de WhatsApp destino válido.' });
      return;
    }

    const itemLabel = solicitud.type === 'herramienta' ? 'herramienta' : 'personal';
    const message = [
      'Hola ' + recipientName + '.',
      '',
      solicitud.requester_name + ' solicita el siguiente traslado de ' + itemLabel + ':',
      '',
      '- *' + (solicitud.type === 'herramienta' ? 'Herramienta' : 'Empleado') + ':* ' + solicitud.item_name,
      solicitud.item_code !== 'PERSONAL' ? '- *Codigo:* ' + solicitud.item_code : '',
      '- *Ubicacion actual:* ' + solicitud.source_name,
      '- *Destino:* ' + solicitud.target_name,
      '- *Prioridad:* ' + solicitud.priority,
      '',
      'Revisar solicitud:',
      APP_URL + (solicitud.type === 'herramienta' ? '/solicitudes/' : '/personal/traslados/') + solicitud.id
    ].filter(line => line !== '').join('\n');

    window.open(buildWhatsAppLink(phone, message), '_blank');
  };

  const statusOpciones = ['Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada', 'Confirmada'];
  const prioridadOpciones = ['Baja', 'Normal', 'Alta', 'Urgente'];

  const filtered = solicitudes.filter(s => {
    const matchSearch = !searchTerm || 
      s.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.requester_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.target_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchType = !filterType || s.type === filterType;
    const matchStatus = !filterStatus || s.status === filterStatus;
    const matchPriority = !filterPriority || s.priority === filterPriority;
    const matchDate = !filterDate || s.created_at.startsWith(filterDate);
    const matchUser = !filterMisPedidos || s.requester_id === profile?.id;
    
    return matchSearch && matchType && matchStatus && matchPriority && matchDate && matchUser;
  });

  const pageTitle = isHerramientasPage 
    ? 'Pedido de Herramientas' 
    : isPersonalPage 
      ? 'Pedido de Personal' 
      : 'Pedidos';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-peie-blue">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {solicitudes.length} solicitudes</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar herramienta, solicitante, obra..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10 rounded-xl" />
        </div>
        <div className="flex items-center space-x-2 bg-white px-4 h-10 rounded-xl border border-slate-200/80 shadow-sm w-fit active:scale-98 transition-transform cursor-pointer" onClick={() => setFilterMisPedidos(!filterMisPedidos)}>
          <input 
            type="checkbox" 
            id="misPedidos" 
            checked={filterMisPedidos} 
            onChange={() => {}} 
            className="h-4 w-4 rounded border-gray-300 text-peie-blue focus:ring-peie-blue cursor-pointer" 
          />
          <label htmlFor="misPedidos" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
            Solo mis pedidos
          </label>
        </div>
      </div>

      <FilterBar
        filters={[
          ...(!isHerramientasPage && !isPersonalPage ? [{ key: 'type', label: 'Tipo', value: filterType, options: [{ value: 'herramienta', label: 'Herramienta' }, { value: 'personal', label: 'Personal' }] }] : []),
          { key: 'status', label: 'Estado', value: filterStatus, options: statusOpciones.map(s => ({ value: s, label: s })) },
          { key: 'priority', label: 'Prioridad', value: filterPriority, options: prioridadOpciones.map(p => ({ value: p, label: p })) },
          { key: 'date', label: 'Fecha Solicitud', value: filterDate, type: 'date' },
        ]}
        onFilterChange={(key, val) => { 
          if (key === 'type') setFilterType(val);
          else if (key === 'status') setFilterStatus(val); 
          else if (key === 'priority') setFilterPriority(val);
          else if (key === 'date') setFilterDate(val);
        }}
      />

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando solicitudes...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.slice(0, visibleCount).map(solicitud => (
            <Card key={solicitud.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{solicitud.type}</span>
                    <span className="text-xs font-mono text-muted-foreground">{new Date(solicitud.created_at).toLocaleDateString()}</span>
                  </div>
                  {getStatusBadge(solicitud.status)}
                </div>
                <CardTitle className="text-lg line-clamp-1">{solicitud.item_name}</CardTitle>
                <p className="text-sm font-medium">De: {solicitud.source_name} ➔ A: {solicitud.target_name}</p>
              </CardHeader>
              <CardContent className="text-sm space-y-2 mt-2 text-muted-foreground">
                <p><strong>Solicitante:</strong> {solicitud.requester_name}</p>
                {solicitud.type === 'herramienta' && <p><strong>Prioridad:</strong> {solicitud.priority}</p>}
                {solicitud.assigned_name && <p><strong>Asignado a:</strong> {solicitud.assigned_name}</p>}
                
                <div className="pt-4 flex justify-between gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleWhatsApp(solicitud)}>
                    <MessageCircle className="w-4 h-4 mr-2 text-green-600" /> WhatsApp
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-peie-blue text-peie-blue hover:bg-peie-blue/10 font-bold"
                    onClick={() => navigate(solicitud.type === 'herramienta' ? '/solicitudes/' + solicitud.id : '/personal/traslados/' + solicitud.id)}
                  >
                    Ver Detalles
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {visibleCount < filtered.length && (
            <div className="col-span-full pt-4">
              <Button 
                variant="ghost" 
                className="w-full py-6 text-peie-blue hover:bg-peie-blue/5 font-bold rounded-xl"
                onClick={() => setVisibleCount(prev => prev + 6)}
              >
                Ver más pedidos ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
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
