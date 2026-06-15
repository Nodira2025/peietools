import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../store/auth';
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
  ChevronRight
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
          profiles!solicitudes_requester_id_fkey(full_name),
          herramientas!solicitudes_herramienta_id_fkey(name, code),
          target_obra:obras!solicitudes_target_obra_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (toolsError) throw toolsError;

      // 2. Cargar solicitudes de personal
      const { data: personalData, error: personalError } = await supabase
        .from('traslados_personal')
        .select(`
          id, requester_id, source_obra_id, target_obra_id, status, created_at,
          empleados!traslados_personal_empleado_id_fkey(full_name),
          source_obra:obras!traslados_personal_source_obra_id_fkey(name, encargado_name),
          target_obra:obras!traslados_personal_target_obra_id_fkey(name, encargado_name),
          requester:profiles!traslados_personal_requester_id_fkey(full_name)
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

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-8 h-8 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin mx-auto mb-3" />
          Cargando notificaciones privadas...
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
          <TabsList className="bg-slate-100/80 p-1 rounded-2xl w-full grid grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="tools" className="rounded-xl py-2.5 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-peie-blue data-[state=active]:shadow-sm">
              <Wrench className="w-3.5 h-3.5 mr-1.5" /> Herramientas ({toolsNotifications.length})
            </TabsTrigger>
            <TabsTrigger value="personal" className="rounded-xl py-2.5 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-peie-blue data-[state=active]:shadow-sm">
              <HardHat className="w-3.5 h-3.5 mr-1.5" /> Personal ({personalNotifications.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB: HERRAMIENTAS */}
          <TabsContent value="tools" className="space-y-3 pt-2">
            {toolsNotifications.map((s) => (
              <Card 
                key={s.id} 
                className="group border border-slate-100 hover:border-peie-blue/10 hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => navigate(`/solicitudes/${s.id}`)}
              >
                <CardContent className="p-4 flex gap-4 items-center">
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

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-peie-blue transition-colors" />
                </CardContent>
              </Card>
            ))}

            {toolsNotifications.length === 0 && (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 max-w-md mx-auto">
                <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <h3 className="text-sm font-bold text-slate-700">Sin notificaciones de herramientas</h3>
                <p className="text-xs text-slate-400 mt-1">No tienes traslados de herramientas pendientes o recientes.</p>
              </div>
            )}
          </TabsContent>

          {/* TAB: PERSONAL */}
          <TabsContent value="personal" className="space-y-3 pt-2">
            {personalNotifications.map((p) => (
              <Card 
                key={p.id} 
                className="group border border-slate-100 hover:border-peie-blue/10 hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => navigate(`/personal/traslados/${p.id}`)}
              >
                <CardContent className="p-4 flex gap-4 items-center">
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

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-peie-blue transition-colors" />
                </CardContent>
              </Card>
            ))}

            {personalNotifications.length === 0 && (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 max-w-md mx-auto">
                <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <h3 className="text-sm font-bold text-slate-700">Sin notificaciones de personal</h3>
                <p className="text-xs text-slate-400 mt-1">No tienes traslados de personal pendientes o recientes.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
