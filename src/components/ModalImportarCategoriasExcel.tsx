import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Upload, Download, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

interface HerramientaItem {
  id: string;
  code: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  obras?: { name: string } | null;
}

interface ExcelRowPreview {
  code: string;
  name: string;
  currentCategory: string;
  newCategory: string;
  isChanged: boolean;
  toolId?: string;
}

interface ModalImportarCategoriasExcelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  herramientas: HerramientaItem[];
  onSuccess: () => void;
}

export default function ModalImportarCategoriasExcel({ open, onOpenChange, herramientas, onSuccess }: ModalImportarCategoriasExcelProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<ExcelRowPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  // 1. Descargar Inventario Excel para recategorizar
  const handleDownloadExcelTemplate = () => {
    if (herramientas.length === 0) {
      toast({ variant: 'destructive', title: 'Sin herramientas', description: 'No hay herramientas para exportar.' });
      return;
    }

    const data = herramientas.map(h => ({
      'Código': h.code,
      'Herramienta': h.name,
      'Marca': h.brand || '',
      'Modelo': h.model || '',
      'Obra Actual': h.obras?.name || 'Base Central',
      'Categoría Actual': h.category || 'Otros',
      'NUEVA CATEGORÍA': h.category || 'Otros' // Federico Grande modifica esta columna
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 10 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 30 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recategorizacion");
    XLSX.writeFile(workbook, `Inventario_Para_Recategorizar_${new Date().toISOString().slice(0, 10)}.xlsx`);

    toast({ title: 'Excel Descargado', description: 'Editá la columna "NUEVA CATEGORÍA" y volvé a subir el archivo.' });
  };

  // 2. Leer archivo Excel subido
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonRows.length === 0) {
        toast({ variant: 'destructive', title: 'Archivo vacío', description: 'El archivo Excel no contiene filas de datos.' });
        return;
      }

      // Mapear filas buscando match por Código
      const toolMap = new Map<string, HerramientaItem>();
      herramientas.forEach(h => toolMap.set(h.code.trim().toUpperCase(), h));

      const previewList: ExcelRowPreview[] = [];

      jsonRows.forEach(row => {
        const rawCode = String(row['Código'] || row['codigo'] || row['Code'] || '').trim().toUpperCase();
        const rawName = String(row['Herramienta'] || row['Nombre'] || row['name'] || '').trim();
        const rawCurrentCat = String(row['Categoría Actual'] || row['categoria'] || 'Otros').trim();
        const rawNewCat = String(row['NUEVA CATEGORÍA'] || row['Nueva Categoria'] || row['Nueva Categoría'] || rawCurrentCat).trim();

        if (rawCode && toolMap.has(rawCode)) {
          const matchingTool = toolMap.get(rawCode)!;
          const currentCat = matchingTool.category || 'Otros';
          const newCat = rawNewCat || currentCat;

          previewList.push({
            code: matchingTool.code,
            name: matchingTool.name,
            currentCategory: currentCat,
            newCategory: newCat,
            isChanged: currentCat.toLowerCase() !== newCat.toLowerCase(),
            toolId: matchingTool.id
          });
        }
      });

      setPreviews(previewList);
      if (previewList.length === 0) {
        toast({ variant: 'destructive', title: 'Sin coincidencias', description: 'No se encontraron códigos de herramientas coincidentes en el Excel.' });
      } else {
        const changedCount = previewList.filter(p => p.isChanged).length;
        toast({ title: 'Excel Procesado', description: `Se encontraron ${previewList.length} herramientas (${changedCount} con cambios de categoría).` });
      }
    } catch (err: any) {
      console.error('Error procesando Excel:', err);
      toast({ variant: 'destructive', title: 'Error de Lectura', description: 'No se pudo procesar el archivo Excel.' });
    } finally {
      setLoading(false);
    }
  };

  // 3. Aplicar Cambios Masivos en Supabase
  const handleApplyChanges = async () => {
    const changedItems = previews.filter(p => p.isChanged && p.toolId && p.newCategory);
    if (changedItems.length === 0) {
      toast({ title: 'Sin Cambios', description: 'No hay modificaciones de categoría para aplicar.' });
      return;
    }

    setApplying(true);
    try {
      // Agrupar actualizaciones por Nueva Categoría para optimizar requirimientos
      const categoryGroups = new Map<string, string[]>();
      changedItems.forEach(item => {
        if (!categoryGroups.has(item.newCategory)) {
          categoryGroups.set(item.newCategory, []);
        }
        categoryGroups.get(item.newCategory)!.push(item.toolId!);
      });

      // Ejecutar batches de actualización
      for (const [newCatName, toolIds] of categoryGroups.entries()) {
        // Asegurar que la categoría existe en categorias_herramientas
        await supabase
          .from('categorias_herramientas')
          .insert([{ name: newCatName, description: 'Creada desde Excel' }])
          .select()
          .maybeSingle();

        // Actualizar herramientas
        await supabase
          .from('herramientas')
          .update({ category: newCatName })
          .in('id', toolIds);
      }

      toast({ 
        title: '¡Recategorización Exitosa!', 
        description: `Se actualizaron las categorías de ${changedItems.length} herramientas correctamente.` 
      });

      setPreviews([]);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error aplicando cambios:', err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudieron guardar las categorías.' });
    } finally {
      setApplying(false);
    }
  };

  const changedCount = previews.filter(p => p.isChanged).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            Recategorización Masiva por Excel
          </DialogTitle>
          <p className="text-xs text-slate-500 font-medium">
            Módulo pensado para Federico Grande y Administradores. Exportá el inventario a Excel, modificá las categorías y volvé a subirlo.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Botones de Paso 1 y Paso 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleDownloadExcelTemplate}
              className="h-14 rounded-2xl border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              <div className="text-left">
                <p className="font-bold">1. Descargar Plantilla Excel</p>
                <p className="text-[10px] text-emerald-600 font-medium">Inventario actual listo para editar</p>
              </div>
            </Button>

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <Upload className="h-4 w-4" />
              <div className="text-left">
                <p className="font-bold">2. Subir Excel Editado</p>
                <p className="text-[10px] text-emerald-100 font-medium">Procesar nuevas categorías</p>
              </div>
            </Button>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </div>

          {/* Previsualización de Cambios */}
          {previews.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                  Previsualización de Cambios ({changedCount} modificados de {previews.length})
                </h4>
                {changedCount > 0 && (
                  <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                    {changedCount} Cambios detectados
                  </span>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[35vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5">Código</th>
                      <th className="p-2.5">Herramienta</th>
                      <th className="p-2.5">Categoría Actual</th>
                      <th className="p-2.5 text-blue-700">Nueva Categoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {previews.map((p, idx) => (
                      <tr key={idx} className={p.isChanged ? 'bg-amber-50/60 font-bold' : 'hover:bg-slate-50'}>
                        <td className="p-2.5 font-mono text-slate-500">{p.code}</td>
                        <td className="p-2.5 truncate max-w-[140px]">{p.name}</td>
                        <td className="p-2.5 text-slate-400">{p.currentCategory}</td>
                        <td className="p-2.5 text-blue-700 font-bold">
                          {p.newCategory}
                          {p.isChanged && <span className="ml-1 text-[10px] text-amber-600 font-extrabold">✏️</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Botón Confirmar Reorganización */}
              <Button
                onClick={handleApplyChanges}
                disabled={applying || changedCount === 0}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2"
              >
                <Check className="h-5 w-5" />
                <span>{applying ? 'Guardando en Supabase...' : `Confirmar y Aplicar Cambios (${changedCount} Herramientas)`}</span>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
