import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { HardHat, Search, MapPin, ArrowRightLeft, Clock, Camera } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import FilterBar from '../components/FilterBar';
import { compressImage } from '../lib/imageUtils';

interface Empleado {
  id: string;
  full_name: string;
  obra_id: string | null;
  status: 'Disponible' | 'En traslado' | 'Trabajando' | 'Libre';
  specialty: string | null;
  photo_url: string | null;
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
  const [filterType, setFilterType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'staff' | 'history'>('staff');
  const [historial, setHistorial] = useState<any[]>([]);
  const [filterObra, setFilterObra] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  
  // Opciones para filtros
  const [obrasOpciones, setObrasOpciones] = useState<{value: string, label: string}[]>([]);
  const [managersOpciones, setManagersOpciones] = useState<{value: string, label: string}[]>([]);
  const [specialtiesOpciones, setSpecialtiesOpciones] = useState<{value: string, label: string}[]>([]);

  // Camera file upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'logistica';

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    
    // Fetch Empleados
    const { data: empData, error: empError } = await supabase
      .from('empleados')
      .select('id, full_name, obra_id, status, specialty, photo_url, obras:obra_id(name)')
      .order('full_name');
      
    if (empError) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el personal' });
    } else {
      const dataWithDefaults = (empData || []).map((e: any) => ({
        id: e.id,
        full_name: e.full_name,
        obra_id: e.obra_id,
        status: e.status || (e.obra_id ? 'Trabajando' : 'Disponible'),
        specialty: e.specialty || 'Electricista',
        photo_url: e.photo_url,
        obras: Array.isArray(e.obras) ? e.obras[0] : e.obras
      }));
      setEmpleados(dataWithDefaults as Empleado[]);
      
      const uniqueSpecs = [...new Set(dataWithDefaults.map(e => e.specialty))].sort();
      setSpecialtiesOpciones(uniqueSpecs.map(s => ({ value: s, label: s })));
    }

    // Fetch Traslados Pendientes donde la obra destino es la del usuario
    if (profile.obra_id) {
      const { data: trasData } = await supabase
        .from('traslados_personal')
        .select('id, status, empleados(full_name), source_obra:obras!traslados_personal_source_obra_id_fkey(name)')
        .eq('target_obra_id', profile.obra_id)
        .eq('status', 'Pendiente');
      
      const mappedTrasData = (trasData || []).map((t: any) => ({
        id: t.id,
        status: t.status,
        empleados: Array.isArray(t.empleados) ? t.empleados[0] : t.empleados,
        source_obra: Array.isArray(t.source_obra) ? t.source_obra[0] : t.source_obra
      }));
      setTrasladosPendientes(mappedTrasData as TrasladoPendiente[]);
    }

    // Fetch Historial de movimientos
    let query = supabase
      .from('traslados_personal')
      .select(`
        id, status, created_at,
        empleados(full_name),
        source_obra:obras!traslados_personal_source_obra_id_fkey(name),
        target_obra:obras!traslados_personal_target_obra_id_fkey(name)
      `)
      .order('created_at', { ascending: false });
      
    if (!isAdmin && profile.obra_id) {
      query = query.or(`source_obra_id.eq.${profile.obra_id},target_obra_id.eq.${profile.obra_id}`);
    }
    const { data: histData } = await query;
    if (histData) {
      const mappedHistData = histData.map((h: any) => ({
        id: h.id,
        status: h.status,
        created_at: h.created_at,
        empleados: Array.isArray(h.empleados) ? h.empleados[0] : h.empleados,
        source_obra: Array.isArray(h.source_obra) ? h.source_obra[0] : h.source_obra,
        target_obra: Array.isArray(h.target_obra) ? h.target_obra[0] : h.target_obra
      }));
      setHistorial(mappedHistData);
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
    const { error } = await supabase
      .from('empleados')
      .update({ 
        obra_id: null,
        status: 'Disponible'
      })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Empleado Liberado', description: 'Ahora se encuentra en estado Disponible.' });
      fetchData();
    }
  };

  const filteredEmpleados = empleados.filter(e => {
    const matchesSearch = !search || 
      e.full_name.toLowerCase().includes(search.toLowerCase()) || 
      (e.obras?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.specialty || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesObra = !filterObra || e.obra_id === filterObra;
    const matchesSpecialty = !filterSpecialty || e.specialty === filterSpecialty;
    
    const computedStatus = e.status || (e.obra_id ? 'Trabajando' : 'Disponible');
    const matchesStatus = filterType === 'all' || computedStatus === filterType;
    
    return matchesSearch && matchesObra && matchesSpecialty && matchesStatus;
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
            placeholder="Buscar empleado por nombre, obra o especialidad..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl border-slate-200 shadow-sm focus:ring-peie-blue/20"
          />
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'Disponible', label: 'Disponible' },
            { value: 'En traslado', label: 'En traslado' },
            { value: 'Trabajando', label: 'Trabajando' },
            { value: 'Libre', label: 'Libre' }
          ].map(opt => (
            <Button 
              key={opt.value}
              variant={filterType === opt.value ? 'default' : 'ghost'} 
              onClick={() => setFilterType(opt.value)}
              className={`flex-1 min-w-[70px] rounded-lg text-xs h-9 ${
                filterType === opt.value 
                  ? 'bg-peie-blue shadow-sm text-white' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <FilterBar
          filters={[
            { key: 'obra', label: 'Obra', value: filterObra, options: obrasOpciones },
            { key: 'manager', label: 'Encargado', value: filterManager, options: managersOpciones },
            { key: 'specialty', label: 'Especialidad', value: filterSpecialty, options: specialtiesOpciones },
          ]}
          onFilterChange={(key, val) => {
            if (key === 'obra') setFilterObra(val);
            if (key === 'manager') setFilterManager(val);
            if (key === 'specialty') setFilterSpecialty(val);
          }}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando personal...</div>
      ) : activeTab === 'staff' ? (
        <div className="space-y-3">
          {filteredEmpleados.map(emp => {
            const statusStyle = emp.status === 'Disponible' ? 'bg-green-100 text-green-800 border-green-200' :
                                emp.status === 'En traslado' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                emp.status === 'Trabajando' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                'bg-slate-100 text-slate-800 border-slate-200';
            return (
              <Card key={emp.id} className="overflow-hidden rounded-2xl border-slate-150 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* AVATAR DE PERSONAL con Carga de Foto para Admin */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-peie-blue/5 border border-slate-200 flex items-center justify-center">
                        {emp.photo_url ? (
                          <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <HardHat className="h-6 w-6 text-peie-blue/40" />
                        )}
                      </div>
                      {isAdmin && (
                        <button 
                          onClick={() => { setSelectedEmpId(emp.id); fileInputRef.current?.click(); }}
                          className="absolute -bottom-1 -right-1 bg-peie-blue text-white rounded-full p-1 shadow hover:bg-peie-blue/90 border border-white"
                        >
                          <Camera className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-slate-800 truncate">{emp.full_name}</p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusStyle}`}>
                          {emp.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        {emp.specialty || 'Electricista'}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 truncate">
                        <MapPin className="h-3 w-3 text-slate-400" /> {emp.obras?.name || 'Sin obra asignada'}
                      </p>
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      {emp.obra_id && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-slate-400 hover:text-red-500 h-9 px-2 text-xs rounded-xl"
                          onClick={() => handleRelease(emp.id)}
                        >
                          Liberar
                        </Button>
                      )}
                      {(emp.status === 'Disponible' || emp.status === 'Libre') && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-peie-blue border-peie-blue/30 hover:bg-peie-blue/5 h-9 px-3 text-xs font-bold rounded-xl"
                          onClick={() => navigate(`/personal/trasladar/${emp.id}`)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Trasladar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredEmpleados.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <HardHat className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-500">No hay operarios en esta categoría</p>
              <p className="text-xs text-slate-400 mt-1">Intente remover o cambiar los filtros de búsqueda.</p>
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

      {/* Hidden File Input for Avatar Uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !selectedEmpId) return;
          try {
            const compressed = await compressImage(file);
            const { error } = await supabase
              .from('empleados')
              .update({ photo_url: compressed })
              .eq('id', selectedEmpId);
            if (error) {
              toast({ variant: 'destructive', title: 'Error', description: error.message });
            } else {
              toast({ title: '¡Foto Actualizada!', description: 'La imagen del empleado fue guardada correctamente.' });
              fetchData();
            }
          } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
