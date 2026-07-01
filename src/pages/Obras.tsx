import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building, Plus, Trash2, Edit, Search } from 'lucide-react';
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

      // Mostrar únicamente las obras activas con encargado asignado, herramientas y personal
      const activeObrasWithAssets = (obrasData || []).filter(o => {
        const hasManager = o.encargado_name && o.encargado_name.trim() !== '';
        const hasTools = (toolsMap[o.id] || 0) > 0;
        const hasPersonnel = (empsMap[o.id] || 0) > 0;
        return o.active && hasManager && hasTools && hasPersonnel;
      });

      setObras(activeObrasWithAssets);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las obras' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObras();
  }, []);

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
            { key: 'active', label: 'Estado', value: filterActive, options: [{ value: 'true', label: 'En proceso' }, { value: 'false', label: 'Finalizado' }] },
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredObras.map(obra => (
            <Card key={obra.id} className={`relative group ${!obra.active ? 'opacity-60 grayscale' : ''}`}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-peie-light/10 rounded-md">
                    <Building className="h-5 w-5 text-peie-blue" />
                  </div>
                  <div>
                    <CardTitle className="text-lg line-clamp-1">{obra.name}</CardTitle>
                    {obra.code && <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{obra.code}</span>}
                  </div>
                </div>
                <div className="flex gap-1 -mr-2 -mt-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-peie-blue"
                    onClick={() => handleOpenEdit(obra)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(obra.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1 mt-2 text-muted-foreground">
                <p><strong>📍</strong> {obra.address || 'Sin dirección'}</p>
                <p><strong>👤</strong> {obra.encargado_name || 'Sin coordinador'}</p>
                <p><strong>📞</strong> {obra.phone || 'Sin teléfono'}</p>
                {obra.latitude && obra.longitude && (
                  <div className="pt-2">
                    <a 
                      href={`https://www.google.com/maps?q=${obra.latitude},${obra.longitude}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center text-xs text-blue-600 hover:underline font-semibold"
                    >
                      🗺️ Ver en Google Maps
                    </a>
                  </div>
                )}
                {!obra.active && <p className="text-red-500 font-semibold mt-2">Inactiva</p>}
              </CardContent>
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
