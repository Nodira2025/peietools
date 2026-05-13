import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Plus, QrCode, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface Herramienta {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  status: string;
  current_obra_id: string | null;
  photo_url?: string | null;
  obras?: { name: string } | null;
}

export default function Herramientas() {
  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';

  const fetchHerramientas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('herramientas')
      .select('*, obras(name)')
      .order('name');
      
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las herramientas' });
    } else {
      setHerramientas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHerramientas();
  }, []);

  const filteredHerramientas = herramientas.filter(h => 
    h.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    h.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Disponible': return 'bg-green-100 text-green-800';
      case 'En uso': return 'bg-peie-light/20 text-peie-blue';
      case 'En traslado': return 'bg-orange-100 text-orange-800';
      case 'En mantenimiento': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-peie-blue">Catálogo de Herramientas</h1>
          <p className="text-muted-foreground">Consulta, reserva y administra las herramientas.</p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => navigate('/herramientas/scanner')}>
            <QrCode className="mr-2 h-4 w-4" /> Escanear QR
          </Button>
          {isAdmin && (
            <Button className="bg-peie-blue hover:bg-peie-blue/90 flex-1 sm:flex-none" onClick={() => navigate('/herramientas/nueva')}>
              <Plus className="mr-2 h-4 w-4" /> Nueva
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre o código..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando herramientas...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredHerramientas.map(herramienta => (
            <Card key={herramienta.id} className="relative hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col" onClick={() => navigate(`/herramientas/${herramienta.id}`)}>
              {herramienta.photo_url && (
                <div className="h-36 w-full bg-slate-50 border-b border-slate-100 relative">
                  <img 
                    src={herramienta.photo_url} 
                    alt={herramienta.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.parentElement!.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <CardHeader className="pb-2 pt-3">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{herramienta.code}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(herramienta.status)}`}>
                    {herramienta.status}
                  </span>
                </div>
                <CardTitle className="text-lg mt-2 line-clamp-1">{herramienta.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{herramienta.brand || 'Sin marca'}</p>
              </CardHeader>
              <CardContent className="text-sm pb-2">
                <div className="flex items-center text-muted-foreground">
                  <span className="mr-1 text-pink-500 text-xs">&#9679;</span>
                  <span className="line-clamp-1">{herramienta.obras?.name || 'Ubicación desconocida'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredHerramientas.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <Wrench className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No hay resultados</h3>
              <p className="mt-1 text-gray-500">Prueba con otra búsqueda o agrega una herramienta.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
