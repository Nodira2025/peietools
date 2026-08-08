import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Layers, 
  Wrench, 
  Disc, 
  Hammer, 
  Shield, 
  Ruler, 
  Zap, 
  Package,
  AlertCircle
} from 'lucide-react';

interface Categoria {
  id: string;
  name: string;
  description: string | null;
  icon_name: string | null;
  color: string | null;
}

interface ModalGestionCategoriasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesUpdated: () => void;
}

const AVAILABLE_ICONS = [
  { name: 'Wrench', label: 'Llave', Icon: Wrench },
  { name: 'Disc', label: 'Disco', Icon: Disc },
  { name: 'Hammer', label: 'Martillo', Icon: Hammer },
  { name: 'Shield', label: 'Escudo', Icon: Shield },
  { name: 'Ruler', label: 'Regla', Icon: Ruler },
  { name: 'Zap', label: 'Energía', Icon: Zap },
  { name: 'Package', label: 'Paquete', Icon: Package },
  { name: 'Layers', label: 'Capas', Icon: Layers }
];

export default function ModalGestionCategorias({ open, onOpenChange, onCategoriesUpdated }: ModalGestionCategoriasProps) {
  const { toast } = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('Wrench');
  const [saving, setSaving] = useState(false);

  // Edit states
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categorias_herramientas')
        .select('*')
        .order('name');
      
      if (error) {
        // Fallback: Si la tabla no existe aún, extraer dinámicamente de las herramientas
        const { data: herramientasData } = await supabase.from('herramientas').select('category');
        const uniqueCats = Array.from(new Set((herramientasData || []).map((h: any) => h.category || 'Otros')));
        setCategorias(uniqueCats.map((c, i) => ({
          id: String(i),
          name: c,
          description: 'Categoría del inventario',
          icon_name: 'Wrench',
          color: '#3b82f6'
        })));
      } else {
        setCategorias(data || []);
      }
    } catch (err: any) {
      console.error('Error al cargar categorías:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCategorias();
    }
  }, [open]);

  const handleCreateCategory = async () => {
    if (!newName.trim()) {
      toast({ variant: 'destructive', title: 'Campo requerido', description: 'Ingresá el nombre de la nueva categoría.' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('categorias_herramientas')
        .insert([{
          name: newName.trim(),
          description: newDesc.trim() || null,
          icon_name: newIcon,
          color: '#3b82f6'
        }]);

      if (error) throw error;

      toast({ title: '¡Categoría Creada!', description: `La categoría "${newName.trim()}" ya está disponible.` });
      setNewName('');
      setNewDesc('');
      setIsCreating(false);
      await fetchCategorias();
      onCategoriesUpdated();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo crear la categoría.' });
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (cat: Categoria) => {
    setEditingCatId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
  };

  const handleSaveEdit = async (cat: Categoria) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const oldName = cat.name;
      const updatedName = editName.trim();

      // 1. Actualizar en la tabla de categorías
      const { error: catErr } = await supabase
        .from('categorias_herramientas')
        .update({ name: updatedName, description: editDesc.trim() || null })
        .eq('id', cat.id);

      if (catErr) throw catErr;

      // 2. Renombrar en cascada todas las herramientas con esa categoría
      if (oldName !== updatedName) {
        await supabase
          .from('herramientas')
          .update({ category: updatedName })
          .eq('category', oldName);
      }

      toast({ title: 'Categoría Actualizada', description: `Se renombró de "${oldName}" a "${updatedName}".` });
      setEditingCatId(null);
      await fetchCategorias();
      onCategoriesUpdated();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: Categoria) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"? Las herramientas pasarán a categoría "Otros".`)) return;

    try {
      // 1. Reasignar herramientas a "Otros"
      await supabase
        .from('herramientas')
        .update({ category: 'Otros' })
        .eq('category', cat.name);

      // 2. Eliminar la categoría
      await supabase.from('categorias_herramientas').delete().eq('id', cat.id);

      toast({ title: 'Categoría Eliminada', description: `La categoría "${cat.name}" fue eliminada.` });
      await fetchCategorias();
      onCategoriesUpdated();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-peie-blue" />
            Gestión de Categorías
          </DialogTitle>
          <p className="text-xs text-slate-500 font-medium">
            Agrupación y clasificación de herramientas para el catálogo y reportes.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Botón Nueva Categoría */}
          {!isCreating && (
            <Button
              onClick={() => setIsCreating(true)}
              className="w-full bg-peie-blue hover:bg-peie-blue/90 text-white font-bold h-11 rounded-2xl flex items-center justify-center gap-2 shadow-sm text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Crear Nueva Categoría</span>
            </Button>
          )}

          {/* Formulario Crear Categoría */}
          {isCreating && (
            <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-blue-900 uppercase">Nueva Categoría</h4>
                <button onClick={() => setIsCreating(false)} className="text-xs text-slate-400 font-bold hover:text-slate-600">×</button>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Nombre de la Categoría *</Label>
                <Input
                  placeholder="Ej: Amoladoras, Roto-martillos..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-10 text-xs rounded-xl bg-white border-blue-200 mt-1 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Descripción (Opcional)</Label>
                <Input
                  placeholder="Ej: Herramientas de corte de metal y concreto..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="h-10 text-xs rounded-xl bg-white border-blue-200 mt-1"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsCreating(false)}
                  className="h-9 text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateCategory}
                  disabled={saving || !newName.trim()}
                  className="bg-peie-blue hover:bg-peie-blue/90 text-white font-bold h-9 rounded-xl text-xs"
                >
                  {saving ? 'Guardando...' : 'Guardar Categoría'}
                </Button>
              </div>
            </div>
          )}

          {/* Lista de Categorías Existentes */}
          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            {categorias.map((cat) => {
              const isEditing = editingCatId === cat.id;

              return (
                <div 
                  key={cat.id} 
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                >
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-9 text-xs rounded-xl font-bold bg-white"
                      />
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Descripción opcional"
                        className="h-8 text-xs rounded-xl bg-white"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingCatId(null)} className="h-7 text-xs">Cancelar</Button>
                        <Button size="sm" onClick={() => handleSaveEdit(cat)} disabled={saving} className="bg-emerald-600 text-white h-7 text-xs font-bold">Guardar</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
                          <Layers className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{cat.name}</p>
                          {cat.description && <p className="text-xs text-slate-400 truncate">{cat.description}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleStartEdit(cat)}
                          className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(cat)}
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
