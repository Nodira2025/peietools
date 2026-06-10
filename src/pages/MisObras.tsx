import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Building2, Wrench, Users, MapPin, ChevronRight, Search, User, HardHat } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import FilterBar from '../components/FilterBar';

interface Obra {
  id: string;
  name: string;
  address: string;
  encargado_name: string | null;
  active: boolean;
  isDinamicaActiva?: boolean;
}

interface Herramienta {
  id: string;
  name: string;
  code: string;
  brand: string | null;
  status: string;
  photo_url: string | null;
}

interface Empleado {
  id: string;
  full_name: string;
}

export default function MisObras() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const isSpecialRole = profile?.role === 'admin' || profile?.role === 'logistica';
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEncargado, setFilterEncargado] = useState('');
  const [filterActive, setFilterActive] = useState('true');
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    fetchObras();
  }, []);

  const fetchObras = async () => {
    setLoading(true);
    const { data: obrasData, error } = await supabase
      .from('obras')
      .select('id, name, address, encargado_name, active')
      .order('name');
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setLoading(false);
      return;
    }

    // Obtener counts de herramientas y empleados
    const { data: toolsData } = await supabase.from('herramientas').select('current_obra_id');
    const { data: empsData } = await supabase.from('empleados').select('obra_id').eq('active', true);

    const toolsMap = (toolsData || []).reduce((acc: any, t: any) => {
      if (t.current_obra_id) acc[t.current_obra_id] = (acc[t.current_obra_id] || 0) + 1;
      return acc;
    }, {});

    const empsMap = (empsData || []).reduce((acc: any, e: any) => {
      if (e.obra_id) acc[e.obra_id] = (acc[e.obra_id] || 0) + 1;
      return acc;
    }, {});

    const processedObras = (obrasData || []).map((o: any) => {
      const toolCount = toolsMap[o.id] || 0;
      const empCount = empsMap[o.id] || 0;
      const hasManager = !!o.encargado_name && o.encargado_name.trim() !== '';
      const hasAssets = toolCount > 0 || empCount > 0;
      const isDinamicaActiva = hasManager && hasAssets;

      return {
        ...o,
        isDinamicaActiva
      };
    });

    // Si no es admin ni logistica, pre-filtrar en cliente con tolerancia a abreviaciones y nombres parciales
    const filteredByRole = isSpecialRole ? processedObras : processedObras.filter(o => {
      if (!profile) return false;
      if (profile.obra_id === o.id) return true;
      if (!profile.full_name) return false;

      const userFullName = profile.full_name.toLowerCase().trim();
      const managerName = (o.encargado_name || '').toLowerCase().trim();

      if (!managerName) return false;

      // Comparación por partes de nombre (ej. "Martin" en "Martin Grande")
      const userParts = userFullName.split(/\s+/);
      const managerParts = managerName.split(/\s+/);

      const cleanName = (n: string) => n.replace(/h/g, ''); // Normaliza "Christian" y "Cristian" removiendo la "h"

      const firstNameMatch = userParts[0] === managerParts[0] || 
                             userParts[0].startsWith(managerParts[0]) || 
                             managerParts[0].startsWith(userParts[0]) ||
                             cleanName(userParts[0]) === cleanName(managerParts[0]);

      return firstNameMatch || userFullName.includes(managerName) || managerName.includes(userFullName);
    });

    setObras(filteredByRole);
    setLoading(false);
  };

  const selectObra = async (obra: Obra) => {
    setSelectedObra(obra);

    // Herramientas en esta obra
    const { data: tools } = await supabase
      .from('herramientas')
      .select('id, name, code, brand, status, photo_url')
      .eq('current_obra_id', obra.id)
      .order('name');
    setHerramientas(tools || []);

    // Empleados asignados a esta obra
    const { data: emps } = await supabase
      .from('empleados')
      .select('id, full_name')
      .eq('obra_id', obra.id)
      .eq('active', true)
      .order('full_name');
    setEmpleados(emps || []);
  };

  const releaseHerramienta = async (hId: string) => {
    if (!window.confirm('¿Liberar esta herramienta de la obra? Volverá al depósito virtual.')) return;
    const { error } = await supabase.from('herramientas').update({ current_obra_id: null }).eq('id', hId);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else {
      toast({ title: 'Liberada', description: 'La herramienta ya no pertenece a esta obra.' });
      if (selectedObra) selectObra(selectedObra);
    }
  };

  const releaseEmpleado = async (eId: string) => {
    if (!window.confirm('¿Liberar este empleado de la obra? Quedará disponible para nuevos traslados.')) return;
    const { error } = await supabase.from('empleados').update({ obra_id: null }).eq('id', eId);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else {
      toast({ title: 'Liberado', description: 'El empleado ya no pertenece a esta obra.' });
      if (selectedObra) selectObra(selectedObra);
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Disponible': return 'bg-green-100 text-green-700 border-green-200';
      case 'En uso': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Reservada': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'En traslado': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Fuera de servicio': return 'bg-red-100 text-red-700 border-red-200';
      case 'En mantenimiento': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredObras = obras.filter(o => {
    const matchSearch = !search || 
      o.name.toLowerCase().includes(search.toLowerCase()) || 
      (o.address || '').toLowerCase().includes(search.toLowerCase()) || 
      (o.encargado_name || '').toLowerCase().includes(search.toLowerCase());
    
    const matchEncargado = !filterEncargado || o.encargado_name === filterEncargado;
    const matchActive = !filterActive || (filterActive === 'true' ? o.active : !o.active);
    
    return matchSearch && matchEncargado && matchActive;
  });

  const encargadosUnicos = [...new Set(obras.map(o => o.encargado_name).filter(Boolean))].sort();

  // Vista de detalle de obra seleccionada
  if (selectedObra) {
    return (
      <div className="space-y-5 pb-safe">
        {/* Header con boton volver */}
        <button
          onClick={() => setSelectedObra(null)}
          className="flex items-center gap-1.5 text-sm text-peie-blue font-semibold hover:underline"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Volver a obras
        </button>

        {/* Info de la obra */}
        <div className="bg-gradient-to-r from-peie-blue to-peie-light rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <Building2 className="h-8 w-8 mt-0.5 opacity-80" />
            <div>
              <h1 className="text-xl font-black">{selectedObra.name}</h1>
              <p className="text-sm text-white/80 flex items-center gap-1 mt-1">
                <MapPin className="h-3.5 w-3.5" /> {selectedObra.address || 'Sin direccion'}
              </p>
              {selectedObra.encargado_name && (
                <p className="text-sm text-white/90 flex items-center gap-1 mt-1">
                  <HardHat className="h-3.5 w-3.5" /> Encargado: <strong>{selectedObra.encargado_name}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Contadores */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-black">{herramientas.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/70">Herramientas</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-black">{empleados.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/70">Personal</p>
            </div>
          </div>
        </div>

        {/* Herramientas en esta obra */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="h-4 w-4" /> Herramientas en obra
          </h2>
          {herramientas.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center">
              <Wrench className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No hay herramientas asignadas a esta obra</p>
            </div>
          ) : (
            herramientas.map(h => (
              <Card
                key={h.id}
                className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all rounded-xl overflow-hidden"
                onClick={() => navigate('/herramientas/' + h.id)}
              >
                <CardContent className="p-0 flex items-center">
                  {/* Miniatura */}
                  <div className="w-16 h-16 bg-slate-100 shrink-0 flex items-center justify-center">
                    {h.photo_url ? (
                      <img src={h.photo_url} alt={h.name} className="w-full h-full object-cover" />
                    ) : (
                      <Wrench className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 px-3 py-2 min-w-0">
                    <p className="font-bold text-sm text-slate-800 truncate">{h.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">{h.code} {h.brand ? '- ' + h.brand : ''}</p>
                  </div>
                  <div className="pr-3 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${getStatusColor(h.status)}`}>
                      {h.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Personal asignado */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Personal asignado
          </h2>
          {empleados.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Sin personal asignado a esta obra</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {empleados.map(emp => (
                <div key={emp.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-peie-blue/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-peie-blue" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{emp.full_name}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] text-slate-400 hover:text-red-500 h-7"
                    onClick={() => releaseEmpleado(emp.id)}
                  >
                    Liberar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista principal: lista de obras
  return (
    <div className="space-y-5 pb-safe">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Obras</h1>
        <p className="text-sm text-muted-foreground mt-1">Herramientas y personal por obra</p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar obra, direccion o encargado..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      <FilterBar
        filters={[
          ...(isSpecialRole ? [{ key: 'encargado', label: 'Encargado', value: filterEncargado, options: encargadosUnicos.map(e => ({ value: e!, label: e! })) }] : []),
          { key: 'active', label: 'Estado', value: filterActive, options: [{ value: 'true', label: 'Activa' }, { value: 'false', label: 'Inactiva' }] }
        ]}
        onFilterChange={(key, val) => {
          if (key === 'encargado') setFilterEncargado(val);
          if (key === 'active') setFilterActive(val);
        }}
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando obras...</div>
      ) : (
        <div className="space-y-2">
          {filteredObras.slice(0, visibleCount).map(obra => (
            <Card
              key={obra.id}
              className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all rounded-xl"
              onClick={() => selectObra(obra)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-peie-blue/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-peie-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 truncate">{obra.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{obra.address || 'Sin direccion'}</p>
                  {obra.encargado_name && (
                    <p className="text-[10px] text-peie-blue font-semibold mt-0.5">Encargado: {obra.encargado_name}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
              </CardContent>
            </Card>
          ))}
          
          {visibleCount < filteredObras.length && (
            <Button 
              variant="ghost" 
              className="w-full py-6 text-peie-blue hover:bg-peie-blue/5 font-bold rounded-xl"
              onClick={() => setVisibleCount(prev => prev + 10)}
            >
              Ver más obras ({filteredObras.length - visibleCount} restantes)
            </Button>
          )}
          {filteredObras.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
              <Building2 className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No se encontraron obras</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
