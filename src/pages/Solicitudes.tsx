import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Clock, CheckCircle, Truck, AlertCircle, FileText, Search, ArrowRightLeft } from 'lucide-react';
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
  
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('all');
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
      case 'Pendiente': 
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm"><Clock className="w-3.5 h-3.5 animate-pulse" /> Pendiente</span>;
      case 'Asignada': 
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 shadow-sm"><CheckCircle className="w-3.5 h-3.5" /> Recibido/Leído</span>;
      case 'En retiro': 
      case 'En traslado': 
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 shadow-sm"><Truck className="w-3.5 h-3.5" /> En curso</span>;
      case 'Entregada': 
      case 'Confirmada': 
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm"><CheckCircle className="w-3.5 h-3.5" /> Entregado</span>;
      case 'Cancelada':
      case 'Rechazada':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 shadow-sm"><AlertCircle className="w-3.5 h-3.5" /> {status}</span>;
      default: 
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-sm">{status}</span>;
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

  const prioridadOpciones = ['Baja', 'Normal', 'Alta', 'Urgente'];

  // Base list filtered by search, only-my-orders, type, priority, date
  const baseFiltered = solicitudes.filter(s => {
    const matchType = !filterType || s.type === filterType;
    const matchUser = !filterMisPedidos || s.requester_id === profile?.id;
    const matchSearch = !searchTerm || 
      s.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.requester_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.target_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPriority = !filterPriority || s.priority === filterPriority;
    const matchDate = !filterDate || s.created_at.startsWith(filterDate);
    
    return matchType && matchUser && matchSearch && matchPriority && matchDate;
  });

  // Calculate segment counts based on the base filtered list
  const counts = {
    all: baseFiltered.length,
    pending: baseFiltered.filter(s => ['Pendiente', 'Asignada', 'En retiro', 'En traslado'].includes(s.status)).length,
    delivered: baseFiltered.filter(s => ['Entregada', 'Confirmada'].includes(s.status)).length,
    cancelled: baseFiltered.filter(s => ['Cancelada', 'Rechazada'].includes(s.status)).length
  };

  // Final filtered list to render (applies activeTab status filter)
  const finalFiltered = baseFiltered.filter(s => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ['Pendiente', 'Asignada', 'En retiro', 'En traslado'].includes(s.status);
    if (activeTab === 'delivered') return ['Entregada', 'Confirmada'].includes(s.status);
    if (activeTab === 'cancelled') return ['Cancelada', 'Rechazada'].includes(s.status);
    return true;
  });

  const pageTitle = isHerramientasPage 
    ? 'Movimiento de Herramientas' 
    : isPersonalPage 
      ? 'Movimiento de Personal' 
      : 'Mis Pedidos';

  const totalPageTypeRequests = solicitudes.filter(s => !filterType || s.type === filterType).length;

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-10">
      {/* Cabecera */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">{pageTitle}</h1>
        <p className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full w-fit">
          {finalFiltered.length} de {totalPageTypeRequests} solicitudes
        </p>
      </div>

      {/* Fila de Acción & Búsqueda */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-[24px] border border-slate-200/80 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar herramienta, solicitante, obra..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-10 h-11 rounded-xl border-slate-200 focus-visible:ring-peie-blue shadow-none text-slate-700 text-sm" 
          />
        </div>
        
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3">
          <div 
            className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100/80 px-4 h-11 rounded-xl border border-slate-200/60 shadow-sm active:scale-98 transition-all cursor-pointer select-none" 
            onClick={() => setFilterMisPedidos(!filterMisPedidos)}
          >
            <input 
              type="checkbox" 
              id="misPedidos" 
              checked={filterMisPedidos} 
              onChange={() => {}} 
              className="h-4 w-4 rounded border-slate-300 text-peie-blue focus:ring-peie-blue cursor-pointer" 
            />
            <label htmlFor="misPedidos" className="text-xs font-bold text-slate-700 cursor-pointer">
              Solo mis pedidos
            </label>
          </div>
          
          <Button 
            onClick={() => {
              if (isHerramientasPage) {
                navigate('/solicitudes/nueva');
              } else if (isPersonalPage) {
                navigate('/personal');
                toast({
                  title: "Crear traslado de personal",
                  description: "Selecciona un empleado de la lista y haz clic en 'Asignar' o 'Trasladar' para iniciar.",
                });
              } else {
                navigate('/solicitudes/nueva');
              }
            }}
            className="bg-peie-blue hover:bg-peie-blue/90 text-white rounded-xl h-11 px-5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 active:scale-95 font-bold text-xs"
          >
            + Nuevo Pedido
          </Button>
        </div>
      </div>

      {/* Control de Segmentos de Estado */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[20px] overflow-x-auto no-scrollbar scroll-smooth shadow-inner">
        {[
          { value: 'all', label: 'Todos', count: counts.all },
          { value: 'pending', label: 'Pendientes', count: counts.pending },
          { value: 'delivered', label: 'Entregados', count: counts.delivered },
          { value: 'cancelled', label: 'Cancelados', count: counts.cancelled }
        ].map(tab => (
          <Button 
            key={tab.value}
            variant={activeTab === tab.value ? 'default' : 'ghost'} 
            onClick={() => {
              setActiveTab(tab.value as any);
              setVisibleCount(6); // Reset pagination on tab change
            }}
            className={`flex-1 min-w-[105px] rounded-xl text-xs h-10 font-bold transition-all duration-200 ${
              activeTab === tab.value 
                ? 'bg-peie-blue text-white shadow-md hover:bg-peie-blue/90' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            {tab.label} 
            <span className={`ml-1.5 px-2 py-0.5 text-[10px] rounded-md font-bold ${
              activeTab === tab.value 
                ? 'bg-white/20 text-white' 
                : 'bg-slate-200 text-slate-600'
            }`}>{tab.count}</span>
          </Button>
        ))}
      </div>

      {/* Filtros Secundarios (Prioridad, Fecha) */}
      <FilterBar
        filters={[
          { key: 'priority', label: 'Prioridad', value: filterPriority, options: prioridadOpciones.map(p => ({ value: p, label: p })) },
          { key: 'date', label: 'Fecha Solicitud', value: filterDate, type: 'date' },
        ]}
        onFilterChange={(key, val) => { 
          if (key === 'priority') setFilterPriority(val);
          else if (key === 'date') setFilterDate(val);
          setVisibleCount(6); // Reset pagination on filter change
        }}
      />

      {/* Listado principal */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-3 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Cargando solicitudes...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {finalFiltered.slice(0, visibleCount).map(solicitud => (
            <Card key={solicitud.id} className="relative group overflow-hidden border border-slate-200 hover:border-peie-blue/30 shadow-sm hover:shadow-md transition-all duration-350 rounded-[24px] bg-white">
              {/* Indicador superior de estado */}
              <div className={`absolute top-0 left-0 right-0 h-[4px] transition-colors ${
                solicitud.status === 'Pendiente' ? 'bg-amber-400' :
                ['Asignada', 'En retiro', 'En traslado'].includes(solicitud.status) ? 'bg-peie-blue' :
                ['Entregada', 'Confirmada'].includes(solicitud.status) ? 'bg-emerald-500' : 'bg-rose-400'
              }`} />
              
              <CardHeader className="pb-2 pt-5 px-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md w-fit">
                      {solicitud.type === 'herramienta' ? '🛠️ Herramienta' : '👷 Personal'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1">
                      {new Date(solicitud.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {getStatusBadge(solicitud.status)}
                </div>
                <CardTitle className="text-base font-extrabold text-slate-800 line-clamp-1 leading-snug group-hover:text-peie-blue transition-colors">
                  {solicitud.item_name}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="px-5 pb-5 pt-0 text-sm space-y-3.5">
                {/* Flujo origen/destino */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100/50">
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Origen</span>
                    <p className="text-xs font-bold text-slate-700 truncate mt-0.5">{solicitud.source_name || 'Almacén'}</p>
                  </div>
                  <div className="flex flex-col items-center px-3 justify-center">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-peie-blue/60" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Destino</span>
                    <p className="text-xs font-bold text-slate-700 truncate mt-0.5">{solicitud.target_name}</p>
                  </div>
                </div>

                {/* Detalles del pedido */}
                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/40 p-3 rounded-2xl border border-slate-100/30">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Solicitante:</span>
                    <span className="font-bold text-slate-700">{solicitud.requester_name}</span>
                  </div>
                  {solicitud.type === 'herramienta' && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Prioridad:</span>
                      <span className={`font-bold ${
                        solicitud.priority === 'Urgente' ? 'text-rose-600' :
                        solicitud.priority === 'Alta' ? 'text-amber-600' :
                        solicitud.priority === 'Normal' ? 'text-peie-blue' : 'text-slate-500'
                      }`}>{solicitud.priority}</span>
                    </div>
                  )}
                  {solicitud.assigned_name && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Trasportista:</span>
                      <span className="font-bold text-slate-700">{solicitud.assigned_name}</span>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="pt-1.5 flex justify-between gap-2.5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 rounded-xl h-10 border-emerald-100 text-emerald-600 hover:bg-emerald-50/50 hover:text-emerald-700 hover:border-emerald-200 font-bold text-xs shadow-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5" 
                    onClick={() => handleWhatsApp(solicitud)}
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-500" /> WhatsApp
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 rounded-xl h-10 border-slate-200/80 text-slate-700 hover:bg-slate-50 font-bold text-xs shadow-sm transition-all duration-200 active:scale-95"
                    onClick={() => navigate(solicitud.type === 'herramienta' ? '/solicitudes/' + solicitud.id : '/personal/traslados/' + solicitud.id)}
                  >
                    Ver Detalles
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {visibleCount < finalFiltered.length && (
            <div className="col-span-full pt-2">
              <Button 
                variant="ghost" 
                className="w-full py-6 text-peie-blue hover:bg-peie-blue/5 font-bold rounded-2xl hover:text-peie-blue/90 border border-dashed border-slate-200/80 bg-white shadow-sm"
                onClick={() => setVisibleCount(prev => prev + 6)}
              >
                Ver más pedidos ({finalFiltered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
          
          {finalFiltered.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white rounded-[24px] border border-dashed border-slate-200 shadow-sm flex flex-col items-center justify-center">
              <FileText className="h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">No se encontraron solicitudes</h3>
              <p className="text-xs text-slate-400 mt-1">Prueba cambiando los filtros o la búsqueda.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
