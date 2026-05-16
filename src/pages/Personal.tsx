import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { HardHat, Search, MapPin, ArrowRightLeft, Clock } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import FilterBar from '../components/FilterBar';

interface Empleado {
  id: string;
  full_name: string;
  obra_id: string | null;
  obras: { name: string } | null;
}

interface TrasladoPendiente {
  id: string;
  empleados: { full_name: string };
  source_obra: { name: string } | null;
  status: string;
}

export default function Personal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [trasladosPendientes, setTrasladosPendientes] = useState<TrasladoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'free' | 'busy'>('all');
  const [activeTab, setActiveTab] = useState<'staff' | 'history'>('staff');
  const [historial, setHistorial] = useState<any[]>([]);
  const [filterObra, setFilterObra] = useState('');
  const [filterManager, setFilterManager] = useState('');
  
  // Opciones para filtros
  const [obrasOpciones, setObrasOpciones] = useState<{value: string, label: string}[]>([]);
  const [managersOpciones, setManagersOpciones] = useState<{value: string, label: string}[]>([]);

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    
    // Fetch Empleados
    const { data: empData, error: empError } = await supabase
      .from('empleados')
      .select('id, full_name, obra_id, obras:obra_id(name)')
      .order('full_name');
      
    if (empError) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el personal' });
    } else {
      setEmpleados(empData || []);
    }

    // Fetch Traslados Pendientes donde la obra destino es la del usuario
    if (profile.obra_id) {
      const { data: trasData } = await supabase
        .from('traslados_personal')
        .select('id, status, empleados(full_name), source_obra:obras!traslados_personal_source_obra_id_fkey(name)')
        .eq('target_obra_id', profile.obra_id)
        .eq('status', 'Pendiente');
      
      setTrasladosPendientes(trasData || []);
    }

    // Fetch Filter Options
    const { data: obrasData } = await supabase.from('obras').select('id, name, encargado_name').eq('active', true);
    if (obrasData) {
      setObrasOpciones(obrasData.map(o => ({ value: o.id, label: o.name })));
      const uniqueManagers = [...new Set(obrasData.map(o => o.encargado_name).filter(Boolean))].sort();
      setManagersOpciones(uniqueManagers.map(m => ({ value: m!, label: m! })));
    }

    setLoading(false);
  };

  const handleRelease = async (id: string) => {
    if (!window.confirm('¿Liberar a este empleado? Quedará sin obra asignada.')) return;
    const { error } = await supabase.from('empleados').update({ obra_id: null }).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Empleado Liberado', description: 'Ahora se puede asignar a otra obra.' });
      fetchData();
    }
  };
  const filteredEmpleados = empleados.filter(e => {
    const matchesSearch = !search || 
      e.full_name.toLowerCase().includes(search.toLowerCase()) || 
      (e.obras?.name || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesObra = !filterObra || e.obra_id === filterObra;
    
    if (filterType === 'free') return matchesSearch && !e.obra_id && matchesObra;
    if (filterType === 'busy') return matchesSearch && !!e.obra_id && matchesObra;
    return matchesSearch && matchesObra;
  });

  return (
    <div className="space-y-5 pb-safe">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Personal</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión y traslado de electricistas</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <Button 
            variant={activeTab === 'staff' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('staff')}
            className={`rounded-lg text-xs h-8 ${activeTab === 'staff' ? 'bg-white shadow-sm text-peie-blue' : 'text-slate-500'}`}
          >
            Equipo
          </Button>
          <Button 
            variant={activeTab === 'history' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('history')}
            className={`rounded-lg text-xs h-8 ${activeTab === 'history' ? 'bg-white shadow-sm text-peie-blue' : 'text-slate-500'}`}
          >
            Movimientos
          </Button>
        </div>
      </div>

      {/* Alerta de traslados pendientes */}
      {trasladosPendientes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-orange-700 font-bold">
            <Clock className="h-5 w-5" />
            <h3>Traslados Entrantes Pendientes ({trasladosPendientes.length})</h3>
          </div>
          <div className="space-y-2">
            {trasladosPendientes.map(t => (
              <div key={t.id} className="bg-white rounded-lg p-3 flex justify-between items-center shadow-sm border border-orange-100">
                <div>
                  <p className="text-sm font-bold text-slate-800">{t.empleados?.full_name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    Desde: {t.source_obra?.name || 'Desconocida'}
                  </p>
                </div>
                <Button 
                  onClick={() => navigate(`/personal/traslados/${t.id}`)}
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Confirmar Recepción
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-peie-blue" />
          <Input
            placeholder="Buscar empleado o por obra..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl border-slate-200 shadow-sm focus:ring-peie-blue/20"
          />
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
          <Button 
            variant={filterType === 'all' ? 'default' : 'ghost'} 
            onClick={() => setFilterType('all')}
            className={`flex-1 rounded-lg text-xs h-9 ${filterType === 'all' ? 'bg-peie-blue shadow-sm' : 'text-slate-500'}`}
          >
            Todos
          </Button>
          <Button 
            variant={filterType === 'free' ? 'default' : 'ghost'} 
            onClick={() => setFilterType('free')}
            className={`flex-1 rounded-lg text-xs h-9 ${filterType === 'free' ? 'bg-emerald-600 shadow-sm text-white' : 'text-slate-500'}`}
          >
            Libres
          </Button>
          <Button 
            variant={filterType === 'busy' ? 'default' : 'ghost'} 
            onClick={() => setFilterType('busy')}
            className={`flex-1 rounded-lg text-xs h-9 ${filterType === 'busy' ? 'bg-amber-600 shadow-sm text-white' : 'text-slate-500'}`}
          >
            En Obra
          </Button>
        </div>

        <FilterBar
          filters={[
            { key: 'obra', label: 'Obra', value: filterObra, options: obrasOpciones },
            { key: 'manager', label: 'Encargado', value: filterManager, options: managersOpciones },
          ]}
          onFilterChange={(key, val) => {
            if (key === 'obra') setFilterObra(val);
            if (key === 'manager') setFilterManager(val);
          }}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      ) : activeTab === 'staff' ? (
        <div className="space-y-2">
          {filteredEmpleados.map(emp => (
            // ... (Card logic for staff)
            <Card key={emp.id} className="overflow-hidden rounded-xl border-slate-200">
              <CardContent className="p-0">
                <div className="flex items-center p-4 gap-3">
                  <div className="w-10 h-10 rounded-full bg-peie-blue/10 flex items-center justify-center shrink-0">
                    <HardHat className="h-5 w-5 text-peie-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 truncate">{emp.full_name}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="h-3 w-3" /> {emp.obras?.name || 'Sin obra asignada'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="shrink-0 text-slate-400 hover:text-red-500 h-8 px-2 text-[10px] rounded-lg"
                      onClick={() => handleRelease(emp.id)}
                    >
                      Liberar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="shrink-0 text-peie-blue border-peie-blue/30 hover:bg-peie-blue/5 h-8 px-3 text-xs rounded-lg"
                      onClick={() => navigate(`/personal/trasladar/${emp.id}`)}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Trasladar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredEmpleados.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
              <HardHat className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No se encontraron empleados</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {historial.map(h => (
            <Card key={h.id} className="rounded-xl border-slate-100 shadow-sm" onClick={() => navigate(`/personal/traslados/${h.id}`)}>
              <CardContent className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">{h.empleados?.full_name}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    {h.source_obra?.name || 'Origen'} → {h.target_obra?.name || 'Destino'}
                  </p>
                  <p className="text-[9px] text-slate-300">Solicitado: {new Date(h.created_at).toLocaleDateString()}</p>
                </div>
                <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                  h.status === 'Pendiente' ? 'bg-orange-100 text-orange-700' : 
                  h.status === 'Completado' ? 'bg-green-100 text-green-700' : 
                  'bg-slate-100 text-slate-600'
                }`}>
                  {h.status}
                </div>
              </CardContent>
            </Card>
          ))}
          {historial.length === 0 && (
            <div className="text-center py-12 text-slate-400">No hay movimientos registrados.</div>
          )}
        </div>
      )}
    </div>
  );
}
