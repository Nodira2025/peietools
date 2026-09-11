import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { notifyCatalogChanged } from '../lib/useCategories';
import { buildToolCatalog, canonicalCategory, canonicalSubcategory, classifyTool, normalizeToolText, parseCategoryPath, serializeClassification, STANDARD_CATALOG } from '../lib/toolTaxonomy';
import type { CategoryImportRow, ImportTool } from '../lib/toolCategoryImport';
import { applyCategoryImport, CategoryWriteError } from '../services/tools/toolCategoryWrites';

interface RegisteredCategory { id: string; name: string }
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesUpdated: () => void;
  herramientas: ImportTool[];
}
export default function ModalGestionCategorias({ open, onOpenChange, onCategoriesUpdated, herramientas }: Props) {
  const { toast } = useToast();
  const [registered, setRegistered] = useState<RegisteredCategory[]>([]);
  const [selected, setSelected] = useState('Escalera');
  const [main, setMain] = useState('Escalera');
  const [sub, setSub] = useState('');
  const [editing, setEditing] = useState<RegisteredCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const catalog = useMemo(() => buildToolCatalog(herramientas, registered.map(row => row.name)), [herramientas, registered]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows: RegisteredCategory[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await supabase.from('categorias_herramientas').select('id, name').order('name').range(offset, offset+499);
        if (result.error) throw result.error;
        rows.push(...(result.data || []));
        if ((result.data?.length || 0) < 500) break;
      }
      setRegistered(rows);
      setLoadError('');
    } catch { setLoadError('No se pudo cargar el catálogo editable. Reintentá antes de guardar cambios.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the editable catalog with the remote registry when opened.
    if (open) void load();
  }, [open, load]);

  const relatedTools = (row: RegisteredCategory) => {
    const path = parseCategoryPath(row.name);
    const before = classifyTool({ category: row.name });
    return herramientas.filter(tool => {
      const current = classifyTool(tool);
      return current.category === before.category && (!path || current.subcategory === before.subcategory);
    });
  };
  const isStandard = (name: string) => {
    const path = parseCategoryPath(name);
    if (!path) return Boolean(STANDARD_CATALOG[canonicalCategory(name)]);
    return Boolean(STANDARD_CATALOG[path.category]?.includes(path.subcategory));
  };

  const save = async () => {
    if (saving || loading || loadError) return;
    const category = canonicalCategory(main);
    const subcategory = sub.trim() ? canonicalSubcategory(category, sub) : '';
    if (!main.trim() || main.includes('›') || sub.includes('›')) {
      toast({ variant: 'destructive', title: 'Revisá el nombre', description: 'Ingresá los nombres de categoría y subcategoría en sus campos separados.' }); return;
    }
    const newName = subcategory ? serializeClassification({category, subcategory}) : category;
    if (editing && Boolean(parseCategoryPath(editing.name)) !== Boolean(subcategory)) {
      toast({ variant: 'destructive', title: 'Revisá la subcategoría', description: 'Conservá el nivel del elemento que estás editando.' }); return;
    }
    if (registered.some(row => row.id !== editing?.id && normalizeToolText(row.name) === normalizeToolText(newName)) ||
      (!editing && (subcategory ? catalog.find(c=>c.name===category)?.subcategories.includes(subcategory) : catalog.some(c=>c.name===category)))) {
      toast({ variant: 'destructive', title: 'Ya existe', description: 'Esa categoría o subcategoría ya está disponible.' }); return;
    }
    setSaving(true);
    let changedTools = 0;
    try {
      if (editing) {
        const before = classifyTool({ category: editing.name });
        const path = parseCategoryPath(editing.name);
        const changes: CategoryImportRow[] = relatedTools(editing).map((tool,index) => {
          const current = classifyTool(tool);
          const target = serializeClassification({ category, subcategory: path ? subcategory : current.subcategory });
          return { row:index+1, code:tool.code, name:tool.name, toolId:tool.id, originalCategory:tool.category ?? null,
            currentCategory:serializeClassification(current), newCategory:target, changed:target!==serializeClassification(current) };
        });
        const children = path ? [] : registered.filter(row => row.id!==editing.id && parseCategoryPath(row.name)?.category===before.category);
        const updates = [{row:editing,name:newName}, ...children.map(row => ({row,name:serializeClassification({category,subcategory:parseCategoryPath(row.name)!.subcategory})}))];
        if (updates.some(update=>registered.some(row=>!updates.some(u=>u.row.id===row.id)&&normalizeToolText(row.name)===normalizeToolText(update.name)))) throw new Error('El nombre coincide con otra entrada del catálogo.');
        changedTools = await applyCategoryImport(changes);
        for (const update of updates) {
          const result = await supabase.from('categorias_herramientas').update({name:update.name}).eq('id',update.row.id).eq('name',update.row.name).select('id').single();
          if (result.error) throw result.error;
        }
      } else {
        const result = await supabase.from('categorias_herramientas').insert({name:newName,description:null}).select('id').single();
        if (result.error) throw result.error;
      }
      setSelected(category);
      setCreating(false);
      setEditing(null);
      setSub('');
      toast({ title: 'Catálogo actualizado', description: newName });
    } catch (error) {
      const completed = error instanceof CategoryWriteError ? error.completed : changedTools;
      const message = error instanceof Error ? error.message : (error as {message?:string})?.message || 'No se pudo confirmar el cambio.';
      toast({ variant: 'destructive', title: 'No se completó el cambio', description: (completed ? completed+' herramientas actualizadas. ' : '') + message });
    } finally {
      notifyCatalogChanged();
      await load();
      onCategoriesUpdated();
      setSaving(false);
    }
  };

  const remove = async (row: RegisteredCategory) => {
    if (saving) return;
    const classification = classifyTool({category:row.name});
    const hasChildren = !parseCategoryPath(row.name) && registered.some(r=>parseCategoryPath(r.name)?.category===classification.category);
    if (relatedTools(row).length || hasChildren) {
      toast({ variant:'destructive',title:'Categoría en uso',description:'Reasigná sus herramientas y subcategorías antes de eliminarla.' }); return;
    }
    if (!window.confirm('¿Eliminar "' + row.name + '" del catálogo?')) return;
    setSaving(true);
    try {
      const result = await supabase.from('categorias_herramientas').delete().eq('id',row.id).eq('name',row.name).select('id').single();
      if (result.error) throw result.error;
      notifyCatalogChanged();
      await load();
      onCategoriesUpdated();
      toast({title:'Entrada eliminada'});
    } catch { toast({variant:'destructive',title:'No se pudo eliminar',description:'No se confirmó la eliminación. Actualizá el catálogo y reintentá.'}); }
    finally { setSaving(false); }
  };

  const startEdit = (row: RegisteredCategory) => {
    const path = parseCategoryPath(row.name);
    setEditing(row); setCreating(true); setMain(path?.category || canonicalCategory(row.name)); setSub(path?.subcategory || '');
  };
  const editableRows = registered.filter(row => classifyTool({category:row.name}).category === selected && !isStandard(row.name));
  return <Dialog open={open} onOpenChange={value=>{if(!saving)onOpenChange(value);}}>
    <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl">
      <DialogHeader><DialogTitle>Gestionar categorías y subcategorías</DialogTitle></DialogHeader>
      <p className="text-sm text-slate-600">El catálogo estándar unifica los nombres. Podés agregar categorías y variantes para otras herramientas.</p>
      {loadError && <p role="alert" className="text-sm text-red-700">{loadError}<Button variant="ghost" size="sm" onClick={()=>void load()}>Reintentar</Button></p>}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40 space-y-1"><Label htmlFor="catalog-parent">Categoría principal</Label><select id="catalog-parent" className="w-full rounded-lg border p-2 bg-white text-sm" value={selected} onChange={e=>setSelected(e.target.value)}>{catalog.map(c=><option key={c.name}>{c.name}</option>)}</select></div>
        <Button disabled={loading||saving||!!loadError} onClick={()=>{setCreating(true);setEditing(null);setMain(selected);setSub('');}}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
      </div>
      {creating && <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
        <div><Label htmlFor="catalog-name">Categoría principal *</Label><Input id="catalog-name" list="catalog-names" value={main} onChange={e=>setMain(e.target.value)} placeholder="Ej.: Escalera" /><datalist id="catalog-names">{catalog.map(c=><option key={c.name} value={c.name} />)}</datalist></div>
        <div><Label htmlFor="catalog-sub">Subcategoría</Label><Input id="catalog-sub" value={sub} onChange={e=>setSub(e.target.value)} placeholder="Ej.: 14 peldaños" /><p className="text-xs text-slate-500 mt-1">Dejá este campo vacío para crear solamente la categoría principal.</p></div>
        <div className="flex justify-end gap-2"><Button variant="ghost" disabled={saving} onClick={()=>setCreating(false)}>Cancelar</Button><Button disabled={saving||!main.trim()} onClick={()=>void save()}>{saving?'Guardando…':'Guardar'}</Button></div>
      </div>}
      <div className="space-y-2">
        {catalog.find(c=>c.name===selected)?.subcategories.map(subcategory=><div key={subcategory} className="flex justify-between gap-3 rounded-lg border p-3 text-sm"><span>{subcategory}</span><span className="text-slate-500 shrink-0">{herramientas.filter(t=>{const c=classifyTool(t);return c.category===selected&&c.subcategory===subcategory;}).length} unidades</span></div>)}
      </div>
      {!!editableRows.length && <div className="space-y-2"><p className="font-semibold text-sm">Entradas personalizadas</p>{editableRows.map(row=><div key={row.id} className="flex items-center gap-2 rounded-lg border p-3"><span className="text-sm flex-1 break-words">{row.name}</span><Button variant="ghost" size="icon" aria-label={'Editar '+row.name} disabled={saving} onClick={()=>startEdit(row)}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={'Eliminar '+row.name} disabled={saving} onClick={()=>void remove(row)}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
    </DialogContent>
  </Dialog>;
}
