import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore } from '../store/auth';
import { Wrench, Truck, FileText, CheckCircle2, ShoppingCart, MapPin, AlertTriangle, QrCode, Search, PlusCircle, Home, Users, ClipboardList } from 'lucide-react';

interface DashboardStats {
  disponibles: number;
  enUso: number;
  enMantenimiento: number;
  solicitudesPendientes: number;
  traslados: number;
  comprasPendientes: number;
  comprasAprobadas: number;
  herramientasGPS: number;
  fueraDeServicio: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    disponibles: 0,
    enUso: 0,
    enMantenimiento: 0,
    solicitudesPendientes: 0,
    traslados: 0,
    comprasPendientes: 0,
    comprasAprobadas: 0,
    herramientasGPS: 0,
    fueraDeServicio: 0,
  });
  const [loading, setLoading] = useState(true);

  const isEncargado = profile?.role === 'encargado' || profile?.role === 'solicitante';

  useEffect(() => {
    // Si es encargado, evitamos la carga pesada de contadores globales que no utiliza
    if (isEncargado) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const [
          { count: disponibles },
          { count: enUso },
          { count: enMantenimiento },
          { count: fueraDeServicio },
          { count: pendientes },
          { count: traslados },
          { count: comprasPendientes },
          { count: comprasAprobadas },
          { count: herramientasGPS }
        ] = await Promise.all([
          supabase.from('herramientas').select('*', { count: 'exact', head: true }).eq('status', 'Disponible'),
          supabase.from('herramientas').select('*', { count: 'exact', head: true }).eq('status', 'En uso'),
          supabase.from('herramientas').select('*', { count: 'exact', head: true }).eq('status', 'En mantenimiento'),
          supabase.from('herramientas').select('*', { count: 'exact', head: true }).eq('status', 'Fuera de servicio'),
          supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('status', 'Pendiente'),
          supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('status', 'En traslado'),
          supabase.from('solicitudes_compras').select('*', { count: 'exact', head: true }).eq('status', 'Pendiente'),
          supabase.from('solicitudes_compras').select('*', { count: 'exact', head: true }).eq('status', 'Aprobada'),
          supabase.from('herramientas').select('*', { count: 'exact', head: true }).not('last_latitude', 'is', null)
        ]);

        setStats({
          disponibles: disponibles || 0,
          enUso: enUso || 0,
          enMantenimiento: enMantenimiento || 0,
          fueraDeServicio: fueraDeServicio || 0,
          solicitudesPendientes: pendientes || 0,
          traslados: traslados || 0,
          comprasPendientes: comprasPendientes || 0,
          comprasAprobadas: comprasAprobadas || 0,
          herramientasGPS: herramientasGPS || 0,
        });
      } catch (error) {
        console.error('Error al cargar stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isEncargado]);

  const statCards = [
    { title: 'Disponibles', value: stats.disponibles, icon: CheckCircle2, color: 'text-green-500' },
    { title: 'En Uso', value: stats.enUso, icon: Wrench, color: 'text-peie-blue' },
    { title: 'Pendientes (Traslados)', value: stats.solicitudesPendientes, icon: FileText, color: 'text-orange-500' },
    { title: 'En Traslado', value: stats.traslados, icon: Truck, color: 'text-peie-light' },
    { title: 'Con GPS', value: stats.herramientasGPS, icon: MapPin, color: 'text-blue-500' },
    { title: 'Compras Pendientes', value: stats.comprasPendientes, icon: ShoppingCart, color: 'text-orange-500' },
    { title: 'Compras Aprobadas', value: stats.comprasAprobadas, icon: ShoppingCart, color: 'text-green-500' },
    { title: 'Fuera de Servicio', value: stats.fueraDeServicio, icon: AlertTriangle, color: 'text-red-500' },
  ];

  if (loading) {
    return (
      <div className="animate-pulse flex flex-col gap-4 p-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // =========================================================================
  // BOTONERA PRINCIPAL DE ACCESOS RÁPIDOS (PARA TODOS LOS USUARIOS)
  // =========================================================================
  const MainMenu = () => (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
        Menú Principal
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card onClick={() => navigate('/solicitudes')} className="border-0 ring-1 ring-slate-100 hover:ring-peie-blue/30 shadow-sm transition-all cursor-pointer bg-white active:scale-95 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 h-24">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Home size={20} /></div>
          <span className="text-[10px] font-bold text-slate-700 uppercase">Pedidos</span>
        </Card>
        <Card onClick={() => navigate('/herramientas')} className="border-0 ring-1 ring-slate-100 hover:ring-peie-blue/30 shadow-sm transition-all cursor-pointer bg-white active:scale-95 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 h-24">
          <div className="p-2 bg-peie-blue/10 text-peie-blue rounded-lg"><Wrench size={20} /></div>
          <span className="text-[10px] font-bold text-slate-700 uppercase">Herramientas</span>
        </Card>
        <Card onClick={() => navigate('/mis-obras')} className="border-0 ring-1 ring-slate-100 hover:ring-peie-blue/30 shadow-sm transition-all cursor-pointer bg-white active:scale-95 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 h-24">
          <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><MapPin size={20} /></div>
          <span className="text-[10px] font-bold text-slate-700 uppercase">Mis Obras</span>
        </Card>
        <Card onClick={() => navigate('/personal')} className="border-0 ring-1 ring-slate-100 hover:ring-peie-blue/30 shadow-sm transition-all cursor-pointer bg-white active:scale-95 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 h-24">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Users size={20} /></div>
          <span className="text-[10px] font-bold text-slate-700 uppercase">Personal</span>
        </Card>
        <Card onClick={() => navigate('/ordenes')} className="border-0 ring-1 ring-slate-100 hover:ring-peie-blue/30 shadow-sm transition-all cursor-pointer bg-white active:scale-95 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 h-24">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><ClipboardList size={20} /></div>
          <span className="text-[10px] font-bold text-slate-700 uppercase">Órdenes</span>
        </Card>
        <Card onClick={() => navigate('/herramientas/scanner')} className="border-0 ring-1 ring-slate-100 hover:ring-peie-blue/30 shadow-sm transition-all cursor-pointer bg-white active:scale-95 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 h-24 border-dashed border-2 border-peie-blue/20">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><QrCode size={20} /></div>
          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter">Escanear QR</span>
        </Card>
      </div>
    </div>
  );

  if (loading) {
// ... (omitting some unchanged code)
  }

  if (isEncargado) {
    return (
      <div className="space-y-6 max-w-md mx-auto pb-safe">
        
        {/* Tarjeta de Bienvenida */}
        <div className="bg-gradient-to-br from-peie-blue to-peie-light text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl border border-white/30">
              {profile?.full_name?.charAt(0) || 'E'}
            </div>
            <div>
              <p className="text-xs text-peie-light font-medium uppercase tracking-wider">Panel de Operaciones</p>
              <h2 className="text-xl font-bold line-clamp-1">{profile?.full_name || 'Usuario'}</h2>
              <span className="inline-block text-[10px] bg-white/20 px-2 py-0.5 rounded-full mt-1">
                Conectado
              </span>
            </div>
          </div>
        </div>

        <MainMenu />

        {/* Tarjeta de Soporte Simple */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500">¿Necesitas ayuda con un equipo?</p>
          <button 
            onClick={() => navigate('/herramientas')}
            className="mt-2 text-xs font-bold text-peie-blue underline decoration-peie-light underline-offset-2"
          >
            Consultar inventario general
          </button>
        </div>

      </div>
    );
  }

  // =========================================================================
  // VISTA CLÁSICA DE ESTADÍSTICAS PARA ADMINISTRADORES Y LOGÍSTICA
  // =========================================================================
  return (
    <div className="space-y-6 pb-safe">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-peie-blue">Dashboard General</h1>
          <p className="text-muted-foreground text-sm">Resumen de operaciones logísticas e inventario</p>
        </div>
      </div>

      <MainMenu />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border-0 ring-1 ring-slate-100 shadow-sm rounded-2xl overflow-hidden">
              <div className="h-1 bg-peie-light" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-semibold text-slate-500">{stat.title}</CardTitle>
                <div className={`p-1.5 rounded-lg bg-slate-50 ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-1">
                <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-0 ring-1 ring-slate-100 shadow-sm rounded-2xl">
        <CardHeader className="px-6 pt-6 pb-3">
          <CardTitle className="text-base font-bold text-slate-800">Trazabilidad de Inventario</CardTitle>
          <CardDescription className="text-xs">Los movimientos de entrega y retiro quedan registrados de forma automatizada.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>El sistema está monitoreando y documentando en base de datos cada traslado de herramientas.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
