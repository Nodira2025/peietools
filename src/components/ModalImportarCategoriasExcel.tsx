import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload } from 'lucide-react';
import { useCategories } from '../lib/useCategories';
import { classifyTool } from '../lib/toolTaxonomy';
import { planCategoryImport, type CategoryImportPlan, type ImportTool } from '../lib/toolCategoryImport';
import { applyCategoryImport, CategoryWriteError } from '../services/tools/toolCategoryWrites';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  herramientas: ImportTool[];
  onSuccess: () => void;
}
export default function ModalImportarCategoriasExcel({ open, onOpenChange, herramientas, onSuccess }: Props) {
  const { toast } = useToast();
  const { catalog, loading: catalogLoading } = useCategories(herramientas);
  const [plan, setPlan] = useState<CategoryImportPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const download = async () => {
    if (!herramientas.length) { toast({ title: 'Sin datos', description: 'No hay herramientas para exportar.' }); return; }
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(herramientas.map(tool => {
        const classification = classifyTool(tool);
        return { 'Código': tool.code, 'Herramienta': tool.name, 'Marca': tool.brand || '', 'Modelo': tool.model || '',
          'Categoría principal': classification.category, 'Subcategoría': classification.subcategory };
      }));
      sheet['!cols'] = [14, 36, 18, 26, 28, 30].map(wch => ({ wch }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Recategorización');
      XLSX.writeFile(workbook, 'Categorias_Herramientas_' + new Date().toISOString().slice(0,10) + '.xlsx');
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'No se pudo preparar el archivo.' }); }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setPlan(null);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (!rows.length) throw new Error('El archivo no contiene herramientas.');
      setPlan(planCategoryImport(rows, herramientas, catalog));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error de lectura', description: error instanceof Error ? error.message : 'No se pudo leer el archivo.' });
    } finally {
      setLoading(false);
      if (input.current) input.current.value = '';
    }
  };

  const apply = async () => {
    if (!plan || plan.errors.length || applying) return;
    setApplying(true);
    try {
      const completed = await applyCategoryImport(plan.rows);
      toast({ title: 'Clasificación actualizada', description: 'Se guardaron ' + completed + ' herramientas.' });
      setPlan(null);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const completed = error instanceof CategoryWriteError ? error.completed : 0;
      toast({ variant: 'destructive', title: 'No se completó la importación',
        description: (completed ? completed + ' cambios confirmados. ' : '') + (error instanceof Error ? error.message : 'Actualizá el inventario antes de reintentar.') });
      setPlan(null);
      onSuccess();
    } finally { setApplying(false); }
  };

  const changed = plan?.rows.filter(row => row.changed).length || 0;
  return <Dialog open={open} onOpenChange={next => { if (!applying) onOpenChange(next); }}>
    <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl">
      <DialogHeader><DialogTitle>Categorías y subcategorías por Excel</DialogTitle></DialogHeader>
      <p className="text-sm text-slate-600">Descargá el inventario, editá «Categoría principal» y «Subcategoría» y revisá los cambios antes de guardarlos. El código identifica cada herramienta.</p>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => void download()} disabled={applying}><Download className="h-4 w-4 mr-2" />Descargar plantilla</Button>
        <Button onClick={() => input.current?.click()} disabled={loading || applying || catalogLoading}><Upload className="h-4 w-4 mr-2" />{loading ? 'Leyendo…' : 'Cargar archivo'}</Button>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" aria-label="Archivo de categorías" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
      </div>
      {plan && <>
        <p className="text-sm font-semibold">{changed} cambios · {plan.rows.length} filas válidas</p>
        {!!plan.errors.length && <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <p className="font-semibold">Corregí estas filas antes de aplicar cambios:</p>
          <ul className="list-disc pl-5 mt-2">{plan.errors.map((error,i) => <li key={i}>{error}</li>)}</ul>
        </div>}
        {!!plan.rows.length && <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50"><tr><th className="p-3">Código</th><th className="p-3">Herramienta</th><th className="p-3">Clasificación actual</th><th className="p-3">Nueva clasificación</th></tr></thead>
            <tbody>{plan.rows.map(row => <tr key={row.code} className={'border-t ' + (row.changed ? 'bg-blue-50' : '')}><td className="p-3 font-mono">{row.code}</td><td className="p-3">{row.name}</td><td className="p-3">{row.currentCategory}</td><td className="p-3">{row.newCategory}</td></tr>)}</tbody>
          </table>
        </div>}
        <Button className="bg-emerald-700" onClick={() => void apply()} disabled={applying || !changed || !!plan.errors.length}>{applying ? 'Guardando…' : 'Aplicar ' + changed + ' cambios'}</Button>
      </>}
    </DialogContent>
  </Dialog>;
}
