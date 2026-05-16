import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { HardHat, Search, MapPin, ArrowRightLeft, Clock } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface Empleado {
  id: string;
  full_name: string;
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

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    
    // Fetch Empleados
    const { data: empData, error: empError } = await supabase
      .from('empleados')
      .select('id, full_name, obras(name)')
      .eq('active', true)
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

    setLoading(false);
  };

  const filteredEmpleados = empleados.filter(e =>
    !search || 
    e.full_name.toLowerCase().includes(search.toLowerCase()) || 
    (e.obras?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-safe">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Personal</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestión y traslado de electricistas</p>
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

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar empleado o por obra..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando personal...</div>
      ) : (
        <div className="space-y-2">
          {filteredEmpleados.map(emp => (
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="shrink-0 text-peie-blue border-peie-blue/30 hover:bg-peie-blue/5 h-8 px-3 text-xs rounded-lg"
                    onClick={() => navigate(`/personal/trasladar/${emp.id}`)}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Trasladar
                  </Button>
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
      )}
    </div>
  );
}
