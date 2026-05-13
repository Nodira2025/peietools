import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Truck, Clock, Package, CheckCircle, ArrowRight, Wrench } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface Solicitud {
  id: string;
  status: string;
  priority: string;
  created_at: string;
  herramientas: { name: string; code: string; obras: { name: string } | null };
  target_obra: { name: string };
  profiles: { full_name: string };
}

export default function Logistica() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSolicitudes();
  }, []);

  const fetchSolicitudes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('solicitudes')
      .select(`
        id, status, priority, created_at,
        herramientas!solicitudes_herramienta_id_fkey(name, code, obras!herramientas_current_obra_id_fkey(name)),
        target_obra:obras!solicitudes_target_obra_id_fkey(name),
        profiles!solicitudes_requester_id_fkey(full_name)
      `)
      .in('status', ['Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada'])
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los pedidos.' });
    } else {
      setSolicitudes(data as unknown as Solicitud[]);
    }
    setLoading(false);
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Pendiente': return { bg: 'bg-orange-50 border-orange-200', icon: <Clock className="h-6 w-6 text-orange-500" />, color: 'text-orange-600', label: 'PENDIENTE' };
      case 'Asignada': return { bg: 'bg-blue-50 border-blue-200', icon: <CheckCircle className="h-6 w-6 text-blue-500" />, color: 'text-blue-600', label: 'ASIGNADA' };
      case 'En retiro': return { bg: 'bg-purple-50 border-purple-200', icon: <Package className="h-6 w-6 text-purple-500" />, color: 'text-purple-600', label: 'EN RETIRO' };
      case 'En traslado': return { bg: 'bg-sky-50 border-sky-200', icon: <Truck className="h-6 w-6 text-sky-500" />, color: 'text-sky-600', label: 'EN TRASLADO' };
      case 'Entregada': return { bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="h-6 w-6 text-green-500" />, color: 'text-green-600', label: 'ENTREGADA' };
      default: return { bg: 'bg-slate-50 border-slate-200', icon: <Clock className="h-6 w-6 text-slate-400" />, color: 'text-slate-500', label: status };
    }
  };

  const getPriorityDot = (p: string) => {
    switch(p) {
      case 'Urgente': return 'bg-red-500';
      case 'Alta': return 'bg-orange-500';
      case 'Normal': return 'bg-blue-400';
      default: return 'bg-green-400';
    }
  };

  const pendientes = solicitudes.filter(s => s.status === 'Pendiente');
  const enCurso = solicitudes.filter(s => s.status !== 'Pendiente');

  return (
    <div className="space-y-6 pb-safe">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Panel de Logistica</h1>
        <p className="text-sm text-muted-foreground mt-1">Toca un pedido para gestionarlo</p>
      </div>

      {/* Contadores rapidos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-orange-600">{pendientes.length}</p>
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mt-1">Pendientes</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-blue-600">{enCurso.length}</p>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mt-1">En Curso</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando pedidos...</div>
      ) : (
        <>
          {/* PEDIDOS PENDIENTES - Seccion destacada */}
          {pendientes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider">Requieren tu atencion</h2>
              {pendientes.map(s => {
                const style = getStatusStyle(s.status);
                return (
                  <Card 
                    key={s.id} 
                    className={`${style.bg} border-2 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform shadow-sm hover:shadow-md`}
                    onClick={() => navigate('/solicitudes/' + s.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {style.icon}
                          <span className={`text-[10px] font-black uppercase tracking-widest ${style.color}`}>{style.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${getPriorityDot(s.priority)}`} />
                          <span className="text-[10px] text-slate-400 font-medium">{s.priority}</span>
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-800 text-base">{s.herramientas.name}</h3>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{s.herramientas.code}</p>
                      <div className="flex items-center gap-2 mt-3 text-xs">
                        <span className="bg-white/70 px-2 py-1 rounded-lg text-slate-600 truncate max-w-[40%]">{s.herramientas.obras?.name || '?'}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="bg-white/70 px-2 py-1 rounded-lg text-slate-700 font-semibold truncate max-w-[40%]">{s.target_obra.name}</span>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200/50">
                        <span className="text-xs text-slate-400">Solicita: <strong className="text-slate-600">{s.profiles.full_name}</strong></span>
                        <span className="text-[10px] text-slate-300 font-mono">{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* PEDIDOS EN CURSO */}
          {enCurso.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-blue-500 uppercase tracking-wider">En curso</h2>
              {enCurso.map(s => {
                const style = getStatusStyle(s.status);
                return (
                  <Card 
                    key={s.id} 
                    className={`${style.bg} border rounded-2xl cursor-pointer active:scale-[0.98] transition-transform`}
                    onClick={() => navigate('/solicitudes/' + s.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {style.icon}
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">{s.herramientas.name}</h3>
                            <p className="text-[10px] text-slate-400">{s.herramientas.obras?.name || '?'} → {s.target_obra.name}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase ${style.color}`}>{style.label}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* SIN PEDIDOS */}
          {solicitudes.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <Truck className="mx-auto h-16 w-16 text-slate-200 mb-4" />
              <h3 className="text-lg font-bold text-slate-400">Sin pedidos pendientes</h3>
              <p className="text-sm text-slate-300 mt-1">Todo tranquilo por ahora</p>
            </div>
          )}

          {/* Boton rapido a herramientas */}
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-peie-blue text-peie-blue hover:bg-peie-blue/5 font-semibold"
            onClick={() => navigate('/herramientas')}
          >
            <Wrench className="mr-2 h-4 w-4" />
            Ver Catalogo de Herramientas
          </Button>
        </>
      )}
    </div>
  );
}
