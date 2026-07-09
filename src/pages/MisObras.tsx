import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Building2, Wrench, MapPin, ChevronRight, Search, HardHat, Camera, Image, Plus, Trash2, X } from 'lucide-react';
import { useAuthStore } from '../store/auth';
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
  status?: string;
  specialty?: string;
  photo_url?: string | null;
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
  // const mainPhotoInputRef = useRef<HTMLInputElement>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const avancePhotoInputRef = useRef<HTMLInputElement>(null);
  // const [uploadingMainPhoto, setUploadingMainPhoto] = useState(false);

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
      const hasAssets = toolCount > 0 && empCount > 0;
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
      .select('id, full_name, status, specialty, photo_url')
      .eq('obra_id', obra.id)
      .eq('active', true)
      .order('full_name');
    const mappedEmps = (emps || []).map((e: any) => ({
      ...e,
      status: e.status === 'Disponible' || e.status === 'Libre' ? 'Libre' : 'Trabajando'
    }));
    setEmpleados(mappedEmps);
  };

  const releaseHerramienta = async (hId: string) => {
    if (!window.confirm('¿Liberar esta herramienta de la obra? Volverá al depósito virtual.')) return;
    const { error } = await supabase.from('herramientas').update({ current_obra_id: null, status: 'Disponible' }).eq('id', hId);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else {
      toast({ title: 'Liberada', description: 'La herramienta ya no pertenece a esta obra.' });
      if (selectedObra) selectObra(selectedObra);
    }
  };

  const releaseEmpleado = async (eId: string) => {
    if (!window.confirm('¿Liberar este empleado de la obra? Quedará disponible para nuevos traslados.')) return;
    const { error } = await supabase.from('empleados').update({ obra_id: null, status: 'Libre' }).eq('id', eId);
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
  if (selectedObra) {
    return (
      <div className="space-y-6 pb-safe">
        {/* Header con boton volver */}
        <button
          onClick={() => setSelectedObra(null)}
          className="flex items-center gap-1.5 text-sm text-peie-blue font-semibold hover:underline"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Volver a obras
        </button>

        {/* Info de la obra en degradado premium */}
        <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white rounded-[24px] p-6 shadow-md overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full translate-x-8 -translate-y-8" />
          
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">{selectedObra.name}</h2>
                <p className="text-[10.5px] text-blue-100 font-medium flex items-center gap-1 mt-0.5">
                  <MapPin size={12} className="shrink-0" /> {selectedObra.address || 'Sin dirección'}
                </p>
                {selectedObra.encargado_name && (
                  <p className="text-[11px] text-blue-200 font-bold mt-1.5">
                    Coordinador: {selectedObra.encargado_name}
                  </p>
                )}
              </div>
            </div>
            
            <span className="text-[9px] font-black uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full border border-white/10 text-white shrink-0">
              {selectedObra.active ? 'Activa' : 'Pausada'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 border-t border-white/10 pt-4">
            <div className="text-center border-r border-white/10">
              <p className="text-2xl font-black text-white">{herramientas.length}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-blue-100">Herramientas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-white">{empleados.length}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-blue-100">Personal</p>
            </div>
          </div>
        </div>



        {/* Herramientas en esta obra */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-[#031530] uppercase tracking-wider">Herramientas en obra</h3>
            <button onClick={() => navigate('/herramientas')} className="text-xs font-bold text-blue-600 hover:underline">Ver todas</button>
          </div>
          
          {herramientas.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400">
              Sin herramientas asignadas a esta obra
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {herramientas.map(h => (
                <Card 
                  key={h.id} 
                  className="cursor-pointer hover:shadow-md active:scale-[0.98] transition-all rounded-2xl overflow-hidden border border-slate-100"
                  onClick={() => navigate('/herramientas/' + h.id)}
                >
                  <CardContent className="p-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-slate-100 shrink-0 flex items-center justify-center overflow-hidden">
                        {h.photo_url ? (
                          <img src={h.photo_url} alt={h.name} className="w-full h-full object-cover" />
                        ) : (
                          <Wrench className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 truncate">{h.name}</p>
                        <p className="text-[9px] font-mono text-slate-400 truncate">{h.code} {h.brand ? '· ' + h.brand : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pr-3 shrink-0">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getStatusColor(h.status)}`}>
                        {h.status}
                      </span>
                      {isSpecialRole && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); releaseHerramienta(h.id); }}
                          className="text-[10px] text-rose-500 font-bold hover:underline px-2"
                        >
                          Liberar
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Personal asignado */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-[#031530] uppercase tracking-wider">Personal asignado</h3>
            <button onClick={() => navigate('/personal')} className="text-xs font-bold text-blue-600 hover:underline">Ver todo</button>
          </div>

          {empleados.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400">
              Sin personal asignado a esta obra
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {empleados.map(emp => {
                const statusStyle = emp.status === 'Libre' ? 'bg-green-50 text-green-600 border-green-150' :
                                    'bg-indigo-50 text-indigo-600 border-indigo-150';

                return (
                  <Card key={emp.id} className="rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-all bg-white">
                    <CardContent className="p-0 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-slate-50 shrink-0 flex items-center justify-center overflow-hidden">
                          {emp.photo_url ? (
                            <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <HardHat className="h-5 w-5 text-slate-300" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-800">{emp.full_name}</p>
                          <p className="text-[9px] text-slate-450 font-semibold">{emp.specialty || 'Operario Activo'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pr-3 shrink-0">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statusStyle}`}>
                          {emp.status === 'Libre' ? 'Libre' : 'En Obra'}
                        </span>
                        {isSpecialRole && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); releaseEmpleado(emp.id); }}
                            className="text-[10px] text-rose-500 font-bold hover:underline px-2"
                          >
                            Liberar
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Registro de Avances Fotográficos */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-[#031530] uppercase tracking-wider flex items-center gap-1.5">
              <Image className="h-4 w-4" /> Registro de Avances Fotográficos
            </h3>
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
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400">
              No hay fotografías de avance en esta obra
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {avances.map(a => (
                <div key={a.id} className="relative group bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
                  <div className="relative h-28 w-full bg-slate-50 overflow-hidden">
                    <img 
                      src={a.photo_url} 
                      alt="Avance" 
                      className="w-full h-full object-cover hover:scale-105 cursor-zoom-in transition-transform duration-300" 
                      onClick={() => setPreviewPhotoUrl(a.photo_url)}
                    />
                    {isSpecialRole && (
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
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs text-slate-700 font-medium line-clamp-2">{a.description || 'Sin descripción'}</p>
                    <p className="text-[9px] text-slate-400">{new Date(a.created_at).toLocaleDateString('es-AR')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botones de acción inferiores */}
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          {isSpecialRole && (
            <Button 
              variant="outline" 
              className="flex-1 h-11 rounded-xl font-bold border-slate-200 text-slate-700"
              onClick={() => navigate('/obras')}
            >
              Editar Obra
            </Button>
          )}
          <Button 
            className="flex-1 h-11 rounded-xl font-bold bg-[#031530] hover:bg-[#031530]/90 text-white"
            onClick={() => navigate('/logistica')}
          >
            Ver Actividad
          </Button>
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
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingAvance(true);
                    try {
                      const compressed = await compressImage(file);
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
                <Label htmlFor="avanceDesc" className="text-xs font-bold text-slate-600">Descripción del Avance</Label>
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
  const userName = profile?.full_name?.split(' ')[0] || 'Usuario';

  return (
    <div className="space-y-5 pb-safe relative">
      <div>
        <h1 className="text-2xl font-black text-slate-800">Hola, {userName} 👋</h1>
        <p className="text-xs text-slate-400 font-semibold mt-1">Estas son tus obras</p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar obra, dirección o coordinador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl border-slate-200 shadow-sm"
        />
      </div>

      {/* Filtros de la cabecera */}
      <div className="flex flex-wrap items-center gap-2">
        {isSpecialRole && (
          <select 
            value={filterEncargado}
            onChange={e => setFilterEncargado(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none"
          >
            <option value="">Coordinador: Todos</option>
            {encargadosUnicos.map(e => <option key={e} value={e!}>{e}</option>)}
          </select>
        )}
        
        <select 
          value={filterActive}
          onChange={e => setFilterActive(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none"
        >
          <option value="true">Activa</option>
          <option value="false">Pausada</option>
          <option value="">Todas</option>
        </select>

        {(filterEncargado || filterActive !== 'true' || search) && (
          <button 
            onClick={() => { setFilterEncargado(''); setFilterActive('true'); setSearch(''); }}
            className="text-xs text-rose-500 font-black hover:underline px-2"
          >
            × Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando obras...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredObras.slice(0, visibleCount).map(obra => (
            <Card
              key={obra.id}
              className={`cursor-pointer hover:shadow-md active:scale-[0.99] transition-all rounded-2xl border border-slate-100 p-4 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${!obra.active ? 'opacity-65 grayscale bg-slate-50' : 'bg-white'}`}
              onClick={() => selectObra(obra)}
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-center">
                  <div className="min-w-0">
                    <p className="font-black text-sm text-[#031530] truncate">{obra.name}</p>
                    <p className="text-[10.5px] text-slate-400 font-semibold truncate mt-0.5">📍 {obra.address || 'Sin dirección'}</p>
                  </div>
                  
                  {obra.encargado_name ? (
                    <p className="text-xs text-slate-400 font-semibold">
                      Coordinador: <span className="text-[#031530] font-black">{obra.encargado_name}</span>
                    </p>
                  ) : (
                    <span className="text-xs text-slate-300 italic">Sin coordinador</span>
                  )}

                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500">
                      <Wrench className="h-4 w-4 text-slate-400" />
                      {obra.toolCount || 0} Herramientas
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500">
                      <HardHat className="h-4 w-4 text-slate-400" />
                      {obra.empCount || 0} Personal
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                <span className={`text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                  obra.active 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {obra.active ? 'Activa' : 'Pausada'}
                </span>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          ))}
          
          {visibleCount < filteredObras.length && (
            <Button 
              variant="ghost" 
              className="col-span-full py-6 text-peie-blue hover:bg-peie-blue/5 font-bold rounded-xl"
              onClick={() => setVisibleCount(prev => prev + 10)}
            >
              Ver más obras ({filteredObras.length - visibleCount} restantes)
            </Button>
          )}
          {filteredObras.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-[24px] border border-dashed border-slate-200">
              <Building2 className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No se encontraron obras</p>
            </div>
          )}
        </div>
      )}

      {/* Botón Flotante para Administradores en móvil */}
      {isSpecialRole && (
        <button
          onClick={() => navigate('/obras')}
          className="fixed bottom-24 right-5 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg active:scale-90 transition-all md:hidden"
          aria-label="Administrar Obras"
        >
          <Plus size={24} className="stroke-[3]" />
        </button>
      )}

      {/* Fullscreen Progress Photo Preview Modal */}
      {previewPhotoUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <button 
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white rounded-full p-2.5 shadow-lg border border-white/10"
            onClick={() => setPreviewPhotoUrl(null)}
          >
            <X size={24} />
          </button>
          
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewPhotoUrl} 
              alt="Avance de obra" 
              className="max-h-[80vh] w-auto max-w-full object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
