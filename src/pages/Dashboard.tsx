import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Wrench, 
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
  ArrowRight,
  MessageCircle,
  LogOut,
  Info,
  ChevronDown,
  Camera,
  Plus,
  User,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VoiceInputButton from '../components/VoiceInputButton';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();
  const { toast } = useToast();

  const [deviceMode] = useState<'auto' | 'mobile' | 'desktop'>(() => {
    return (localStorage.getItem('login_device_mode') as any) || 'auto';
  });

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Modal para Reportar Tarea que excede a Logística
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [allProfiles, setAllProfiles] = useState<{id: string, full_name: string, role: string}[]>([]);
  const [reportPerson, setReportPerson] = useState('');
  const [reportTarea, setReportTarea] = useState('');
  const [reportMotivo, setReportMotivo] = useState('Se trata de una compra / alquiler especial que excede la logística habitual.');
  const [reportMotivoOtro, setReportMotivoOtro] = useState('');

  const mobileDashboardClass = deviceMode === 'mobile'
    ? 'block space-y-5 max-w-md mx-auto px-2'
    : deviceMode === 'desktop'
      ? 'hidden'
      : 'md:hidden block space-y-5 max-w-md mx-auto px-2';

  const pcDashboardClass = deviceMode === 'mobile'
    ? 'hidden'
    : deviceMode === 'desktop'
      ? 'block space-y-8'
      : 'hidden md:block space-y-8';

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


  const totalNotifications = counts.pendingTools + counts.pendingPersonal;

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);

        // Fetch data in parallel
        const [
          { data: toolsPendingData, error: toolsPendingError },
          { data: personalPendingData, error: personalPendingError },
          { data: toolsActiveData, error: toolsActiveError },
          { count: availTools, error: availToolsError },
          { data: activeObrasData, error: activeObrasError },
          { data: allToolsData, error: allToolsError },
          { data: allEmpsData, error: allEmpsError },
          { data: profilesData }
        ] = await Promise.all([
          // Pending tools
          supabase.from('solicitudes').select('id, requester_id, assigned_to').eq('status', 'Pendiente'),
          // Personal transfers pending
          supabase.from('traslados_personal').select(`
            id, requester_id, source_obra_id, target_obra_id,
            source_obra:obras!traslados_personal_source_obra_id_fkey(encargado_name),
            target_obra:obras!traslados_personal_target_obra_id_fkey(encargado_name)
          `).eq('status', 'Pendiente'),
          // Tools in transit or assigned
          supabase.from('solicitudes').select('id, requester_id, assigned_to, status').in('status', ['Asignada', 'En retiro', 'En traslado']),
          // Available tools
          supabase.from('herramientas').select('id', { count: 'exact', head: true }).eq('status', 'Disponible'),
          // Active sites in DB
          supabase.from('obras').select('id, encargado_name').eq('active', true),
          // All tools locations
          supabase.from('herramientas').select('current_obra_id'),
          // All employees locations
          supabase.from('empleados').select('obra_id'),
          // All active profiles for report selection
          supabase.from('profiles').select('id, full_name, role').eq('active', true).order('full_name')
        ]);

        if (profilesData) {
          setAllProfiles(profilesData);
        }

        if (toolsPendingError) throw toolsPendingError;
        if (personalPendingError) throw personalPendingError;
        if (toolsActiveError) throw toolsActiveError;
        if (availToolsError) throw availToolsError;
        if (activeObrasError) throw activeObrasError;
        if (allToolsError) throw allToolsError;
        if (allEmpsError) throw allEmpsError;

        const isAdmin = profile?.role?.toLowerCase() === 'admin';
        const userFullName = (profile?.full_name || '').toLowerCase().trim();

        // Filter pending tools
        const filteredPendingTools = (toolsPendingData || []).filter((s: any) => {
          if (isAdmin) return true;
          return s.requester_id === profile?.id || s.assigned_to === profile?.id;
        });

        // Filter pending personal
        const filteredPendingPersonal = (personalPendingData || []).filter((t: any) => {
          if (isAdmin) return true;
          const isRequester = t.requester_id === profile?.id;
          const isSourceManager = typeof t.source_obra?.encargado_name === 'string' && 
            t.source_obra.encargado_name.toLowerCase().trim() === userFullName;
          const isTargetManager = typeof t.target_obra?.encargado_name === 'string' && 
            t.target_obra.encargado_name.toLowerCase().trim() === userFullName;
          const isSourceObra = profile?.obra_id === t.source_obra_id;
          const isTargetObra = profile?.obra_id === t.target_obra_id;
          return isRequester || isSourceManager || isTargetManager || isSourceObra || isTargetObra;
        });

        // Filter active tools (in transit or assigned)
        const filteredActiveTools = (toolsActiveData || []).filter((s: any) => {
          if (isAdmin) return true;
          return s.requester_id === profile?.id || s.assigned_to === profile?.id;
        });

        // Mobile counts
        const pTools = filteredPendingTools.length;
        const pPersonal = filteredPendingPersonal.length;
        const aTools = filteredActiveTools.length;
        const transitToolsCount = filteredActiveTools.filter((s: any) => s.status !== 'Asignada').length;

        setCounts({
          pendingTools: pTools,
          pendingPersonal: pPersonal,
          activeMovements: aTools + pPersonal
        });

        // Mapear cuántas herramientas tiene cada obra
        const toolsMap = (allToolsData || []).reduce((acc: any, t: any) => {
          if (t.current_obra_id) acc[t.current_obra_id] = (acc[t.current_obra_id] || 0) + 1;
          return acc;
        }, {});

        // Mapear cuántos empleados tiene cada obra
        const empsMap = (allEmpsData || []).reduce((acc: any, e: any) => {
          if (e.obra_id) acc[e.obra_id] = (acc[e.obra_id] || 0) + 1;
          return acc;
        }, {});

        // Filtrar obras activas que tienen encargado, herramientas y personal
        const activeSitesCount = (activeObrasData || []).filter((o: any) => {
          const hasManager = o.encargado_name && o.encargado_name.trim() !== '';
          const hasTools = (toolsMap[o.id] || 0) > 0;
          const hasPersonnel = (empsMap[o.id] || 0) > 0;
          return hasManager && hasTools && hasPersonnel;
        }).length;

        // Desktop stats
        const activeRequestsCount = pTools + aTools + pPersonal;

        setStats({
          activeRequests: activeRequestsCount,
          availableTools: availTools || 0,
          inTransit: transitToolsCount || 0,
          activeSites: activeSitesCount
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

  const handleSendReport = () => {
    if (!reportPerson) {
      toast({ variant: 'destructive', title: 'Persona requerida', description: 'Por favor, seleccioná a la persona que te encomendó la tarea.' });
      return;
    }

    const personaObj = allProfiles.find(p => p.id === reportPerson);
    const personaNombre = personaObj ? `${personaObj.full_name} (${personaObj.role || 'Personal'})` : 'No especificado';
    const federicoPhone = '5493814015738';

    const motivoFinal = reportMotivo === 'Otro' ? (reportMotivoOtro.trim() || 'Otro motivo especificado por voz/texto') : reportMotivo;

    const waMsg = [
      '*⚠️ REPORTAR TAREA EXCEDIDA DE LOGÍSTICA*',
      '',
      `Hola *Federico*, me encomendaron una tarea que excede la logística habitual:`,
      '',
      `- *Persona que encomendó la tarea:* ${personaNombre}`,
      reportTarea.trim() ? `- *Tarea / Pedido solicitado:* ${reportTarea}` : '',
      `- *Motivo:* ${motivoFinal}`,
      `- *Reportado por:* ${profile?.full_name || 'Personal Logística'}`,
      `- *Fecha:* ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`,
      '',
      'Esta tarea se trata de una compra/alquiler o requerimiento especial que excede el alcance del área de logística.',
    ].filter(Boolean).join('\n');

    setIsReportOpen(false);
    setReportPerson('');
    setReportTarea('');
    setReportMotivoOtro('');

    toast({ title: 'Reporte Generado', description: 'Abriendo chat de WhatsApp con Federico Grande...' });
    setTimeout(() => {
      window.open(`https://wa.me/${federicoPhone}?text=${encodeURIComponent(waMsg)}`, '_blank');
    }, 400);
  };

  const userName = profile?.full_name?.split(' ')[0] || 'Usuario';
  const userRole = profile?.role?.toLowerCase();
  const isAdmin = userRole === 'admin';
  const isLogistica = userRole === 'logistica';
  const isCoordinador = !isAdmin && !isLogistica;

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
      <div className={mobileDashboardClass}>
        
        {/* Barra de Notificaciones */}
        <Card 
          onClick={handleNotificationClick}
          className="bg-white border-0 shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all cursor-pointer rounded-[24px] p-4 flex items-center justify-between group active:scale-[0.99] w-full"
        >
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Bell size={22} className="stroke-[2] text-white" />
              {totalNotifications > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                  {totalNotifications}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-[#031530] leading-tight">Notificación</span>
              <span className="text-xs text-slate-400 font-bold mt-0.5">
                {totalNotifications > 0 
                  ? `Tienes ${totalNotifications} notificaciones nuevas` 
                  : 'No tienes notificaciones nuevas'}
              </span>
            </div>
          </div>
        </Card>

        {/* 🚚 VISTA PARA LOGÍSTICA: TARJETA GIGANTE DE "PEDIDOS DE HERRAMIENTAS" PRIMERO */}
        {isLogistica && (
          <div 
            onClick={() => navigate('/logistica')}
            className="bg-gradient-to-br from-amber-500 via-orange-600 to-red-700 text-white rounded-[28px] p-6 shadow-[0_10px_30px_rgba(234,88,12,0.3)] hover:shadow-[0_12px_36px_rgba(234,88,12,0.4)] flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all duration-200 border border-white/20 relative overflow-hidden group space-y-4"
          >
            <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-lg border border-white/20">
                <Truck size={30} className="stroke-[2.5]" />
              </div>
              <span className="bg-white text-orange-700 text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1">
                <Bell size={12} className="animate-bounce" /> {counts.pendingTools} Pendientes
              </span>
            </div>

            <div className="space-y-1.5 relative z-10">
              <h3 className="text-xl font-black uppercase tracking-tight leading-tight text-white">
                Pedidos de Herramientas
              </h3>
              <p className="text-xs text-orange-100 font-semibold leading-relaxed">
                Revisá, asigná chofer y gestioná los traslados de herramientas entre obras.
              </p>
            </div>

            <Button
              type="button"
              className="w-full h-12 bg-white hover:bg-slate-100 text-orange-700 font-black rounded-2xl text-sm shadow-md flex items-center justify-center gap-2 mt-1"
            >
              <Truck size={18} /> Ver Pedidos de Herramientas <ChevronRight size={18} />
            </Button>
          </div>
        )}

        {/* 🏗️ VISTA PARA COORDINADORES / ENCARGADOS DE OBRA: TARJETA "PEDIR HERRAMIENTA" ESTÁNDAR */}
        {isCoordinador && (
          <div 
            onClick={() => navigate('/solicitudes/nueva')}
            className="bg-gradient-to-r from-peie-blue via-blue-700 to-indigo-800 text-white rounded-[24px] p-4 shadow-[0_6px_24px_rgba(8,26,99,0.22)] hover:shadow-[0_8px_30px_rgba(8,26,99,0.3)] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all duration-200 border border-white/10 relative overflow-hidden group"
          >
            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
            
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-inner border border-white/20">
                <Wrench size={24} className="stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider leading-none text-white">Pedir Herramienta</h3>
                  <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight shadow-sm">
                    Solicitar
                  </span>
                </div>
                <p className="text-[10px] text-blue-100 font-bold leading-tight">
                  Solicitá las herramientas que necesitás para tu obra en 1 minuto.
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 ml-2 relative z-10">
              <ChevronRight size={18} className="text-white" />
            </div>
          </div>
        )}

        {/* 👑 VISTA PARA ADMINS (SI NO ES COORDINADOR NI LOGÍSTICA) */}
        {isAdmin && (
          <div 
            onClick={() => navigate('/solicitudes/nueva')}
            className="bg-gradient-to-r from-peie-blue via-blue-700 to-indigo-800 text-white rounded-[24px] p-4 shadow-[0_6px_24px_rgba(8,26,99,0.22)] hover:shadow-[0_8px_30px_rgba(8,26,99,0.3)] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all duration-200 border border-white/10 relative overflow-hidden group"
          >
            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
            
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-inner border border-white/20">
                <Wrench size={24} className="stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider leading-none text-white">Pedir Herramienta</h3>
                  <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight shadow-sm">
                    Solicitar
                  </span>
                </div>
                <p className="text-[10px] text-blue-100 font-bold leading-tight">
                  Solicitá las herramientas que necesitás para tu obra en 1 minuto.
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 ml-2 relative z-10">
              <ChevronRight size={18} className="text-white" />
            </div>
          </div>
        )}

        {/* Tarjeta secundaria para mis pedidos (Coordinadores) */}
        {isCoordinador && (
          <div 
            onClick={() => navigate('/solicitudes')}
            className="bg-white border border-slate-200 rounded-[24px] p-4 shadow-sm hover:shadow-md flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-peie-blue flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Ver Mis Pedidos Solicitados</h4>
                <p className="text-[10px] text-slate-400 font-semibold">Consultá el estado del traslado de tus herramientas</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>
        )}

        {/* Acceso a Registrar Gasto de Logística (Admins y Logística) */}
        {(isAdmin || isLogistica) && (
          <div 
            onClick={() => navigate('/logistica?nuevoGasto=true')}
            className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-[24px] p-4 shadow-[0_4px_20px_rgba(16,185,129,0.12)] hover:shadow-[0_4px_20px_rgba(16,185,129,0.2)] flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                <DollarSign size={24} className="stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-wider leading-none">Registrar Gasto</h3>
                <p className="text-[10px] text-slate-100 font-bold leading-tight">Comprobantes y rendición con cuenta corriente por WhatsApp.</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-white shrink-0" />
          </div>
        )}

        {/* ⚠️ NUEVA TARJETA: Reportar Tarea Excedida a Federico (Logística y Admins) */}
        {(isAdmin || isLogistica) && (
          <div 
            onClick={() => setIsReportOpen(true)}
            className="bg-gradient-to-r from-rose-600 to-red-500 text-white rounded-[24px] p-4 shadow-[0_4px_20px_rgba(225,29,72,0.15)] hover:shadow-[0_4px_20px_rgba(225,29,72,0.25)] flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                <AlertTriangle size={24} className="stroke-[2.5] text-amber-300 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider leading-none">Reportar Tarea</h3>
                  <span className="bg-amber-300 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight shadow-sm">
                    Excede Logística
                  </span>
                </div>
                <p className="text-[10px] text-rose-100 font-bold leading-tight">Avisa por WhatsApp a Federico sobre compras/tareas especiales.</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-white shrink-0" />
          </div>
        )}

        {/* Buscador Visual (Admins y Logística) */}
        {(isAdmin || isLogistica) && (
          <div 
            onClick={() => navigate('/herramientas/busqueda-visual')}
            className="bg-gradient-to-r from-peie-blue to-peie-light text-white rounded-[24px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                <Camera size={24} className="stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-wider leading-none">Buscar Herramienta</h3>
                <p className="text-[10px] text-slate-100 font-bold leading-tight">Identificá, trasladá o reportá fallas de herramientas al instante.</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-white shrink-0" />
          </div>
        )}

        {/* Asistentes de Alta (Solo Admins) */}
        {isAdmin && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-4 my-1">
              <div className="h-[1px] bg-slate-200 flex-1" />
              <span className="text-[10px] font-black text-peie-blue uppercase tracking-widest whitespace-nowrap">Asistentes de Alta</span>
              <div className="h-[1px] bg-slate-200 flex-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Alta Herramienta Asistida */}
              <div 
                onClick={() => navigate('/herramientas/nueva')}
                className="bg-[#F3F6FD] border border-[#E2EAFD] rounded-[24px] p-4 flex flex-col justify-between cursor-pointer active:scale-[0.97] transition-all duration-200 min-h-[114px] shadow-sm shadow-[#081a63]/2"
              >
                <div className="w-10 h-10 rounded-2xl bg-peie-blue text-white flex items-center justify-center shadow-md shadow-peie-blue/15">
                  <Plus size={20} className="stroke-[3]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide">Alta Herramienta</h4>
                  <p className="text-[8px] text-slate-400 font-bold leading-tight">Asistente paso a paso</p>
                </div>
              </div>

              {/* Alta Personal Asistida */}
              <div 
                onClick={() => navigate('/personal/nuevo-asistido')}
                className="bg-[#FAF7FE] border border-[#F2EAFF] rounded-[24px] p-4 flex flex-col justify-between cursor-pointer active:scale-[0.97] transition-all duration-200 min-h-[114px] shadow-sm shadow-violet-600/2"
              >
                <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-600/15">
                  <User size={20} className="stroke-[3]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide">Alta Personal</h4>
                  <p className="text-[8px] text-slate-400 font-bold leading-tight">Asistente paso a paso</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 2. ESCRITORIO / PC (hidden md:block)                                      */}
      {/* ========================================================================= */}
      <div className={pcDashboardClass}>
        
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
            <button 
              onClick={() => navigate('/herramientas')}
              className="p-2 text-slate-400 hover:text-peie-blue hover:bg-slate-50 rounded-full transition-all" 
              aria-label="Buscar"
            >
              <Search size={20} />
            </button>
            <button 
              onClick={() => setIsHelpOpen(true)}
              className="p-2 text-slate-400 hover:text-peie-blue hover:bg-slate-50 rounded-full transition-all" 
              aria-label="Ayuda"
            >
              <HelpCircle size={20} />
            </button>
            
            {/* Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer bg-white border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:bg-slate-50 p-1.5 px-3 rounded-xl transition-all select-none">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs font-bold text-slate-700 capitalize">{profile?.full_name?.split(' ')[0]}</span>
                  <ChevronDown size={12} className="text-slate-400" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-100 shadow-xl rounded-xl p-1.5">
                <DropdownMenuLabel className="px-2.5 py-2 text-xs">
                  <p className="font-bold text-slate-800 truncate">{profile?.full_name || 'Usuario'}</p>
                  <p className="text-[10px] text-slate-400 capitalize mt-0.5">
                    {profile?.role === 'solicitante' ? 'Coordinador' : (profile?.role === 'logistica' ? 'Logística' : 'Administrador')}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100 my-1" />
                <DropdownMenuItem 
                  onClick={() => navigate('/mis-obras')}
                  className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-peie-blue hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  <Building size={14} />
                  <span>Mis Obras</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate('/herramientas')}
                  className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-peie-blue hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  <Wrench size={14} />
                  <span>Herramientas</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-100 my-1" />
                <DropdownMenuItem 
                  onClick={signOut}
                  className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                >
                  <LogOut size={14} />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

        {/* Acciones Principales (Prioridad 1) */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">Acciones Principales</h3>
          <div className="grid grid-cols-2 gap-6">
            
            {/* Buscar Herramienta */}
            <Card 
              onClick={() => navigate('/herramientas')}
              className="bg-white border border-slate-100 hover:border-indigo-500/20 shadow-[0_8px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all cursor-pointer rounded-[24px] p-6 flex items-center justify-between group active:scale-[0.99] duration-150 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
              <div className="flex items-center gap-5 z-10">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                  <Search size={24} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">Buscar Herramienta</h4>
                  <p className="text-xs text-slate-400 font-semibold mt-1">Consultar inventario general, disponibilidad y estado de herramientas</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-indigo-600 group-hover:translate-x-1 transition-transform z-10" />
            </Card>

            {/* Trasladar Personal */}
            <Card 
              onClick={() => navigate('/personal')}
              className="bg-white border border-slate-100 hover:border-emerald-500/20 shadow-[0_8px_30px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all cursor-pointer rounded-[24px] p-6 flex items-center justify-between group active:scale-[0.99] duration-150 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
              <div className="flex items-center gap-5 z-10">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <HardHat size={24} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Trasladar Personal</h4>
                  <p className="text-xs text-slate-400 font-semibold mt-1">Consultar operarios disponibles y gestionar el envío a tus obras</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-emerald-600 group-hover:translate-x-1 transition-transform z-10" />
            </Card>

          </div>
        </div>

        {/* Seguimiento e Historial */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">Seguimiento e Historial</h3>
          
          <div className="grid grid-cols-4 gap-6">
            
            {/* Card 1: Movimiento de Personal */}
            <Card 
              onClick={() => navigate('/pedidos-personal')}
              className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:ring-1 hover:ring-blue-500/10 transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-98 duration-150"
            >
              <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
                <img 
                  src="/img/card_personal.webp" 
                  alt="Movimiento de Personal" 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                />
                <div className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white shadow-md shadow-blue-600/20 z-10">
                  <HardHat size={16} className="stroke-[2.5]" />
                </div>
                {counts.pendingPersonal > 0 && (
                  <span className="absolute top-3 right-3 bg-rose-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow z-20">
                    {counts.pendingPersonal}
                  </span>
                )}
              </div>
              <div className="p-5 pt-6 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="text-xs font-black text-slate-800 tracking-tight leading-none uppercase">
                    Movimiento de Personal
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-2.5 line-clamp-2">
                    Visualiza y gestiona traslados de personal activos o históricos.
                  </p>
                </div>
                <div className="flex justify-end text-blue-600 mt-4">
                  <ArrowRight size={16} className="stroke-[3] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Card>

            {/* Card 2: Movimiento de Herramientas */}
            <Card 
              onClick={() => navigate('/pedidos-herramientas')}
              className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:ring-1 hover:ring-blue-500/10 transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-98 duration-150"
            >
              <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
                <img 
                  src="/img/card_herramientas.webp" 
                  alt="Movimiento de Herramientas" 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                />
                <div className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white shadow-md shadow-blue-600/20 z-10">
                  <Wrench size={16} className="stroke-[2.5]" />
                </div>
                {counts.pendingTools > 0 && (
                  <span className="absolute top-3 right-3 bg-rose-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow z-20">
                    {counts.pendingTools}
                  </span>
                )}
              </div>
              <div className="p-5 pt-6 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="text-xs font-black text-slate-800 tracking-tight leading-none uppercase">
                    Movimiento de Herramientas
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-2.5 line-clamp-2">
                    Visualiza y gestiona solicitudes de traslado de herramientas.
                  </p>
                </div>
                <div className="flex justify-end text-blue-600 mt-4">
                  <ArrowRight size={16} className="stroke-[3] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Card>

            {/* Card 3: Logística */}
            <Card 
              onClick={() => navigate('/logistica')}
              className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:ring-1 hover:ring-blue-500/10 transition-all cursor-pointer rounded-[24px] overflow-hidden flex flex-col justify-between group active:scale-98 duration-150"
            >
              <div className="relative w-full h-32 bg-slate-100 overflow-hidden">
                <img 
                  src="/img/card_logistica.webp" 
                  alt="Logística" 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                />
                <div className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white shadow-md shadow-blue-600/20 z-10">
                  <Truck size={16} className="stroke-[2.5]" />
                </div>
                {counts.activeMovements > 0 && (
                  <span className="absolute top-3 right-3 bg-rose-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow z-20">
                    {counts.activeMovements}
                  </span>
                )}
              </div>
              <div className="p-5 pt-6 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="text-xs font-black text-slate-800 tracking-tight leading-none uppercase">
                    Logística
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-2.5 line-clamp-2">
                    Gestiona transportes y logística de entregas en mapa.
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
                {stats.activeSites > 0 && (
                  <span className="absolute top-3 right-3 bg-rose-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow z-20">
                    {stats.activeSites}
                  </span>
                )}
              </div>
              <div className="p-5 pt-6 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="text-xs font-black text-slate-800 tracking-tight leading-none uppercase">
                    Mis Obras
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-2.5 line-clamp-2">
                    Supervisa y administra herramientas y personal en tus obras.
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

          {/* Columna 3: Acciones Rápidas */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">Acciones rápidas</h3>
            
            <Card className="bg-white border-0 shadow-[0_8px_30px_rgba(0,0,0,0.02)] rounded-[24px] p-5 h-[268px] flex flex-col justify-between">
              <div className="space-y-3">
                {/* QR Scanner */}
                <div 
                  onClick={() => navigate('/herramientas/scanner')}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <QrCode size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 leading-tight">Escanear Código QR</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Asignar o devolver herramientas</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>

                {/* Barcode Scanner */}
                <div 
                  onClick={() => {
                    toast({ title: "Lector de código de barras", description: "Apunta al código de barras de la herramienta." });
                    navigate('/herramientas/scanner');
                  }}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0 group-hover:bg-green-600 group-hover:text-white transition-all">
                      <FileText size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 leading-tight">Código de Barras</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Búsqueda rápida de inventario</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>

                {/* WhatsApp Support */}
                <a 
                  href="https://wa.me/5493814015738?text=Hola,%20necesito%20soporte%20desde%20PEIE%20Tools"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <MessageCircle size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 leading-tight">Conectar por WhatsApp</h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Soporte y consultas de logística</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </Card>
          </div>

        </div>

        {/* Footer */}
        <footer className="text-center pt-8 pb-4 text-[10px] font-bold text-slate-400">
          PEIE Trasabilidad Activa © 2026
        </footer>

      </div>

      {/* Modal de Ayuda y Guía de PEIE Tools */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="rounded-3xl w-[95%] max-w-md bg-white border-slate-100 shadow-xl overflow-hidden p-0">
          <div className="bg-gradient-to-r from-[#031530] to-[#042454] text-white p-5 pb-6 relative">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-sky-400" />
                <span>Ayuda y Soporte</span>
              </DialogTitle>
              <p className="text-slate-350 text-xs font-semibold">Guía de uso y contacto directo</p>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-5">
            {/* Guía Rápida */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                Guía Rápida de PEIE Tools
              </h4>
              <ul className="text-xs text-slate-650 space-y-2 list-disc list-inside pl-1 font-medium">
                <li>
                  <strong className="text-slate-800">Búsqueda de Herramientas:</strong> Usa el icono de lupa del header o haz clic en "Buscar Herramienta" para consultar el stock, disponibilidad y estado.
                </li>
                <li>
                  <strong className="text-slate-800">Lectores QR y de Barras:</strong> Utiliza la cámara de tu celular para escanear y registrar traslados rápidos sin tipear códigos manualmente.
                </li>
                <li>
                  <strong className="text-slate-800">Modo Sin Conexión (PWA):</strong> Si te quedas sin señal en la obra, la app guarda datos clave en caché para que puedas seguir consultando.
                </li>
              </ul>
            </div>

            <DropdownMenuSeparator className="bg-slate-100" />

            {/* Soporte Técnico */}
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Soporte Técnico Directo</h4>
                <p className="text-[11px] text-slate-450 font-medium mt-1">¿Tienes dudas o necesitas reportar una falla? Comunicate directamente por WhatsApp:</p>
              </div>

              <div className="flex flex-col gap-2">
                <a 
                  href="https://wa.me/5493814015738"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100/50 rounded-2xl cursor-pointer transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <MessageCircle size={16} className="stroke-[2.5]" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-800">Federico Grande</p>
                      <p className="text-[10px] text-emerald-600 font-bold">Administrador General</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end rounded-b-3xl">
            <Button 
              onClick={() => setIsHelpOpen(false)}
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold text-xs px-5 shadow-md shadow-blue-600/10"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Reportar Tarea que excede a Logística */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="rounded-3xl w-[92%] max-w-md bg-white border-slate-100 shadow-xl overflow-hidden p-0">
          <div className="bg-gradient-to-r from-rose-700 to-red-600 text-white p-5 relative">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-amber-300 animate-bounce" />
                <span>Reportar Tarea a Federico</span>
              </DialogTitle>
              <DialogDescription className="text-rose-100 text-xs font-semibold">
                Aviso automático por WhatsApp para tareas o compras que exceden la logística.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Persona que encomendó la tarea *
              </label>
              <select 
                value={reportPerson}
                onChange={e => setReportPerson(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Seleccionar persona...</option>
                {allProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role || 'Usuario'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Tarea / Pedido solicitado (Opcional)</span>
                <span className="text-[10px] text-peie-blue font-semibold">🎙️ Podés dictar</span>
              </label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Ej: Comprar grupo electrógeno 10 KVA / Alquilar bobcat"
                  value={reportTarea}
                  onChange={e => setReportTarea(e.target.value)}
                  className="rounded-xl h-11 flex-1"
                />
                <VoiceInputButton 
                  onTranscript={t => setReportTarea(prev => prev ? `${prev} ${t}` : t)}
                  className="h-11 w-11 rounded-xl shrink-0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Motivo del reporte
              </label>
              <select 
                value={reportMotivo}
                onChange={e => setReportMotivo(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-rose-500"
              >
                <option value="Se trata de una compra / alquiler especial que excede la logística habitual.">
                  Se trata de una compra / alquiler especial (excede logística)
                </option>
                <option value="No hay vehículo ni chofer disponible para este tipo de traslado pesado.">
                  No hay vehículo / chofer adecuado disponible
                </option>
                <option value="Requiere aprobación previa o fondos de caja chica de gerencia.">
                  Requiere aprobación / fondos de gerencia
                </option>
                <option value="Herramienta en uso crítico en obra, requiere negociación especial.">
                  Herramienta en uso crítico, requiere negociación directa
                </option>
                <option value="Otro">
                  Otro motivo (Escribir o dictar con voz)
                </option>
              </select>

              {reportMotivo === 'Otro' && (
                <div className="pt-1.5 space-y-1 animate-fadeIn">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>Escribí o dictá el motivo personalizado:</span>
                    <span className="text-[10px] text-peie-blue font-semibold">🎙️ Dictar</span>
                  </label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Ej: El proveedor no entrega en obra y requiere retirarse en Famaillá..."
                      value={reportMotivoOtro}
                      onChange={e => setReportMotivoOtro(e.target.value)}
                      className="rounded-xl h-11 flex-1"
                      required
                    />
                    <VoiceInputButton 
                      onTranscript={t => setReportMotivoOtro(prev => prev ? `${prev} ${t}` : t)}
                      className="h-11 w-11 rounded-xl shrink-0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-end gap-2 rounded-b-3xl">
            <Button 
              variant="ghost" 
              onClick={() => setIsReportOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSendReport}
              disabled={!reportPerson}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs h-11 px-5 shadow-lg shadow-rose-600/20 flex items-center gap-2"
            >
              <MessageCircle size={16} /> Abrir WhatsApp <ChevronRight size={14} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
