import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Wrench, 
  Plus, 
  QrCode, 
  Search, 
  Layers, 
  Disc, 
  Hammer, 
  Shield, 
  Ruler, 
  Car, 
  ChevronLeft, 
  Building2
} from 'lucide-react';
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterObra, setFilterObra] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEncargado, setFilterEncargado] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'logistica';

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

  useEffect(() => {
    fetchHerramientas();
  }, []);

  const categoriesList = [
    { name: 'Escaleras', icon: Layers, color: 'from-amber-400 to-orange-500', desc: 'Escaleras telescópicas, tijeras, andamios' },
    { name: 'Amoladoras', icon: Disc, color: 'from-sky-400 to-blue-600', desc: 'Amoladoras angulares, de banco, discos' },
    { name: 'Taladros', icon: Hammer, color: 'from-rose-400 to-red-600', desc: 'Rotopercutores, atornilladores, brocas' },
    { name: 'Elementos de seguridad', icon: Shield, color: 'from-emerald-400 to-teal-600', desc: 'Cascos, arneses, antiparras, guantes' },
    { name: 'Instrumentos de medición', icon: Ruler, color: 'from-purple-400 to-indigo-600', desc: 'Multímetros, pinzas, niveles, cintas' },
    { name: 'Vehículos', icon: Car, color: 'from-teal-400 to-cyan-600', desc: 'Camionetas, utilitarios, furgones' },
    { name: 'Otros', icon: Wrench, color: 'from-slate-400 to-slate-600', desc: 'Herramientas menores y accesorios varios' },
  ];

  const getCategoryIcon = (category: string | null) => {
    switch(category) {
      case 'Escaleras': return <Layers className="h-5 w-5 text-amber-500" />;
      case 'Amoladoras': return <Disc className="h-5 w-5 text-sky-500" />;
      case 'Taladros': return <Hammer className="h-5 w-5 text-rose-500" />;
      case 'Elementos de seguridad': return <Shield className="h-5 w-5 text-emerald-500" />;
      case 'Instrumentos de medición': return <Ruler className="h-5 w-5 text-purple-500" />;
      case 'Vehículos': return <Car className="h-5 w-5 text-teal-500" />;
      default: return <Wrench className="h-5 w-5 text-slate-500" />;
    }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Disponible': return {
        badge: 'bg-green-100 text-green-800 border-green-200',
        border: 'border-l-green-500 border-l-4 md:border-green-100 md:hover:border-green-500',
        dot: 'bg-green-500'
      };
      case 'Reservada': return {
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        border: 'border-l-yellow-500 border-l-4 md:border-yellow-100 md:hover:border-yellow-500',
        dot: 'bg-yellow-500'
      };
      case 'En traslado': return {
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        border: 'border-l-blue-500 border-l-4 md:border-blue-100 md:hover:border-blue-500',
        dot: 'bg-blue-500'
      };
      case 'En uso': return {
        badge: 'bg-orange-100 text-orange-800 border-orange-200',
        border: 'border-l-orange-500 border-l-4 md:border-orange-100 md:hover:border-orange-500',
        dot: 'bg-orange-500'
      };
      case 'En mantenimiento': return {
        badge: 'bg-red-100 text-red-800 border-red-200',
        border: 'border-l-red-500 border-l-4 md:border-red-100 md:hover:border-red-500',
        dot: 'bg-red-500'
      };
      default: return {
        badge: 'bg-red-100 text-red-900 border-red-200',
        border: 'border-l-red-600 border-l-4 md:border-red-200 md:hover:border-red-600',
        dot: 'bg-red-600'
      };
    }
  };

  // Filtrado de herramientas por la categoría seleccionada y los filtros
  const filtered = herramientas.filter(h => {
    const catName = h.category || 'Otros';
    const matchCategory = !selectedCategory || catName === selectedCategory;
    const matchSearch = !searchTerm || 
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      h.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (h.brand || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchObra = !filterObra || h.obras?.name === filterObra;
    const matchStatus = !filterStatus || h.status === filterStatus;
    const matchEncargado = !filterEncargado || h.obras?.encargado_name === filterEncargado;
    return matchCategory && matchSearch && matchObra && matchStatus && matchEncargado;
  });

  const obrasUnicas = [...new Set(herramientas.map(h => h.obras?.name).filter((name): name is string => !!name))].sort();
  const statusUnicos = [...new Set(herramientas.map(h => h.status))].sort();
  const encargadosUnicos = [...new Set(herramientas.map(h => h.obras?.encargado_name).filter((name): name is string => !!name))].sort();

  return (
    <div className="space-y-6 pb-safe">
      
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            {selectedCategory && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setSelectedCategory(null); setSearchTerm(''); }}
                className="p-1 h-8 w-8 rounded-full hover:bg-slate-100 text-peie-blue mr-1"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-peie-blue">
              {selectedCategory ? `${selectedCategory}` : 'Categorías de Herramientas'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedCategory 
              ? `${filtered.length} herramientas en esta categoría` 
              : 'Selecciona una categoría para ver y gestionar sus herramientas'}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none h-11 rounded-xl" onClick={() => navigate('/herramientas/scanner')}>
            <QrCode className="mr-2 h-4 w-4" /> QR
          </Button>
          {isAdmin && (
            <Button className="bg-peie-blue hover:bg-peie-blue/90 flex-1 sm:flex-none h-11 rounded-xl" onClick={() => navigate('/herramientas/nueva')}>
              <Plus className="mr-2 h-4 w-4" /> Nueva Herramienta
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-8 h-8 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin mx-auto mb-3" />
          Cargando inventario...
        </div>
      ) : !selectedCategory ? (
        /* VISTA DE CATEGORÍAS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoriesList.map((cat) => {
            const Icon = cat.icon;
            const count = herramientas.filter(h => (h.category || 'Otros') === cat.name).length;
            return (
              <Card 
                key={cat.name} 
                className="group relative cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-300 rounded-2xl border-slate-100 hover:border-peie-blue/10 flex flex-col justify-between"
                onClick={() => setSelectedCategory(cat.name)}
              >
                <div className={`h-1.5 bg-gradient-to-r ${cat.color} w-full`} />
                <CardHeader className="pb-3 pt-5">
                  <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${cat.color} text-white shadow-md shadow-slate-100 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200/50">
                      {count} {count === 1 ? 'unidad' : 'unidades'}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold text-slate-800 mt-4 group-hover:text-peie-blue transition-colors">
                    {cat.name}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1.5 line-clamp-2">
                    {cat.desc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-5 pt-0">
                  <span className="inline-flex items-center text-xs font-bold text-peie-blue group-hover:underline">
                    Ver herramientas <ChevronLeft className="h-3 w-3 rotate-180 ml-1" />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* VISTA DE HERRAMIENTAS DENTRO DE UNA CATEGORÍA */
        <div className="space-y-4">
          {/* Buscador e Inputs de Filtrado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar por nombre, código o marca..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="pl-10 h-11 rounded-xl border-slate-200" 
              />
            </div>
            <Button 
              variant="outline"
              className="h-11 rounded-xl border-slate-200 text-slate-600 font-medium"
              onClick={() => { setSearchTerm(''); setFilterObra(''); setFilterStatus(''); setFilterEncargado(''); }}
            >
              Limpiar Filtros
            </Button>
          </div>

          <FilterBar
            filters={[
              { key: 'status', label: 'Estado', value: filterStatus, options: statusUnicos.map(s => ({ value: s, label: s })) },
              { key: 'obra', label: 'Obra actual', value: filterObra, options: obrasUnicas.map(o => ({ value: o, label: o })) },
              { key: 'encargado', label: 'Encargado', value: filterEncargado, options: encargadosUnicos.map(e => ({ value: e, label: e })) },
            ]}
            onFilterChange={(key, val) => {
              if (key === 'status') setFilterStatus(val);
              if (key === 'obra') setFilterObra(val);
              if (key === 'encargado') setFilterEncargado(val);
            }}
          />

          {/* Grilla de Herramientas (2 columnas en celular, 3 columnas en PC) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.slice(0, visibleCount).map((h) => {
              const styles = getStatusStyle(h.status);
              return (
                <Card 
                  key={h.id} 
                  className={`group relative overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-lg rounded-2xl border ${styles.border}`} 
                  onClick={() => navigate('/herramientas/' + h.id)}
                >
                  <div>
                    {/* Imagen de cabecera */}
                    <div className="relative h-36 w-full bg-slate-50 border-b border-slate-100 overflow-hidden">
                      {h.photo_url ? (
                        <img 
                          src={h.photo_url} 
                          alt={h.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          onError={e => { e.currentTarget.parentElement!.style.display = 'none'; }} 
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
                          {getCategoryIcon(h.category)}
                          <span className="text-[10px] mt-1 text-slate-400">Sin fotografía</span>
                        </div>
                      )}
                      {/* Estado flotante sobre la foto en móvil */}
                      <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${styles.badge}`}>
                        {h.status}
                      </span>
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200/50">
                          {h.code}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">{h.brand || 'Genérica'}</span>
                      </div>

                      {/* Título más grande para Premium */}
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-peie-blue transition-colors">
                        {h.name}
                      </h3>
                    </div>
                  </div>

                  {/* Footer de la tarjeta con indicadores visuales mínimos */}
                  <div className="p-4 pt-0 border-t border-slate-50 mt-auto bg-slate-50/30">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 font-medium">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{h.obras?.name || 'Base Central'}</span>
                    </div>
                  </div>
                </Card>
              );
            })}

            {visibleCount < filtered.length && (
              <div className="col-span-full pt-4">
                <Button 
                  variant="ghost" 
                  className="w-full py-6 text-peie-blue hover:bg-peie-blue/5 font-bold rounded-2xl border border-dashed border-slate-200"
                  onClick={() => setVisibleCount(prev => prev + 12)}
                >
                  Ver más herramientas ({filtered.length - visibleCount} restantes)
                </Button>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                <Wrench className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-700">No encontramos herramientas</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Prueba cambiando los filtros o realizando otra búsqueda dentro de la categoría {selectedCategory}.
                </p>
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => { setSearchTerm(''); setFilterObra(''); setFilterStatus(''); setFilterEncargado(''); }}>
                  Restablecer
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

