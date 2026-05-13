import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building, Plus, Trash2, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Obra {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  manager_name: string | null;
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
    setLoading(true);
    const { data, error } = await supabase.from('obras').select('*').order('name');
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las obras' });
    } else {
      setObras(data || []);
    }
    setLoading(false);
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
    setManager(obra.manager_name || '');
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
      manager_name: manager, 
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
    if (!window.confirm('¿Seguro que deseas eliminar esta obra? Alternativamente, puedes editarla y marcarla como inactiva.')) return;
    
    const { error } = await supabase.from('obras').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se puede eliminar, puede que tenga herramientas asignadas.' });
    } else {
      toast({ title: 'Eliminada', description: 'Obra eliminada.' });
      fetchObras();
    }
  };

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
                <Label htmlFor="manager">Encargado</Label>
                <Input id="manager" value={manager} onChange={e => setManager(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} />
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

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando obras...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {obras.map(obra => (
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
                <p><strong>👤</strong> {obra.manager_name || 'Sin encargado'}</p>
                <p><strong>📞</strong> {obra.phone || 'Sin teléfono'}</p>
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
