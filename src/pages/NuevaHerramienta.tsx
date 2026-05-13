import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface Obra {
  id: string;
  name: string;
}

export default function NuevaHerramienta() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  
  const [obras, setObras] = useState<Obra[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [currentObraId, setCurrentObraId] = useState('');
  const [loading, setLoading] = useState(false);

  // Solo Admin y Logística pueden crear herramientas
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'logistica';

  useEffect(() => {
    async function fetchObras() {
      const { data } = await supabase.from('obras').select('id, name').eq('active', true).order('name');
      if (data) setObras(data);
    }
    fetchObras();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !currentObraId) {
      toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Por favor completa el código, nombre y la obra asignada.' });
      return;
    }

    setLoading(true);
    // qr_code se asigna igual al código como identificador único inicial
    const { data, error } = await supabase.from('herramientas').insert([{
      code: code.toUpperCase().trim(),
      qr_code: code.toUpperCase().trim(),
      name: name.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      description: description.trim() || null,
      status: 'Disponible',
      current_obra_id: currentObraId
    }]).select().single();

    setLoading(false);

    if (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Error al guardar', 
        description: error.code === '23505' ? 'Ya existe una herramienta con ese código.' : error.message 
      });
    } else {
      toast({ title: '¡Herramienta Creada!', description: 'El producto se integró correctamente al inventario.' });
      navigate(`/herramientas/${data.id}`);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <h3 className="text-xl font-bold text-rose-600">Acceso Restringido</h3>
        <p className="text-sm text-slate-500 mt-2">Solo el personal de Administración o Logística puede ingresar nuevos productos.</p>
        <Button className="mt-4 bg-peie-blue text-white" onClick={() => navigate('/herramientas')}>Volver al Catálogo</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-safe">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate('/herramientas')} className="p-0 hover:bg-transparent text-peie-blue">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Catálogo
        </Button>
      </div>

      <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-2xl">
        <div className="h-1.5 bg-gradient-to-r from-peie-blue via-peie-light to-peie-blue" />
        
        <CardHeader className="pb-4 pt-6 px-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-peie-blue/10 text-peie-blue font-bold">
              <Plus size={20} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-peie-blue">Alta de Producto</CardTitle>
              <CardDescription className="text-xs">Incorpora una nueva herramienta a la base de datos central</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-semibold text-slate-700">Código Interno *</Label>
                <Input 
                  id="code" 
                  placeholder="Ej: TAL-005" 
                  value={code} 
                  onChange={e => setCode(e.target.value)}
                  className="h-11 rounded-xl uppercase font-mono"
                  required 
                />
                <span className="text-[10px] text-slate-400">Identificador único para etiquetas QR</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700">Nombre de la Herramienta *</Label>
                <Input 
                  id="name" 
                  placeholder="Ej: Taladro Percutor Rotopercutor" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="h-11 rounded-xl"
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand" className="text-xs font-semibold text-slate-700">Marca</Label>
                <Input 
                  id="brand" 
                  placeholder="Ej: DeWalt" 
                  value={brand} 
                  onChange={e => setBrand(e.target.value)}
                  className="h-11 rounded-xl" 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model" className="text-xs font-semibold text-slate-700">Modelo</Label>
                <Input 
                  id="model" 
                  placeholder="Ej: DCD778" 
                  value={model} 
                  onChange={e => setModel(e.target.value)}
                  className="h-11 rounded-xl" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obra" className="text-xs font-semibold text-slate-700">Obra o Base Inicial *</Label>
              <Select value={currentObraId} onValueChange={setCurrentObraId} required>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecciona dónde se ubica físicamente" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs font-semibold text-slate-700">Descripción o Características Adicionales</Label>
              <Input 
                id="desc" 
                placeholder="Detalles sobre potencia, accesorios incluidos, estado visual..." 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                className="h-11 rounded-xl" 
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 mt-4 rounded-xl bg-peie-blue hover:bg-peie-blue/90 text-white font-medium"
              disabled={loading}
            >
              {loading ? 'Guardando en servidor...' : 'Registrar Herramienta'}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
