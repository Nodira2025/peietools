import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Plus, Search, Calendar, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import FilterBar from '../components/FilterBar';

interface Orden {
  id: string;
  title: string;
  objective: string;
  start_date: string;
  due_date: string;
  priority: string;
  status: string;
  assigned_to: string;
  created_at: string;
  profiles: {
    full_name: string | null;
  };
}

interface UserProfile {
  id: string;
  full_name: string;
}

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    status: '',
    date: '',
    assigned_to: '',
    search: ''
  });

  const fetchOrdenes = async () => {
    setLoading(true);
    let query = supabase
      .from('ordenes_trabajo')
      .select('*, assigned_to(full_name)')
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
    if (filters.date) {
      query = query.gte('created_at', `${filters.date}T00:00:00Z`)
                   .lte('created_at', `${filters.date}T23:59:59Z`);
    }

    const { data, error } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las órdenes' });
    } else {
      let filteredData = data || [];
      if (filters.search) {
        filteredData = filteredData.filter(o => 
          o.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          o.objective?.toLowerCase().includes(filters.search.toLowerCase())
        );
      }
      setOrdenes(filteredData);
    }
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name');
    if (data) setAvailableProfiles(data);
  };

  useEffect(() => {
    fetchOrdenes();
  }, [filters.status, filters.date, filters.assigned_to]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Urgente': return 'bg-red-100 text-red-700 border-red-200';
      case 'Alta': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Normal': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Finalizada': return 'text-green-600 bg-green-50';
      case 'En Progreso': return 'text-amber-600 bg-amber-50';
      case 'Pendiente': return 'text-slate-500 bg-slate-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  return (
    <div className="space-y-6 pb-safe">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-peie-blue">Órdenes de Trabajo</h1>
          <p className="text-muted-foreground">Gestión de tareas y objetivos por obra.</p>
        </div>
        <Link to="/ordenes/nueva">
          <Button className="bg-peie-blue hover:bg-peie-blue/90 text-white rounded-xl shadow-md flex items-center gap-2">
            <Plus size={18} />
            <span>Nueva Orden</span>
          </Button>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título o contenido..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-peie-blue/20"
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
          />
        </div>
        <FilterBar
          filters={[
            {
              key: 'status',
              label: 'Estado',
              value: filters.status,
              options: [
                { value: 'Pendiente', label: 'Pendiente' },
                { value: 'Aceptada', label: 'Aceptada' },
                { value: 'En Progreso', label: 'En Progreso' },
                { value: 'Finalizada', label: 'Finalizada' }
              ]
            },
            {
              key: 'date',
              label: 'Fecha',
              value: filters.date,
              type: 'date'
            },
            {
              key: 'assigned_to',
              label: 'A cargo de',
              value: filters.assigned_to,
              options: availableProfiles.map(p => ({ value: p.id, label: p.full_name }))
            }
          ]}
          onFilterChange={handleFilterChange}
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-peie-blue mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando tareas...</p>
        </div>
      ) : ordenes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardList size={48} className="mb-4 opacity-20" />
            <p>No se encontraron órdenes de trabajo.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {ordenes.slice(0, visibleCount).map(orden => (
            <Link key={orden.id} to={`/ordenes/${orden.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer border-slate-100 overflow-hidden group">
                <div className="flex h-full">
                  <div className={`w-1.5 ${getPriorityColor(orden.priority).split(' ')[0].replace('bg-', 'bg-').replace('-100', '-500')}`} />
                  <div className="flex-1 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(orden.priority)}`}>
                          {orden.priority}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(orden.status)}`}>
                          {orden.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        #{orden.id.slice(0, 8)}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-800 group-hover:text-peie-blue transition-colors">{orden.title}</h3>
                    <p className="text-sm text-slate-500 line-clamp-1 mt-1">{orden.objective}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>Vence: {orden.due_date ? new Date(orden.due_date).toLocaleDateString() : 'Sin fecha'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User size={12} />
                        <span>Para: {(orden as any).assigned_to?.full_name || 'Sin asignar'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          
          {visibleCount < ordenes.length && (
            <Button 
              variant="ghost" 
              className="w-full py-6 text-peie-blue hover:bg-peie-blue/5 font-bold"
              onClick={() => setVisibleCount(prev => prev + 5)}
            >
              Ver más órdenes ({ordenes.length - visibleCount} restantes)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
