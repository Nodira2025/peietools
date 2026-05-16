import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Truck, Clock, Package, CheckCircle, ArrowRight, Wrench } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import FilterBar from '../components/FilterBar';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface LogisticaItem {
  id: string;
  type: 'herramienta' | 'personal';
  status: string;
  priority: string;
  created_at: string;
  item_name: string;
  item_code: string;
  source_name: string;
  target_name: string;
  requester_name: string;
}

export default function Logistica() {
  const [items, setItems] = useState<LogisticaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [filterRequester, setFilterRequester] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  // Opciones para filtros
  const [managers, setManagers] = useState<{value: string, label: string}[]>([]);
  const [requesters, setRequesters] = useState<{value: string, label: string}[]>([]);

  useEffect(() => {
    fetchSolicitudes();
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    const { data: profiles } = await supabase.from('profiles').select('full_name, role').eq('active', true);
    if (profiles) {
      const logs = profiles.filter(p => p.role === 'logistica' || p.role === 'admin')
        .map(p => ({ value: p.full_name, label: p.full_name }));
      const reqs = profiles.map(p => ({ value: p.full_name, label: p.full_name }));
      setManagers(logs);
      setRequesters(reqs);
    }
  };

  const fetchSolicitudes = async () => {
    setLoading(true);
    try {
      // 1. Fetch Herramientas
      const { data: toolsData, error: toolsError } = await supabase
        .from('solicitudes')
        .select(`
          id, status, priority, created_at,
          herramientas!solicitudes_herramienta_id_fkey(name, code, obras!herramientas_current_obra_id_fkey(name)),
          target_obra:obras!solicitudes_target_obra_id_fkey(name),
          profiles!solicitudes_requester_id_fkey(full_name)
        `)
        .in('status', ['Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada']);

      if (toolsError) throw toolsError;

      // 2. Fetch Personal
      const { data: personalData, error: personalError } = await supabase
        .from('traslados_personal')
        .select(`
          id, status, created_at,
          empleados!traslados_personal_empleado_id_fkey(full_name),
          source_obra:obras!traslados_personal_source_obra_id_fkey(name),
          target_obra:obras!traslados_personal_target_obra_id_fkey(name),
          requester:profiles!traslados_personal_requester_id_fkey(full_name)
        `)
        .eq('status', 'Pendiente'); // De personal solo mostramos los pendientes en este panel rapido

      if (personalError) throw personalError;

      // 3. Unified
      const unified: LogisticaItem[] = [
        ...(toolsData || []).map((s: any) => ({
          id: s.id,
          type: 'herramienta' as const,
          status: s.status,
          priority: s.priority,
          created_at: s.created_at,
          item_name: s.herramientas?.name,
          item_code: s.herramientas?.code,
          source_name: s.herramientas?.obras?.name || '?',
          target_name: s.target_obra?.name,
          requester_name: s.profiles?.full_name
        })),
        ...(personalData || []).map((s: any) => ({
          id: s.id,
          type: 'personal' as const,
          status: s.status,
          priority: 'Normal',
          created_at: s.created_at,
          item_name: s.empleados?.full_name,
          item_code: 'PERS',
          source_name: s.source_obra?.name || 'Sin obra',
          target_name: s.target_obra?.name,
          requester_name: s.requester?.full_name
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(unified);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
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

  const filteredItems = items.filter(s => {
    const matchSearch = !searchTerm || 
      s.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.requester_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchType = !filterType || s.type === filterType;
    const matchRequester = !filterRequester || s.requester_name === filterRequester;
    const matchDate = !filterDate || s.created_at.startsWith(filterDate);
    // Nota: filterManager no se aplica directamente aca porque no tenemos el manager en LogisticaItem aun,
    // lo agregare a la interfaz.
    return matchSearch && matchType && matchRequester && matchDate;
  });

  const pendientes = filteredItems.filter(s => s.status === 'Pendiente');
  const enCurso = filteredItems.filter(s => s.status !== 'Pendiente');

  return (
    <div className="space-y-6 pb-safe">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Panel de Logística</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestión unificada de pedidos y traslados</p>
      </div>

      {/* Buscador y Filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar herramienta, código o solicitante..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        
        <FilterBar
          filters={[
            { key: 'type', label: 'Tipo', value: filterType, options: [{ value: 'herramienta', label: 'Herramienta' }, { value: 'personal', label: 'Personal' }] },
            { key: 'requester', label: 'Solicitante', value: filterRequester, options: requesters },
            { key: 'date', label: 'Fecha', value: filterDate, type: 'date' },
          ]}
          onFilterChange={(key, val) => {
            if (key === 'type') setFilterType(val);
            if (key === 'requester') setFilterRequester(val);
            if (key === 'date') setFilterDate(val);
          }}
        />
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
                    onClick={() => navigate(s.type === 'herramienta' ? '/solicitudes/' + s.id : '/personal/traslados/' + s.id)}
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
                      <h3 className="font-bold text-slate-800 text-base">{s.item_name}</h3>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{s.item_code}</p>
                      <div className="flex items-center gap-2 mt-3 text-xs">
                        <span className="bg-white/70 px-2 py-1 rounded-lg text-slate-600 truncate max-w-[40%]">{s.source_name}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="bg-white/70 px-2 py-1 rounded-lg text-slate-700 font-semibold truncate max-w-[40%]">{s.target_name}</span>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200/50">
                        <span className="text-xs text-slate-400">Solicita: <strong className="text-slate-600">{s.requester_name}</strong></span>
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
                    onClick={() => navigate(s.type === 'herramienta' ? '/solicitudes/' + s.id : '/personal/traslados/' + s.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {style.icon}
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">{s.item_name}</h3>
                            <p className="text-[10px] text-slate-400">{s.source_name} → {s.target_name}</p>
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
          {items.length === 0 && (
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
