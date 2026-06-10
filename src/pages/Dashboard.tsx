import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Wrench, 
  MapPin, 
  QrCode, 
  Users, 
  ChevronRight, 
  FileText, 
  HardHat, 
  Bell, 
  Truck, 
  Building,
  Search,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { toast } = useToast();

  const [counts, setCounts] = useState({
    pendingTools: 0,
    pendingPersonal: 0,
    activeMovements: 0
  });

  const [stats, setStats] = useState({
    activeRequests: 0,
    availableTools: 0,
    inTransit: 0,
    activeSites: 0
  });

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isEncargado = profile?.role === 'encargado' || profile?.role === 'solicitante';
  const totalNotifications = counts.pendingTools + counts.pendingPersonal;

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);

        // Fetch counts in parallel
        const [
          { count: toolsPending, error: toolsPendingError },
          { count: personalPending, error: personalPendingError },
          { count: toolsTransit, error: toolsTransitError },
          { count: toolsAsignada, error: toolsAsignadaError },
          { count: availTools, error: availToolsError },
          { count: activeObras, error: activeObrasError }
        ] = await Promise.all([
          // Pending tools
          supabase.from('solicitudes').select('id', { count: 'exact', head: true }).eq('status', 'Pendiente'),
          // Personal transfers pending
          supabase.from('traslados_personal').select('id', { count: 'exact', head: true }).eq('status', 'Pendiente'),
          // Tools in transit
          supabase.from('solicitudes').select('id', { count: 'exact', head: true }).in('status', ['En retiro', 'En traslado']),
          // Tools assigned
          supabase.from('solicitudes').select('id', { count: 'exact', head: true }).eq('status', 'Asignada'),
          // Available tools
          supabase.from('herramientas').select('id', { count: 'exact', head: true }).eq('status', 'Disponible'),
          // Active sites
          supabase.from('obras').select('id', { count: 'exact', head: true }).eq('active', true),
        ]);

        if (toolsPendingError) throw toolsPendingError;
        if (personalPendingError) throw personalPendingError;
        if (toolsTransitError) throw toolsTransitError;
        if (toolsAsignadaError) throw toolsAsignadaError;
        if (availToolsError) throw availToolsError;
        if (activeObrasError) throw activeObrasError;

        // Mobile counts
        const pTools = toolsPending || 0;
        const pPersonal = personalPending || 0;
        const aTools = (toolsAsignada || 0) + (toolsTransit || 0);

        setCounts({
          pendingTools: pTools,
          pendingPersonal: pPersonal,
          activeMovements: aTools + pPersonal
        });

        // Desktop stats
        const activeRequestsCount = pTools + (toolsAsignada || 0) + (toolsTransit || 0) + pPersonal;

        setStats({
          activeRequests: activeRequestsCount,
          availableTools: availTools || 0,
          inTransit: toolsTransit || 0,
          activeSites: activeObras || 0
        });

        // Fetch recent activities
        const [
          { data: movementsData },
          { data: personalTransfersData },
          { data: newObrasData }
        ] = await Promise.all([
          supabase
            .from('movimientos')
            .select(`
              id,
              action,
              notes,
              created_at,
              herramientas(name, code),
              profiles(full_name)
            `)
            .order('created_at', { ascending: false })
            .limit(4),
          supabase
            .from('traslados_personal')
            .select(`
              id,
              status,
              created_at,
              empleados(full_name),
              target_obra:obras!traslados_personal_target_obra_id_fkey(name)
            `)
            .order('created_at', { ascending: false })
            .limit(4),
          supabase
            .from('obras')
            .select('id, name, created_at')
            .order('created_at', { ascending: false })
            .limit(4)
        ]);

        const unifiedActivities: any[] = [];

        if (movementsData) {
          movementsData.forEach((m: any) => {
            const isDelivery = m.action.toLowerCase().includes('entreg') || m.action.toLowerCase().includes('recib');
            const isTransit = m.action.toLowerCase().includes('traslad') || m.action.toLowerCase().includes('envi') || m.action.toLowerCase().includes('transporte');
            
            unifiedActivities.push({
              id: m.id,
              type: 'herramienta',
              title: isDelivery ? 'Herramienta entregada' : isTransit ? 'Transporte programado' : m.action,
              subtitle: `${m.herramientas?.name || 'Herramienta'} - ${m.herramientas?.code || ''}`,
              created_at: m.created_at,
              icon: isTransit ? 'truck' : 'wrench',
              color: isDelivery ? 'green' : isTransit ? 'purple' : 'blue'
            });
          });
        }

        if (personalTransfersData) {
          personalTransfersData.forEach((p: any) => {
            unifiedActivities.push({
              id: p.id,
              type: 'personal',
              title: p.status === 'Confirmado' ? 'Traslado de personal completado' : 'Nuevo pedido de personal aprobado',
              subtitle: `Obra: ${p.target_obra?.name || 'Sin obra'}`,
              created_at: p.created_at,
              icon: 'users',
              color: 'blue'
            });
          });
        }

        if (newObrasData) {
          newObrasData.forEach((o: any) => {
            unifiedActivities.push({
              id: o.id,
              type: 'obra',
              title: 'Nueva obra registrada',
              subtitle: o.name,
              created_at: o.created_at,
              icon: 'building',
              color: 'orange'
            });
          });
        }

        const sorted = unifiedActivities
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 4);

        const mockFallback = [
          {
            id: 'mock-1',
            type: 'personal',
            title: 'Nuevo pedido de personal aprobado',
            subtitle: 'Obra: Torre Central',
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            icon: 'users',
            color: 'blue'
          },
          {
            id: 'mock-2',
            type: 'herramienta',
            title: 'Herramienta entregada',
            subtitle: 'Taladro Percutor - OB-125',
            created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            icon: 'wrench',
            color: 'green'
          },
          {
            id: 'mock-3',
            type: 'herramienta',
            title: 'Transporte programado',
            subtitle: 'Entrega a obra: Edificio Norte',
            created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            icon: 'truck',
            color: 'purple'
          },
          {
            id: 'mock-4',
            type: 'obra',
            title: 'Nueva obra registrada',
            subtitle: 'Condominio Vista Azul',
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            icon: 'building',
            color: 'orange'
          }
        ];

        setActivities(sorted.length > 0 ? sorted : mockFallback);

      } catch (error: any) {
        console.error('Error al obtener datos del dashboard:', error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const handleNotificationClick = () => {
    toast({
      title: "Notificaciones operativas",
      description: `Tienes ${counts.pendingTools} pedidos de herramientas y ${counts.pendingPersonal} de personal pendientes de aprobación.`,
    });
    navigate('/pedidos-herramientas');
  };

  // Helper para calcular el tiempo relativo en español
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `Hace ${Math.max(1, diffMins)} ${Math.max(1, diffMins) === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffHours < 24) {
      return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffDays === 1) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    }
  };

  // Helper para renderizar los iconos de actividad reciente
  const getActivityIcon = (iconName: string, color: string) => {
    let IconComponent = Wrench;
    if (iconName === 'users') IconComponent = Users;
    else if (iconName === 'truck') IconComponent = Truck;
    else if (iconName === 'building') IconComponent = Building;

    let colorClasses = 'bg-blue-50 text-blue-600';
    if (color === 'green') colorClasses = 'bg-green-50 text-green-600';
    else if (color === 'purple') colorClasses = 'bg-indigo-50 text-indigo-600';
    else if (color === 'orange') colorClasses = 'bg-orange-50 text-orange-600';

    return (
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colorClasses}`}>
        <IconComponent size={16} className="stroke-[2.5]" />
      </div>
    );
  };

  const userName = profile?.full_name?.split(' ')[0] || 'Usuario';

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-400 animate-pulse">Cargando panel de control...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-safe w-full mx-auto">
      
      {/* ========================================================================= */}
      {/* 1. DISPOSITIVOS MÓVILES (md:hidden block)                                 */}
      {/* ========================================================================= */}
      <div className="md:hidden block space-y-6 max-w-md mx-auto">
        
        {/* Barra de Notificaciones */}
        <Card 
          onClick={handleNotificationClick}
          className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all cursor-pointer rounded-[24px] p-4 flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Bell size={22} className="animate-wiggle" />
              {totalNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                  {totalNotifications}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-800 leading-tight">Notificación</span>
              <span className="text-xs text-slate-400 font-semibold mt-0.5">
                {totalNotifications > 0 
                  ? `Tienes ${totalNotifications} notificaciones nuevas` 
                  : 'No tienes notificaciones pendientes'}
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Card>

        {/* Menú Principal */}
        <div className="flex items-center justify-center gap-2 text-[11px] font-black text-blue-600 uppercase tracking-widest my-4">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          Menú Principal
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        </div>

        {/* Grid de Accesos Rápidos */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Pedido de Personal */}
          <Card 
            onClick={() => navigate('/pedidos-personal')}
            className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-95 duration-200"
          >
            <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
              <img 
                src="/img/card_personal.webp" 
                alt="Pedido de Personal" 
                className="w-full h-full object-cover"
              />
              {counts.pendingPersonal > 0 && (
                <span className="absolute top-3 left-3 bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {counts.pendingPersonal}
                </span>
              )}
            </div>
            <div className="p-4 flex flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <HardHat size={16} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-slate-800 tracking-tight leading-none uppercase">
                  Pedido Personal
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold leading-normal mt-2 line-clamp-2">
                Gestiona personal para tus obras.
              </p>
            </div>
            <div className="pb-3 flex justify-center text-blue-500">
              <ChevronRight size={16} className="stroke-[3] rotate-90" />
            </div>
          </Card>

          {/* Pedido de Herramienta */}
          <Card 
            onClick={() => navigate('/pedidos-herramientas')}
            className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-95 duration-200"
          >
            <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
              <img 
                src="/img/card_herramientas.webp" 
                alt="Pedido de Herramienta" 
                className="w-full h-full object-cover"
              />
              {counts.pendingTools > 0 && (
                <span className="absolute top-3 left-3 bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {counts.pendingTools}
                </span>
              )}
            </div>
            <div className="p-4 flex flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <Wrench size={16} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-slate-800 tracking-tight leading-none uppercase">
                  Pedido Herramienta
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold leading-normal mt-2 line-clamp-2">
                Solicita herramientas disponibles.
              </p>
            </div>
            <div className="pb-3 flex justify-center text-blue-500">
              <ChevronRight size={16} className="stroke-[3] rotate-90" />
            </div>
          </Card>

          {/* Tarjeta Logística */}
          <Card 
            onClick={() => navigate('/logistica')}
            className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-95 duration-200"
          >
            <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
              <img 
                src="/img/card_logistica.webp" 
                alt="Tarjeta Logística" 
                className="w-full h-full object-cover"
              />
              {counts.activeMovements > 0 && (
                <span className="absolute top-3 left-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {counts.activeMovements}
                </span>
              )}
            </div>
            <div className="p-4 flex flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <Truck size={16} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-slate-800 tracking-tight leading-none uppercase">
                  Logística
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold leading-normal mt-2 line-clamp-2">
                Entregas y traslados activos.
              </p>
            </div>
            <div className="pb-3 flex justify-center text-blue-500">
              <ChevronRight size={16} className="stroke-[3] rotate-90" />
            </div>
          </Card>

          {/* Mis Obras */}
          <Card 
            onClick={() => navigate('/mis-obras')}
            className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-95 duration-200"
          >
            <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
              <img 
                src="/img/card_obras.webp" 
                alt="Mis Obras" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 flex flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <Building size={16} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-slate-800 tracking-tight leading-none uppercase">
                  Mis Obras
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold leading-normal mt-2 line-clamp-2">
                Seguimiento de obras activas.
              </p>
            </div>
            <div className="pb-3 flex justify-center text-blue-500">
              <ChevronRight size={16} className="stroke-[3] rotate-90" />
            </div>
          </Card>

        </div>

        {/* Botón QR */}
        <Card 
          onClick={() => navigate('/herramientas/scanner')} 
          className="border-2 border-dashed border-blue-200 bg-blue-50/10 hover:border-blue-300 hover:bg-blue-50/20 shadow-none transition-all cursor-pointer active:scale-98 rounded-[24px] p-4 flex items-center justify-between group h-16 mt-4 w-full"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-orange-500 text-white rounded-xl">
              <QrCode size={18} className="stroke-[2.5]" />
            </div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Escanear Código QR
            </span>
          </div>
          <div className="text-blue-500 group-hover:translate-x-0.5 transition-transform">
            <ChevronRight size={18} className="stroke-[3]" />
          </div>
        </Card>

        {isEncargado && (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center mt-2 w-full">
            <p className="text-[11px] font-bold text-slate-500">¿Necesitas ayuda con un equipo o herramienta?</p>
            <button 
              onClick={() => navigate('/herramientas')}
              className="mt-1 text-[11px] font-black text-peie-blue underline decoration-peie-light underline-offset-2"
            >
              Consultar inventario general de herramientas
            </button>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 2. ESCRITORIO / PC (hidden md:block)                                      */}
      {/* ========================================================================= */}
      <div className="hidden md:block space-y-8">
        
        {/* Cabecera Superior (Notificaciones + Barra de búsqueda y Perfil) */}
        <div className="flex justify-between items-center gap-6">
          
          {/* Tarjeta de Notificaciones compacta */}
          <div 
            onClick={handleNotificationClick}
            className="bg-white rounded-2xl p-3 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-slate-100 flex items-center justify-between cursor-pointer w-full max-w-md group hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-600">
                <Bell size={18} className="text-slate-500" />
                {totalNotifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center border-2 border-white">
                    {totalNotifications}
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 leading-tight">Notificaciones</h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                  {totalNotifications > 0 
                    ? `Tienes ${totalNotifications} notificaciones nuevas` 
                    : 'No tienes notificaciones pendientes'}
                </p>
              </div>
            </div>
            <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>

          {/* Botones de acción y perfil del usuario */}
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-peie-blue hover:bg-slate-50 rounded-full transition-all" aria-label="Buscar">
              <Search size={20} />
            </button>
            <button className="p-2 text-slate-400 hover:text-peie-blue hover:bg-slate-50 rounded-full transition-all" aria-label="Ayuda">
              <HelpCircle size={20} />
            </button>
            
            {/* Avatar */}
            <div className="flex items-center gap-2 cursor-pointer bg-white border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:bg-slate-50 p-1.5 px-3 rounded-xl transition-all">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-bold text-slate-700 capitalize">{profile?.full_name?.split(' ')[0]}</span>
              <ChevronRight size={12} className="text-slate-400 rotate-90" />
            </div>
          </div>

        </div>

        {/* Banner de Bienvenida */}
        <div className="grid grid-cols-12 bg-gradient-to-r from-[#031530] via-[#041d44] to-[#0a326a] text-white rounded-[24px] overflow-hidden shadow-lg h-32 md:h-36 relative">
          <div className="col-span-7 p-6 md:p-8 flex flex-col justify-center max-w-lg z-10">
            <h2 className="text-xl md:text-2xl font-black tracking-tight leading-tight">
              ¡Bienvenido, {userName}!
            </h2>
            <p className="text-[10px] md:text-xs font-medium text-slate-300 leading-relaxed mt-1 md:mt-2">
              Gestiona tus pedidos, herramientas, obras y logística de forma rápida y eficiente.
            </p>
          </div>
          <div className="col-span-5 relative overflow-hidden h-full">
            <img 
              src="/img/card_personal.webp" 
              alt="Operarios" 
              className="w-full h-full object-cover select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#031530] via-transparent to-transparent" />
          </div>
        </div>

        {/* Accesos Rápidos */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">Accesos rápidos</h3>
          
          <div className="grid grid-cols-4 gap-6">
            
            {/* Card 1: Pedido de Personal */}
            <Card 
              onClick={() => navigate('/pedidos-personal')}
              className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:ring-1 hover:ring-blue-500/10 transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-98 duration-150"
            >
              <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
                <img 
                  src="/img/card_personal.webp" 
                  alt="Pedido de Personal" 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                />
                <div className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white shadow-md shadow-blue-600/20 z-10">
                  <Users size={16} className="stroke-[2.5]" />
                </div>
              </div>
              <div className="p-5 pt-6 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="text-xs font-black text-slate-800 tracking-tight leading-none uppercase">
                    Pedido de Personal
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-2.5 line-clamp-2">
                    Solicita y gestiona personal para tus obras.
                  </p>
                </div>
                <div className="flex justify-end text-blue-600 mt-4">
                  <ArrowRight size={16} className="stroke-[3] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Card>

            {/* Card 2: Pedido de Herramienta */}
            <Card 
              onClick={() => navigate('/pedidos-herramientas')}
              className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:ring-1 hover:ring-blue-500/10 transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-98 duration-150"
            >
              <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
                <img 
                  src="/img/card_herramientas.webp" 
                  alt="Pedido de Herramienta" 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                />
                <div className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white shadow-md shadow-blue-600/20 z-10">
                  <Wrench size={16} className="stroke-[2.5]" />
                </div>
              </div>
              <div className="p-5 pt-6 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="text-xs font-black text-slate-800 tracking-tight leading-none uppercase">
                    Pedido de Herramienta
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-2.5 line-clamp-2">
                    Solicita herramientas y equipos disponibles.
                  </p>
                </div>
                <div className="flex justify-end text-blue-600 mt-4">
                  <ArrowRight size={16} className="stroke-[3] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Card>

            {/* Card 3: Tarjeta Logística */}
            <Card 
              onClick={() => navigate('/logistica')}
              className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:ring-1 hover:ring-blue-500/10 transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-98 duration-150"
            >
              <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
                <img 
                  src="/img/card_logistica.webp" 
                  alt="Tarjeta Logística" 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                />
                <div className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white shadow-md shadow-blue-600/20 z-10">
                  <Truck size={16} className="stroke-[2.5]" />
                </div>
              </div>
              <div className="p-5 pt-6 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="text-xs font-black text-slate-800 tracking-tight leading-none uppercase">
                    Tarjeta Logística
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-2.5 line-clamp-2">
                    Gestiona transportes y logística de entregas.
                  </p>
                </div>
                <div className="flex justify-end text-blue-600 mt-4">
                  <ArrowRight size={16} className="stroke-[3] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Card>

            {/* Card 4: Mis Obras */}
            <Card 
              onClick={() => navigate('/mis-obras')}
              className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:ring-1 hover:ring-blue-500/10 transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-98 duration-150"
            >
              <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
                <img 
                  src="/img/card_obras.webp" 
                  alt="Mis Obras" 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                />
                <div className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white shadow-md shadow-blue-600/20 z-10">
                  <Building size={16} className="stroke-[2.5]" />
                </div>
              </div>
              <div className="p-5 pt-6 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="text-xs font-black text-slate-800 tracking-tight leading-none uppercase">
                    Mis Obras
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-2.5 line-clamp-2">
                    Supervisa y administra todas tus obras.
                  </p>
                </div>
                <div className="flex justify-end text-blue-600 mt-4">
                  <ArrowRight size={16} className="stroke-[3] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Card>

          </div>
        </div>

        {/* Fila Inferior (3 Columnas) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Columna 1: Resumen General */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">Resumen general</h3>
            
            <div className="grid grid-cols-2 gap-4">
              
              {/* Pedidos activos */}
              <Card 
                onClick={() => navigate('/pedidos-herramientas')}
                className="bg-white border-0 border-l-4 border-blue-500 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] transition-all cursor-pointer rounded-[20px] p-4 flex flex-col justify-between h-[126px] group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-2xl font-black text-slate-800 leading-none block">{stats.activeRequests}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mt-1 line-clamp-1">Pedidos activos</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 group-hover:translate-x-0.5 transition-transform mt-2">
                  Ver detalles
                  <ArrowRight size={10} className="stroke-[3]" />
                </div>
              </Card>

              {/* Herramientas disponibles */}
              <Card 
                onClick={() => navigate('/herramientas')}
                className="bg-white border-0 border-l-4 border-emerald-500 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] transition-all cursor-pointer rounded-[20px] p-4 flex flex-col justify-between h-[126px] group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Wrench size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-2xl font-black text-slate-800 leading-none block">{stats.availableTools}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mt-1 line-clamp-1">Herramientas disp.</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 group-hover:translate-x-0.5 transition-transform mt-2">
                  Ver detalles
                  <ArrowRight size={10} className="stroke-[3]" />
                </div>
              </Card>

              {/* Entregas en tránsito */}
              <Card 
                onClick={() => navigate('/logistica')}
                className="bg-white border-0 border-l-4 border-indigo-500 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] transition-all cursor-pointer rounded-[20px] p-4 flex flex-col justify-between h-[126px] group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Truck size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-2xl font-black text-slate-800 leading-none block">{stats.inTransit}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mt-1 line-clamp-1">En tránsito</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 group-hover:translate-x-0.5 transition-transform mt-2">
                  Ver detalles
                  <ArrowRight size={10} className="stroke-[3]" />
                </div>
              </Card>

              {/* Obras activas */}
              <Card 
                onClick={() => navigate('/mis-obras')}
                className="bg-white border-0 border-l-4 border-orange-500 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] transition-all cursor-pointer rounded-[20px] p-4 flex flex-col justify-between h-[126px] group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <Building size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-2xl font-black text-slate-800 leading-none block">{stats.activeSites}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mt-1 line-clamp-1">Obras activas</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 group-hover:translate-x-0.5 transition-transform mt-2">
                  Ver detalles
                  <ArrowRight size={10} className="stroke-[3]" />
                </div>
              </Card>

            </div>
          </div>

          {/* Columna 2: Actividad Reciente */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">Actividad reciente</h3>
              <span 
                onClick={() => navigate('/logistica')}
                className="text-[10px] font-black text-blue-600 hover:underline cursor-pointer transition-all"
              >
                Ver todas
              </span>
            </div>
            
            <Card className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] rounded-[24px] p-5 h-[268px] flex flex-col justify-between">
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-b-0 last:pb-0 first:pt-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {getActivityIcon(activity.icon, activity.color)}
                      <div className="min-w-0">
                        <h4 className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[160px]">{activity.title}</h4>
                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate max-w-[160px]">{activity.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">{formatTimeAgo(activity.created_at)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Columna 3: Escanear código QR */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">Escanear código QR</h3>
            
            <Card className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] rounded-[24px] overflow-hidden flex flex-col justify-between h-[268px]">
              <div className="relative w-full h-[120px] bg-slate-100 overflow-hidden select-none">
                <img 
                  src="/img/card_qr_scan.webp" 
                  alt="Escanear QR" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 pt-1 flex flex-col justify-between flex-1">
                <p className="text-[10px] text-slate-400 font-semibold text-center leading-relaxed">
                  Escanea para registrar herramientas, entregas y más.
                </p>
                <button 
                  onClick={() => navigate('/herramientas/scanner')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-600/10 active:scale-95 duration-150 transition-all mt-2"
                >
                  <QrCode size={14} className="stroke-[2.5]" />
                  Abrir escáner
                </button>
              </div>
            </Card>
          </div>

        </div>

        {/* Footer */}
        <footer className="text-center pt-8 pb-4 text-[10px] font-bold text-slate-400">
          PEIE Trasabilidad Activa © 2026
        </footer>

      </div>

    </div>
  );
}
