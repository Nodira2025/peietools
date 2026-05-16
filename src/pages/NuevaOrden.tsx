import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, FileText, X, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';

export default function NuevaOrden() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<{id: string, full_name: string}[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    objective: '',
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    priority: 'Normal',
    assigned_to: ''
  });

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchUsuarios = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name');
      if (data) setUsuarios(data);
    };
    fetchUsuarios();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.assigned_to) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debes asignar la orden a alguien' });
      return;
    }

    setLoading(true);
    let attachment_url = '';

    try {
      // 1. Subir archivo si existe
      if (file) {
        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('ordenes')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('ordenes').getPublicUrl(filePath);
        attachment_url = urlData.publicUrl;
        setUploading(false);
      }

      // 2. Crear la orden
      const { error } = await supabase.from('ordenes_trabajo').insert({
        title: formData.title,
        objective: formData.objective,
        start_date: formData.start_date,
        due_date: formData.due_date || null,
        priority: formData.priority,
        assigned_to: formData.assigned_to,
        created_by: user.id,
        attachment_url
      });

      if (error) throw error;

      toast({ title: 'Orden creada', description: 'La orden de trabajo ha sido registrada con éxito.' });
      navigate('/ordenes');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-safe">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold text-peie-blue">Nueva Orden de Trabajo</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-slate-100 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Información General</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título de la Orden</Label>
              <Input 
                id="title" 
                required 
                placeholder="Ej: Mantenimiento Tablero Principal" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="objective">Objetivo / Descripción</Label>
              <Textarea 
                id="objective" 
                placeholder="Describe qué se debe realizar..." 
                className="min-h-[100px] rounded-xl"
                value={formData.objective}
                onChange={e => setFormData({...formData, objective: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Fecha Inicio</Label>
                <Input 
                  id="start_date" 
                  type="date" 
                  value={formData.start_date}
                  onChange={e => setFormData({...formData, start_date: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Fecha Entrega (Opcional)</Label>
                <Input 
                  id="due_date" 
                  type="date" 
                  value={formData.due_date}
                  onChange={e => setFormData({...formData, due_date: e.target.value})}
                  className="rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Asignación y Prioridad</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asignar a</Label>
                <Select value={formData.assigned_to} onValueChange={val => setFormData({...formData, assigned_to: val})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={formData.priority} onValueChange={val => setFormData({...formData, priority: val})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baja">Baja</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Adjunto (Imagen o PDF)</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {!file ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-peie-blue/50 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                  accept="image/*,application/pdf"
                />
                <Upload className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Haz clic o arrastra para subir un archivo</p>
                <p className="text-xs text-slate-400 mt-1">Máximo 5MB (Imágenes o PDF)</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <FileText className="text-peie-blue" size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{file.name}</span>
                    <span className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setFile(null)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X size={18} />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-peie-blue hover:bg-peie-blue/90 text-white h-12 rounded-xl font-bold text-lg shadow-lg"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={20} />
              <span>{uploading ? 'Subiendo archivo...' : 'Guardando...'}</span>
            </div>
          ) : 'Crear Orden de Trabajo'}
        </Button>
      </form>
    </div>
  );
}
