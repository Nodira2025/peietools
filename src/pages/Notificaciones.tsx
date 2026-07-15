import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../store/auth';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { WhatsAppPreviewModal } from '../components/WhatsAppPreviewModal';
import { buildWhatsAppLink } from '../lib/whatsapp';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Truck, 
  User, 
  Wrench, 
  HardHat,
  ArrowRight,
  MapPin,
  ChevronRight,
  Search,
  Filter
} from 'lucide-react';

interface NotificacionHerramienta {
  id: string;
  requester_id: string;
  assigned_to: string | null;
  priority: string;
  status: string;
  created_at: string;
  comments: string | null;
  security_code: string | null;
  profiles: { full_name: string } | null;
  herramientas: { name: string; code: string } | null;
  target_obra: { name: string } | null;
}

interface NotificacionPersonal {
  id: string;
  requester_id: string;
  source_obra_id: string | null;
  target_obra_id: string;
  status: string;
  created_at: string;
  empleados: { full_name: string } | null;
  source_obra: { name: string; encargado_name: string | null } | null;
  target_obra: { name: string; encargado_name: string | null } | null;
  requester: { full_name: string } | null;
}

export default function Notificaciones() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tools' | 'personal'>('tools');
  const [toolsNotifications, setToolsNotifications] = useState<NotificacionHerramienta[]>([]);
  const [personalNotifications, setPersonalNotifications] = useState<NotificacionPersonal[]>([]);

  // Local storage helpers to track whatsapp notifications sent
  const getWhatsappSentList = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem('whatsapp_sent_notifications') || '[]');
    } catch {
      return [];
    }
  };

  const markWhatsappAsSent = (id: string) => {
    try {
      const list = getWhatsappSentList();
      if (!list.includes(id)) {
        list.push(id);
        localStorage.setItem('whatsapp_sent_notifications', JSON.stringify(list));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterWhatsapp, setFilterWhatsapp] = useState<'all' | 'pending' | 'sent'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // WhatsApp Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPhone, setPreviewPhone] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [previewNotificationId, setPreviewNotificationId] = useState<string | null>(null);
  const [previewRecipientName, setPreviewRecipientName] = useState<string>('');

  const handleOpenWhatsappPreview = (item: any, type: 'tools' | 'personal') => {
    let phone = '';
    let message = '';
    let recipientName = '';
    
    if (type === 'tools') {
      phone = item.profiles?.whatsapp || '';
      recipientName = item.profiles?.full_name || 'Solicitante';
      message = `*Aviso de PEIE Tools - Traslado de Herramienta*\n` +
                `Hola, te notificamos sobre la solicitud de la herramienta *${item.herramientas?.name}* (Código: ${item.herramientas?.code || '-'}).\n` +
                `Estado: *${item.status}*\n` +
                `Destino: ${item.target_obra?.name || '-'}\n` +
                `Solicitado por: ${item.profiles?.full_name || '-'}`;
    } else {
      phone = item.requester?.whatsapp || item.empleados?.whatsapp || '';
      recipientName = item.requester?.full_name || 'Solicitante';
      message = `*Aviso de PEIE Tools - Traslado de Personal*\n` +
                `Hola, te notificamos sobre el traslado de *${item.empleados?.full_name || 'Personal'}*.\n` +
                `Origen: ${item.source_obra?.name || 'Sin obra'}\n` +
                `Destino: ${item.target_obra?.name || '-'}\n` +
                `Estado: *${item.status}*\n` +
                `Solicitado por: ${item.requester?.full_name || 'Admin'}`;
    }
    
    setPreviewPhone(phone);
    setPreviewMessage(message);
    setPreviewNotificationId(item.id);
    setPreviewRecipientName(recipientName);
    setIsPreviewOpen(true);
  };

  useEffect(() => {
    if (profile) {
      fetchNotifications();
    }
  }, [profile]);

  const fetchNotifications = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      // 1. Cargar solicitudes de herramientas
      const { data: toolsData, error: toolsError } = await supabase
        .from('solicitudes')
        .select(`
          id, requester_id, assigned_to, priority, status, created_at, comments, security_code,
          profiles!solicitudes_requester_id_fkey(full_name, whatsapp),
          herramientas!solicitudes_herramienta_id_fkey(name, code),
          target_obra:obras!solicitudes_target_obra_id_fkey(name, encargado_name)
        `)
        .order('created_at', { ascending: false });

      if (toolsError) throw toolsError;

      // 2. Cargar solicitudes de personal
      const { data: personalData, error: personalError } = await supabase
        .from('traslados_personal')
        .select(`
          id, requester_id, source_obra_id, target_obra_id, status, created_at,
          empleados!traslados_personal_empleado_id_fkey(full_name, whatsapp),
          source_obra:obras!traslados_personal_source_obra_id_fkey(name, encargado_name),
          target_obra:obras!traslados_personal_target_obra_id_fkey(name, encargado_name),
          requester:profiles!traslados_personal_requester_id_fkey(full_name, whatsapp)
        `)
        .order('created_at', { ascending: false });

      if (personalError) throw personalError;

      const isAdmin = profile.role?.toLowerCase() === 'admin';
      const userFullName = profile.full_name?.toLowerCase().trim() || '';

      // 3. Filtrar de forma privada por participación del usuario
      const filteredTools = (toolsData || []).filter((s: any) => {
        if (isAdmin) return true;
        
        // Es participante si es el solicitante o el asignado de logística
        return s.requester_id === profile.id || s.assigned_to === profile.id;
      });

      const filteredPersonal = (personalData || []).filter((t: any) => {
        if (isAdmin) return true;

        const isRequester = t.requester_id === profile.id;
        const isSourceManager = t.source_obra?.encargado_name && 
          t.source_obra.encargado_name.toLowerCase().trim() === userFullName;
        const isTargetManager = t.target_obra?.encargado_name && 
          t.target_obra.encargado_name.toLowerCase().trim() === userFullName;
        
        const isSourceObra = profile.obra_id === t.source_obra_id;
        const isTargetObra = profile.obra_id === t.target_obra_id;

        return isRequester || isSourceManager || isTargetManager || isSourceObra || isTargetObra;
      });

      setToolsNotifications(filteredTools as unknown as NotificacionHerramienta[]);
      setPersonalNotifications(filteredPersonal as unknown as NotificacionPersonal[]);

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error al cargar notificaciones', description: error.message });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pendiente': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200"><Clock className="w-3 h-3" /> PENDIENTE</span>;
      case 'Asignada': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200"><Clock className="w-3 h-3" /> ASIGNADA</span>;
      case 'En retiro': 
      case 'En traslado': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200"><Truck className="w-3 h-3 animate-pulse" /> EN CAMINO</span>;
      case 'Entregada': 
      case 'Confirmada': 
      case 'Confirmado':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200"><CheckCircle className="w-3 h-3" /> COMPLETADO</span>;
      case 'Cancelada':
      case 'Rechazada':
      case 'Rechazado':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200"><AlertCircle className="w-3 h-3" /> CANCELADO</span>;
      default: 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{status}</span>;
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch(priority) {
      case 'Urgente': return 'bg-red-500';
      case 'Alta': return 'bg-orange-500';
      default: return 'bg-blue-400';
    }
  };

  const filteredToolsNotifications = toolsNotifications.filter(item => {
    // 1. Matches Search
    const matchesSearch = !searchQuery || 
      (item.herramientas?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.herramientas?.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.target_obra?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Matches Status
    const matchesStatusVal = !filterStatus || (
      filterStatus === 'Pendiente' ? (item.status === 'Pendiente' || item.status === 'Asignada') :
      filterStatus === 'En camino' ? (item.status === 'En retiro' || item.status === 'En traslado') :
      filterStatus === 'Completado' ? (item.status === 'Entregada' || item.status === 'Confirmada' || item.status === 'Confirmado') :
      filterStatus === 'Cancelado' ? (item.status === 'Cancelada' || item.status === 'Rechazada' || item.status === 'Rechazado') :
      true
    );

    // 3. Matches Whatsapp
    const isSent = getWhatsappSentList().includes(item.id);
    const matchesWhatsappVal = filterWhatsapp === 'all' || 
      (filterWhatsapp === 'pending' ? !isSent : isSent);

    return matchesSearch && matchesStatusVal && matchesWhatsappVal;
  });

  const filteredPersonalNotifications = personalNotifications.filter(item => {
    // 1. Matches Search
    const matchesSearch = !searchQuery || 
      (item.empleados?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.source_obra?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.target_obra?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.requester?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Matches Status
    const matchesStatusVal = !filterStatus || (
      filterStatus === 'Pendiente' ? (item.status === 'Pendiente' || item.status === 'Asignada') :
      filterStatus === 'En camino' ? (item.status === 'En retiro' || item.status === 'En traslado') :
      filterStatus === 'Completado' ? (item.status === 'Entregada' || item.status === 'Confirmada' || item.status === 'Confirmado') :
      filterStatus === 'Cancelado' ? (item.status === 'Cancelada' || item.status === 'Rechazada' || item.status === 'Rechazado') :
      true
    );

    // 3. Matches Whatsapp
    const isSent = getWhatsappSentList().includes(item.id);
    const matchesWhatsappVal = filterWhatsapp === 'all' || 
      (filterWhatsapp === 'pending' ? !isSent : isSent);

    return matchesSearch && matchesStatusVal && matchesWhatsappVal;
  });

  return (
    <div className="space-y-6 pb-safe max-w-4xl mx-auto">
      
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-peie-blue/10 text-peie-blue rounded-2xl shadow-inner">
          <Bell className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-peie-blue leading-none">Centro de Notificaciones</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Revisá el estado y las solicitudes de traslado en las que estás involucrado.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por operario, herramienta, obra..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 rounded-xl border-slate-200 focus-visible:ring-peie-blue bg-white text-slate-800"
          />
        </div>

        {/* Selector de Estado */}
        <select 
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none"
        >
          <option value="">Estado: Todos</option>
          <option value="Pendiente">Pendiente</option>
          <option value="En camino">En camino</option>
          <option value="Completado">Completado</option>
          <option value="Cancelado">Cancelado</option>
        </select>

        {/* Selector de WhatsApp */}
        <select 
          value={filterWhatsapp}
          onChange={e => setFilterWhatsapp(e.target.value as any)}
          className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none"
        >
          <option value="all">WhatsApp: Todos</option>
          <option value="pending">WhatsApp: Pendientes</option>
          <option value="sent">WhatsApp: Notificados</option>
        </select>

        {(searchQuery || filterStatus || filterWhatsapp !== 'all') && (
          <button 
            onClick={() => { setSearchQuery(''); setFilterStatus(''); setFilterWhatsapp('all'); }}
            className="text-xs text-rose-500 font-black hover:underline shrink-0 px-2"
          >
            × Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-8 h-8 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin mx-auto mb-3" />
          Cargando notificaciones privadas...
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
          <TabsList className="bg-slate-100/80 p-1 rounded-2xl w-full grid grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="tools" className="rounded-xl py-2.5 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-peie-blue data-[state=active]:shadow-sm">
              <Wrench className="w-3.5 h-3.5 mr-1.5" /> Herramientas ({filteredToolsNotifications.length})
            </TabsTrigger>
            <TabsTrigger value="personal" className="rounded-xl py-2.5 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-peie-blue data-[state=active]:shadow-sm">
              <HardHat className="w-3.5 h-3.5 mr-1.5" /> Personal ({filteredPersonalNotifications.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB: HERRAMIENTAS */}
          <TabsContent value="tools" className="space-y-3 pt-2">
            {filteredToolsNotifications.map((s) => (
              <Card 
                key={s.id} 
                className="group border border-slate-100 hover:border-peie-blue/10 hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => navigate(`/solicitudes/${s.id}`, { state: { from: '/notificaciones' } })}
              >
                <CardContent className="p-4 flex gap-4 items-center justify-between">
                  <div className="flex gap-4 items-center min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-peie-blue/5 group-hover:text-peie-blue shrink-0 transition-colors">
                      <Wrench className="w-5 h-5" />
                    </div>
                    
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-sm font-bold text-slate-800 truncate group-hover:text-peie-blue transition-colors">
                          {s.herramientas?.name || 'Herramienta'}
                        </h4>
                        {getStatusBadge(s.status)}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>Cód: {s.herramientas?.code || '-'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${getPriorityStyle(s.priority)}`} /> Prioridad {s.priority}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-medium">
                        Solicitante: <span className="text-slate-800">{s.profiles?.full_name}</span> hacia <span className="text-slate-800 font-semibold">{s.target_obra?.name}</span>
                      </p>

                      <p className="text-[10px] text-slate-400 pt-0.5">
                        {new Date(s.created_at).toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 px-2.5 text-[10px] font-black rounded-xl flex items-center gap-1.5 border shadow-sm transition-all duration-200 ${
                        getWhatsappSentList().includes(s.id)
                          ? 'border-slate-100 text-slate-450 bg-slate-50 hover:bg-slate-100 hover:text-slate-600'
                          : 'border-emerald-200 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenWhatsappPreview(s, 'tools');
                      }}
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.09-3.846c1.62.963 3.426 1.47 5.278 1.471 5.516 0 10.01-4.498 10.014-10.02.002-2.673-1.04-5.187-2.936-7.086-1.897-1.9-4.411-2.946-7.083-2.947-5.525 0-10.02 4.5-10.024 10.022-.002 1.737.452 3.427 1.316 4.939l-1.002 3.66 3.737-.98zm11.378-7.79c-.3-.15-1.77-.874-2.045-.975-.276-.1-.476-.15-.676.15-.2.3-.775.975-.95 1.174-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.79-1.487-1.77-1.663-2.07-.175-.3-.019-.461.13-.61.135-.133.3-.349.45-.523.15-.174.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.676-1.625-.925-2.225-.244-.595-.513-.51-.676-.51-.162-.008-.349-.01-.536-.01-.187 0-.49.07-.747.349-.257.276-.98.958-.98 2.337s1.003 2.707 1.143 2.894c.14.188 1.974 3.014 4.782 4.228.668.288 1.19.46 1.597.59.672.214 1.28.184 1.762.11.536-.08 1.77-.724 2.02-1.388.25-.664.25-1.233.175-1.353-.075-.12-.275-.22-.575-.37z"/>
                      </svg>
                      <span>{getWhatsappSentList().includes(s.id) ? 'Reenviar' : 'Notificar'}</span>
                    </Button>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-peie-blue transition-colors animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredToolsNotifications.length === 0 && (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 max-w-md mx-auto">
                <Bell className="w-10 h-10 text-slate-350 mx-auto mb-2.5" />
                <h3 className="text-sm font-bold text-slate-700">Sin notificaciones de herramientas</h3>
                <p className="text-xs text-slate-400 mt-1">No se encontraron traslados de herramientas con los filtros seleccionados.</p>
              </div>
            )}
          </TabsContent>

          {/* TAB: PERSONAL */}
          <TabsContent value="personal" className="space-y-3 pt-2">
            {filteredPersonalNotifications.map((p) => (
              <Card 
                key={p.id} 
                className="group border border-slate-100 hover:border-peie-blue/10 hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => navigate(`/personal/traslados/${p.id}`, { state: { from: '/notificaciones' } })}
              >
                <CardContent className="p-4 flex gap-4 items-center justify-between">
                  <div className="flex gap-4 items-center min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-peie-blue/5 group-hover:text-peie-blue shrink-0 transition-colors">
                      <User className="w-5 h-5" />
                    </div>
                    
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-sm font-bold text-slate-800 truncate group-hover:text-peie-blue transition-colors">
                          {p.empleados?.full_name || 'Operario'}
                        </h4>
                        {getStatusBadge(p.status)}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <span className="truncate text-red-600">{p.source_obra?.name || 'Sin obra'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate text-green-600">{p.target_obra?.name}</span>
                      </div>

                      <p className="text-[10px] text-slate-400">
                        Solicitado por: <span className="font-semibold">{p.requester?.full_name || 'Admin'}</span>
                      </p>

                      <p className="text-[10px] text-slate-400 pt-0.5">
                        {new Date(p.created_at).toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-8 px-2.5 text-[10px] font-black rounded-xl flex items-center gap-1.5 border shadow-sm transition-all duration-200 ${
                        getWhatsappSentList().includes(p.id)
                          ? 'border-slate-100 text-slate-450 bg-slate-50 hover:bg-slate-100 hover:text-slate-600'
                          : 'border-emerald-200 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenWhatsappPreview(p, 'personal');
                      }}
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.09-3.846c1.62.963 3.426 1.47 5.278 1.471 5.516 0 10.01-4.498 10.014-10.02.002-2.673-1.04-5.187-2.936-7.086-1.897-1.9-4.411-2.946-7.083-2.947-5.525 0-10.02 4.5-10.024 10.022-.002 1.737.452 3.427 1.316 4.939l-1.002 3.66 3.737-.98zm11.378-7.79c-.3-.15-1.77-.874-2.045-.975-.276-.1-.476-.15-.676.15-.2.3-.775.975-.95 1.174-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.79-1.487-1.77-1.663-2.07-.175-.3-.019-.461.13-.61.135-.133.3-.349.45-.523.15-.174.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.676-1.625-.925-2.225-.244-.595-.513-.51-.676-.51-.162-.008-.349-.01-.536-.01-.187 0-.49.07-.747.349-.257.276-.98.958-.98 2.337s1.003 2.707 1.143 2.894c.14.188 1.974 3.014 4.782 4.228.668.288 1.19.46 1.597.59.672.214 1.28.184 1.762.11.536-.08 1.77-.724 2.02-1.388.25-.664.25-1.233.175-1.353-.075-.12-.275-.22-.575-.37z"/>
                      </svg>
                      <span>{getWhatsappSentList().includes(p.id) ? 'Reenviar' : 'Notificar'}</span>
                    </Button>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-peie-blue transition-colors animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredPersonalNotifications.length === 0 && (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 max-w-md mx-auto">
                <Bell className="w-10 h-10 text-slate-350 mx-auto mb-2.5" />
                <h3 className="text-sm font-bold text-slate-700">Sin notificaciones de personal</h3>
                <p className="text-xs text-slate-400 mt-1">No se encontraron traslados de personal con los filtros seleccionados.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Reusable WhatsApp Preview Modal */}
      <WhatsAppPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        phone={previewPhone}
        message={previewMessage}
        recipientName={previewRecipientName}
        onConfirm={(finalPhone, finalMessage) => {
          if (previewNotificationId) {
            markWhatsappAsSent(previewNotificationId);
          }
          toast({ title: 'Notificación registrada', description: 'Se marcó la notificación como enviada por WhatsApp.' });
        }}
      />
    </div>
  );
}
