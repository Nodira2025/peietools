import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Plus, QrCode, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import FilterBar from '../components/FilterBar';

interface Herramienta {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  status: string;
  category: string | null;
  current_obra_id: string | null;
  photo_url?: string | null;
  obras?: { name: string; encargado_name: string | null } | null;
}

export default function Herramientas() {
  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterObra, setFilterObra] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterEncargado, setFilterEncargado] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';

  const fetchHerramientas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('herramientas')
        .select('*, obras(name, encargado_name)')
        .order('name');
      if (error) throw error;
      setHerramientas(data || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las herramientas' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHerramientas(); }, []);

  // Extraer opciones unicas para filtros
  const obrasUnicas = [...new Set(herramientas.map(h => h.obras?.name).filter(Boolean))].sort();
  const statusUnicos = [...new Set(herramientas.map(h => h.status))].sort();
  const categoriasUnicas = [...new Set(herramientas.map(h => h.category || 'Otros').filter(Boolean))].sort();
  const encargadosUnicos = [...new Set(herramientas.map(h => h.obras?.encargado_name).filter(Boolean))].sort();

  const filtered = herramientas.filter(h => {
    const matchSearch = !searchTerm || h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.code.toLowerCase().includes(searchTerm.toLowerCase()) || (h.brand || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchObra = !filterObra || h.obras?.name === filterObra;
    const matchStatus = !filterStatus || h.status === filterStatus;
    const matchCategory = !filterCategory || (h.category || 'Otros') === filterCategory;
    const matchEncargado = !filterEncargado || h.obras?.encargado_name === filterEncargado;
    const matchDate = !filterDate || (h as any).created_at?.startsWith(filterDate);
    return matchSearch && matchObra && matchStatus && matchCategory && matchEncargado && matchDate;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Disponible': return 'bg-green-100 text-green-800';
      case 'En uso': return 'bg-peie-light/20 text-peie-blue';
      case 'En traslado': return 'bg-orange-100 text-orange-800';
      case 'En mantenimiento': return 'bg-orange-100 text-orange-800';
      case 'Fuera de servicio': return 'bg-red-100 text-red-800';
      case 'Reservada': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'obra') setFilterObra(value);
    else if (key === 'status') setFilterStatus(value);
    else if (key === 'category') setFilterCategory(value);
    else if (key === 'encargado') setFilterEncargado(value);
    else if (key === 'date') setFilterDate(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Herramientas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {herramientas.length} herramientas</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => navigate('/herramientas/scanner')}>
            <QrCode className="mr-2 h-4 w-4" /> QR
          </Button>
          {isAdmin && (
            <Button className="bg-peie-blue hover:bg-peie-blue/90 flex-1 sm:flex-none" onClick={() => navigate('/herramientas/nueva')}>
              <Plus className="mr-2 h-4 w-4" /> Nueva
            </Button>
          )}
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar nombre, codigo o marca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10 rounded-xl" />
      </div>

      {/* Filtros */}
      <FilterBar
        filters={[
          { key: 'status', label: 'Estado', value: filterStatus, options: statusUnicos.map(s => ({ value: s, label: s })) },
          { key: 'category', label: 'Categoria', value: filterCategory, options: categoriasUnicas.map(c => ({ value: c, label: c })) },
          { key: 'obra', label: 'Obra', value: filterObra, options: obrasUnicas.map(o => ({ value: o!, label: o! })) },
          { key: 'encargado', label: 'Encargado', value: filterEncargado, options: encargadosUnicos.map(e => ({ value: e!, label: e! })) },
          { key: 'date', label: 'Fecha Alta', value: filterDate, type: 'date' },
        ]}
        onFilterChange={handleFilterChange}
      />

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando herramientas...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.slice(0, visibleCount).map(h => (
            <Card key={h.id} className="relative hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col rounded-xl" onClick={() => navigate('/herramientas/' + h.id)}>
              {h.photo_url && (
                <div className="h-32 w-full bg-slate-50 border-b border-slate-100">
                  <img src={h.photo_url} alt={h.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.parentElement!.style.display = 'none'; }} />
                </div>
              )}
              <CardHeader className="pb-2 pt-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{h.code}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getStatusColor(h.status)}`}>{h.status}</span>
                </div>
                <CardTitle className="text-sm mt-1.5 line-clamp-1">{h.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{h.brand || 'Sin marca'} {h.category && h.category !== 'Otros' ? '- ' + h.category : ''}</p>
              </CardHeader>
              <CardContent className="text-xs pb-2 text-muted-foreground">
                <span className="line-clamp-1">{h.obras?.name || 'Sin ubicacion'}</span>
              </CardContent>
            </Card>
          ))}
          
          {visibleCount < filtered.length && (
            <div className="col-span-full pt-4">
              <Button 
                variant="ghost" 
                className="w-full py-6 text-peie-blue hover:bg-peie-blue/5 font-bold rounded-xl"
                onClick={() => setVisibleCount(prev => prev + 6)}
              >
                Ver más herramientas ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
              <Wrench className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <h3 className="text-sm font-medium text-gray-500">No hay resultados</h3>
              <p className="text-xs text-gray-400 mt-1">Proba con otros filtros o busqueda.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
