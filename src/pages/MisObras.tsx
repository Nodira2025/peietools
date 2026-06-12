import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Building2, Wrench, Users, MapPin, ChevronRight, Search, HardHat, Camera, Image, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import FilterBar from '../components/FilterBar';
import { compressImage } from '../lib/imageUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Obra {
  id: string;
  name: string;
  address: string;
  encargado_name: string | null;
  active: boolean;
  photo_url?: string | null;
  toolCount?: number;
  empCount?: number;
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

  // States for main photo and progress photos
  const [avances, setAvances] = useState<any[]>([]);
  const [uploadingAvance, setUploadingAvance] = useState(false);
  const [avanceDescription, setAvanceDescription] = useState('');
  const [isAvanceDialogOpen, setIsAvanceDialogOpen] = useState(false);
  const mainPhotoInputRef = useRef<HTMLInputElement>(null);
  const avancePhotoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMainPhoto, setUploadingMainPhoto] = useState(false);

  useEffect(() => {
    fetchObras();
  }, []);

  const fetchObras = async () => {
    setLoading(true);
    const { data: obrasData, error } = await supabase
      .from('obras')
      .select('id, name, address, encargado_name, active, photo_url')
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
        toolCount,
        empCount,
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

  const fetchAvances = async (obraId: string) => {
    const { data } = await supabase
      .from('obra_avances_fotos')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false });
    setAvances(data || []);
  };

  const selectObra = async (obra: Obra) => {
    setSelectedObra(obra);
    fetchAvances(obra.id);

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
        <div className="relative bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 flex flex-col md:flex-row">
          {/* Foto Principal */}
          <div className="relative w-full md:w-64 h-48 md:h-auto bg-slate-50 border-r border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
            {selectedObra.photo_url ? (
              <img src={selectedObra.photo_url} alt={selectedObra.name} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-slate-300 p-4 flex flex-col items-center">
                <Image className="h-12 w-12 stroke-[1.2] mb-1.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Sin foto de portada</span>
              </div>
            )}
            {/* Botón flotante para subir foto */}
            <button 
              onClick={() => mainPhotoInputRef.current?.click()}
              disabled={uploadingMainPhoto}
              className="absolute bottom-3 right-3 bg-peie-blue text-white rounded-full p-2.5 shadow-lg hover:bg-peie-blue/90 active:scale-95 transition-all"
            >
              {uploadingMainPhoto ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input 
              type="file" 
              ref={mainPhotoInputRef} 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !selectedObra) return;
                setUploadingMainPhoto(true);
                try {
                  const compressed = await compressImage(file);
                  const { error } = await supabase
                    .from('obras')
                    .update({ photo_url: compressed })
                    .eq('id', selectedObra.id);
                  if (error) {
                    toast({ variant: 'destructive', title: 'Error', description: error.message });
                  } else {
                    toast({ title: '¡Foto Actualizada!', description: 'La foto principal de la obra fue cargada.' });
                    setSelectedObra(prev => prev ? { ...prev, photo_url: compressed } : null);
                    fetchObras();
                  }
                } catch {
                  toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
                }
                setUploadingMainPhoto(false);
              }}
            />
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <h1 className="text-xl font-black text-slate-800">{selectedObra.name}</h1>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0" /> {selectedObra.address || 'Sin dirección'}
              </p>
              {selectedObra.encargado_name && (
                <p className="text-sm text-slate-600 flex items-center gap-1.5 pt-0.5">
                  <HardHat className="h-4 w-4 text-slate-500 shrink-0" /> Encargado: <strong>{selectedObra.encargado_name}</strong>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-2xl font-black text-peie-blue">{herramientas.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Herramientas</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-2xl font-black text-peie-blue">{empleados.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Personal</p>
              </div>
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
                  <div className="flex items-center gap-2 pr-3 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${getStatusColor(h.status)}`}>
                      {h.status}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold h-9 px-3 rounded-lg border border-rose-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        releaseHerramienta(h.id);
                      }}
                    >
                      Liberar
                    </Button>
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
            <div className="grid grid-cols-1 gap-2.5">
              {empleados.map(emp => (
                <Card
                  key={emp.id}
                  className="rounded-xl border border-slate-200/80 overflow-hidden hover:shadow-md transition-all bg-white"
                >
                  <CardContent className="p-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-peie-blue/5 shrink-0 flex items-center justify-center border-r border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-peie-blue/10 flex items-center justify-center shrink-0">
                          <HardHat className="h-4.5 w-4.5 text-peie-blue" />
                        </div>
                      </div>
                      <div className="py-2">
                        <p className="font-bold text-sm text-slate-800">{emp.full_name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Operario Activo</p>
                      </div>
                    </div>
                    
                    <div className="pr-4 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold h-9 px-3 rounded-lg border border-rose-100"
                        onClick={() => releaseEmpleado(emp.id)}
                      >
                        Liberar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Registro de Avances Fotográficos */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Image className="h-4 w-4" /> Registro de Avances Fotográficos
            </h2>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsAvanceDialogOpen(true)}
              className="text-peie-blue border-peie-blue/20 hover:bg-peie-blue/5 rounded-xl h-8 text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Registrar Avance
            </Button>
          </div>

          {avances.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center">
              <Image className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No hay fotografías de avance en esta obra</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {avances.map(a => (
                <div key={a.id} className="relative group bg-white border border-slate-150 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
                  <div className="relative h-28 w-full bg-slate-50 overflow-hidden">
                    <img src={a.photo_url} alt="Avance" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    <button 
                      onClick={async () => {
                        if (!window.confirm('¿Eliminar esta fotografía de avance?')) return;
                        const { error } = await supabase.from('obra_avances_fotos').delete().eq('id', a.id);
                        if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
                        else {
                          toast({ title: 'Éxito', description: 'Foto de avance eliminada.' });
                          fetchAvances(selectedObra.id);
                        }
                      }}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs text-slate-700 font-medium line-clamp-2">{a.description || 'Sin descripción'}</p>
                    <p className="text-[9px] text-slate-405">{new Date(a.created_at).toLocaleDateString('es-AR')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dialog para Nuevo Avance Fotográfico */}
        <Dialog open={isAvanceDialogOpen} onOpenChange={setIsAvanceDialogOpen}>
          <DialogContent className="rounded-3xl w-[95%] max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Avance Fotográfico</DialogTitle>
              <CardDescription>
                Tomá una foto o subila de tu galería y agregá una descripción breve.
              </CardDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2 text-center">
                <Button 
                  type="button"
                  onClick={() => avancePhotoInputRef.current?.click()}
                  className="w-full h-24 rounded-2xl border-2 border-dashed border-slate-200 hover:border-peie-blue bg-slate-50/50 hover:bg-peie-blue/5 text-slate-500 hover:text-peie-blue transition-all flex flex-col items-center justify-center gap-2"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-xs font-bold">Tomar / Subir fotografía</span>
                </Button>
                <input 
                  type="file" 
                  ref={avancePhotoInputRef} 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingAvance(true);
                    try {
                      const compressed = await compressImage(file);
                      // Creamos un avance temporal con la foto para subirlo después
                      (window as any)._tempAvancePhoto = compressed;
                      toast({ title: 'Foto cargada', description: 'Escribí una descripción y hacé clic en Guardar.' });
                    } catch {
                      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
                    }
                    setUploadingAvance(false);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="avanceDesc" className="text-xs font-bold text-slate-650">Descripción del Avance</Label>
                <Input 
                  id="avanceDesc"
                  placeholder="Ej: Canalización del primer piso completada..."
                  value={avanceDescription}
                  onChange={e => setAvanceDescription(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>
            </div>
            <DialogFooter className="flex-row gap-2">
              <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => { setIsAvanceDialogOpen(false); setAvanceDescription(''); (window as any)._tempAvancePhoto = null; }}>Cancelar</Button>
              <Button 
                disabled={uploadingAvance}
                onClick={async () => {
                  const photo = (window as any)._tempAvancePhoto;
                  if (!photo) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Debes capturar una fotografía primero.' });
                    return;
                  }
                  setUploadingAvance(true);
                  const { error } = await supabase.from('obra_avances_fotos').insert([{
                    obra_id: selectedObra.id,
                    photo_url: photo,
                    description: avanceDescription.trim() || null
                  }]);
                  setUploadingAvance(false);
                  if (error) {
                    toast({ variant: 'destructive', title: 'Error', description: error.message });
                  } else {
                    toast({ title: '¡Avance Guardado!', description: 'Se registró la foto en el avance histórico.' });
                    setIsAvanceDialogOpen(false);
                    setAvanceDescription('');
                    (window as any)._tempAvancePhoto = null;
                    fetchAvances(selectedObra.id);
                  }
                }}
                className="flex-1 bg-peie-blue hover:bg-peie-blue/90 text-white font-bold rounded-xl"
              >
                {uploadingAvance ? 'Guardando...' : 'Registrar Avance'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-600 font-medium border border-slate-200/80">
                      <Wrench className="h-3 w-3 text-slate-400" />
                      {obra.toolCount || 0} Herramientas
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-600 font-medium border border-slate-200/80">
                      <HardHat className="h-3 w-3 text-slate-400" />
                      {obra.empCount || 0} Personal
                    </span>
                  </div>
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
