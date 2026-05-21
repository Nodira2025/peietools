import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore } from '../store/auth';
import { Wrench, Truck, FileText, CheckCircle2, ShoppingCart, MapPin, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export default function Reportes() {
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

  const isAuthorized = profile?.role === 'admin' || profile?.role === 'logistica';

  useEffect(() => {
    if (profile && !isAuthorized) {
      navigate('/dashboard');
      return;
    }
  }, [profile, isAuthorized, navigate]);

  useEffect(() => {
    if (!isAuthorized) return;

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
  }, [isAuthorized]);

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

  if (!isAuthorized) {
    return null;
  }

  if (loading) {
    return (
      <div className="animate-pulse flex flex-col gap-4 p-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-safe">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-peie-blue">Reportes y Estadísticas</h1>
            <p className="text-muted-foreground text-sm">Resumen en tiempo real del inventario y traslados</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border-0 ring-1 ring-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white">
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

      <Card className="border-0 ring-1 ring-slate-100 shadow-sm rounded-2xl bg-white">
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
