import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building, Plus, Trash2, Edit, Search, Power } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FilterBar from '../components/FilterBar';

interface Obra {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  encargado_name: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
}

export default function Obras() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'logistica';
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [capturingGPS, setCapturingGPS] = useState(false);

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Error', description: 'Tu navegador no soporta geolocalización.' });
      return;
    }
    setCapturingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setCapturingGPS(false);
        toast({ title: 'Éxito', description: 'Coordenadas capturadas con éxito.' });
      },
      (error) => {
        setCapturingGPS(false);
        toast({ variant: 'destructive', title: 'Error GPS', description: error.message });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [manager, setManager] = useState('');
  const [phone, setPhone] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [active, setActive] = useState(true);

  const fetchObras = async () => {
    try {
      setLoading(true);
      
      const [
        { data: obrasData, error: obrasError },
        { data: toolsData, error: toolsError },
        { data: empsData, error: empsError }
      ] = await Promise.all([
        supabase.from('obras').select('*').order('name'),
        supabase.from('herramientas').select('current_obra_id'),
        supabase.from('empleados').select('obra_id')
      ]);

      if (obrasError) throw obrasError;
      if (toolsError) throw toolsError;
      if (empsError) throw empsError;

      // Mapear cuántas herramientas tiene cada obra
      const toolsMap = (toolsData || []).reduce((acc: any, t: any) => {
        if (t.current_obra_id) acc[t.current_obra_id] = (acc[t.current_obra_id] || 0) + 1;
        return acc;
      }, {});

      // Mapear cuántos empleados tiene cada obra
      const empsMap = (empsData || []).reduce((acc: any, e: any) => {
        if (e.obra_id) acc[e.obra_id] = (acc[e.obra_id] || 0) + 1;
        return acc;
      }, {});

      // Si es admin, mostrar todas. Si no es admin, mostrar solo las dinámicamente activas (con herramientas y personal)
      const filteredData = (obrasData || []).filter(o => {
        if (isAdmin) {
          return true; // Los administradores ven todas las obras
        }
        const hasManager = o.encargado_name && o.encargado_name.trim() !== '';
        const hasTools = (toolsMap[o.id] || 0) > 0;
        const hasPersonnel = (empsMap[o.id] || 0) > 0;
        return o.active && hasManager && hasTools && hasPersonnel;
      });

      setObras(filteredData);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las obras' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObras();
  }, [profile]);

  const resetForm = () => {
    setCode(''); setName(''); setAddress(''); setManager(''); setPhone(''); 
    setLatitude(''); setLongitude(''); setActive(true);
    setIsEditing(false);
    setCurrentId(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (obra: Obra) => {
    setCode(obra.code || '');
    setName(obra.name);
    setAddress(obra.address || '');
    setManager(obra.encargado_name || '');
    setPhone(obra.phone || '');
    setLatitude(obra.latitude ? obra.latitude.toString() : '');
    setLongitude(obra.longitude ? obra.longitude.toString() : '');
    setActive(obra.active !== false);
    setCurrentId(obra.id);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
      code: code || null, 
      name, 
      address, 
      encargado_name: manager, 
      phone,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      active
    };

    let error;
    if (isEditing && currentId) {
      const { error: updateError } = await supabase.from('obras').update(payload).eq('id', currentId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('obras').insert([payload]);
      error = insertError;
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Éxito', description: isEditing ? 'Obra actualizada correctamente' : 'Obra creada correctamente' });
      setIsDialogOpen(false);
      resetForm();
      fetchObras();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta obra?')) return;
    const { error } = await supabase.from('obras').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Éxito', description: 'Obra eliminada correctamente' });
      fetchObras();
    }
  };

  const handleToggleActive = async (obra: Obra) => {
    const newActiveState = !obra.active;
    const confirmMessage = newActiveState 
      ? `¿Estás seguro de que deseas ACTIVAR la obra "${obra.name}"?`
      : `¿Estás seguro de que deseas DESACTIVAR la obra "${obra.name}"?`;
      
    if (!window.confirm(confirmMessage)) return;

    const { error } = await supabase
      .from('obras')
      .update({ active: newActiveState })
      .eq('id', obra.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ 
        title: 'Éxito', 
        description: `Obra ${newActiveState ? 'activada' : 'desactivada'} correctamente.` 
      });
      fetchObras();
    }
  };

  const filteredObras = obras.filter(o => {
    const matchSearch = !searchTerm || 
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (o.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.code || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchManager = !filterManager || o.encargado_name === filterManager;
    const matchActive = !filterActive || (filterActive === 'true' ? o.active : !o.active);
    
    return matchSearch && matchManager && matchActive;
  });

  const encargadosUnicos = [...new Set(obras.map(o => o.encargado_name).filter(Boolean))].sort().map(e => ({ value: e!, label: e! }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-peie-blue">Gestión de Obras</h1>
          <p className="text-muted-foreground">Administra las obras y depósitos de la empresa.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <Button className="bg-peie-blue hover:bg-peie-blue/90 w-full sm:w-auto" onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" /> Nueva Obra
          </Button>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Editar Obra' : 'Agregar Nueva Obra'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código (Opcional)</Label>
                  <Input id="code" value={code} onChange={e => setCode(e.target.value)} placeholder="Ej: OB-01" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager">Coordinador</Label>
                <Input id="manager" value={manager} onChange={e => setManager(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="flex justify-between items-center pt-2">
                <Label className="text-xs font-semibold text-slate-700">Coordenadas Geográficas</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCaptureGPS} 
                  disabled={capturingGPS}
                  className="h-8 text-peie-blue border-peie-blue/20 hover:bg-peie-blue/5 rounded-xl text-xs"
                >
                  {capturingGPS ? 'Buscando GPS...' : 'Capturar GPS Actual'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitud (GPS)</Label>
                  <Input id="latitude" type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitud (GPS)</Label>
                  <Input id="longitude" type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <input 
                  type="checkbox" 
                  id="active" 
                  checked={active} 
                  onChange={e => setActive(e.target.checked)} 
                  className="rounded border-gray-300 text-peie-blue focus:ring-peie-blue"
                />
                <Label htmlFor="active" className="font-normal cursor-pointer">Obra Activa</Label>
              </div>
              <Button type="submit" className="w-full bg-peie-blue hover:bg-peie-blue/90">
                {isEditing ? 'Guardar Cambios' : 'Crear Obra'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nombre, código o dirección..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        
        <FilterBar
          filters={[
            { key: 'manager', label: 'Coordinador', value: filterManager, options: encargadosUnicos },
            { key: 'active', label: 'Estado', value: filterActive, options: [{ value: 'true', label: 'Activa' }, { value: 'false', label: 'Inactiva' }] },
          ]}
          onFilterChange={(key, val) => {
            if (key === 'manager') setFilterManager(val);
            if (key === 'active') setFilterActive(val);
          }}
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando obras...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredObras.map(obra => (
            <Card key={obra.id} className={`relative group transition-all duration-200 hover:shadow-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${!obra.active ? 'opacity-65 grayscale bg-slate-50' : 'bg-white'}`}>
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="p-3 bg-peie-light/10 rounded-2xl text-peie-blue shrink-0">
                  <Building className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-slate-800 truncate leading-snug">{obra.name}</CardTitle>
                      {obra.code && <span className="text-[10px] font-mono bg-slate-100 border px-1.5 py-0.5 rounded text-slate-500 shrink-0">{obra.code}</span>}
                    </div>
                    <p className="text-xs text-slate-400 font-semibold truncate mt-1 flex items-center gap-1">📍 {obra.address || 'Sin dirección'}</p>
                  </div>
                  
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold"><strong className="text-slate-400 font-medium">Coordinador:</strong> {obra.encargado_name || 'Sin coordinador'}</p>
                    <p className="mt-0.5"><strong className="text-slate-400 font-medium">Teléfono:</strong> {obra.phone || 'Sin teléfono'}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {obra.latitude && obra.longitude ? (
                      <a 
                        href={`https://www.google.com/maps?q=${obra.latitude},${obra.longitude}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-1.5"
                      >
                        🗺️ Maps
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300 italic">Sin ubicación</span>
                    )}
                    {obra.active ? (
                      <span className="text-[10px] font-black bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full">Activa</span>
                    ) : (
                      <span className="text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-full">Inactiva</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end md:self-auto border-t md:border-t-0 pt-2.5 md:pt-0 w-full md:w-auto justify-end">
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-9 w-9 rounded-xl ${obra.active ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100 hover:text-green-600'}`}
                    onClick={() => handleToggleActive(obra)}
                    title={obra.active ? 'Desactivar Obra' : 'Activar Obra'}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-peie-blue"
                  onClick={() => handleOpenEdit(obra)}
                  title="Editar Obra"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-50"
                  onClick={() => handleDelete(obra.id)}
                  title="Eliminar Obra"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          {obras.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <Building className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No hay obras</h3>
              <p className="mt-1 text-gray-500">Comienza creando tu primera obra o depósito.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
