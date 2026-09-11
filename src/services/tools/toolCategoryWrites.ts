import { supabase } from '../../lib/supabase';
import { notifyCatalogChanged } from '../../lib/useCategories';
import type { CategoryImportRow } from '../../lib/toolCategoryImport';

export class CategoryWriteError extends Error {
  completed: number;
  constructor(message: string, completed: number) { super(message); this.completed = completed; }
}

export async function applyCategoryImport(rows: readonly CategoryImportRow[]): Promise<number> {
  let completed = 0;
  const groups = new Map<string, CategoryImportRow[]>();
  rows.filter(row => row.changed).forEach(row => {
    const key = JSON.stringify([row.originalCategory, row.newCategory]);
    groups.set(key, [...(groups.get(key) || []), row]);
  });
  try {
    for (const group of groups.values()) {
      for (let start = 0; start < group.length; start += 100) {
        const chunk = group.slice(start, start + 100);
        let query = supabase.from('herramientas').update({ category: chunk[0].newCategory }).in('id', chunk.map(row => row.toolId));
        query = chunk[0].originalCategory === null ? query.is('category', null) : query.eq('category', chunk[0].originalCategory);
        const { data, error } = await query.select('id');
        if (error) throw error;
        completed += data?.length || 0;
        if (data?.length !== chunk.length) throw new Error('Algunas herramientas cambiaron desde la previsualización o no tenés permiso para editarlas. Volvé a cargar el archivo con el inventario actualizado.');
      }
    }
    return completed;
  } catch (error) {
    throw new CategoryWriteError(error instanceof Error ? error.message : (error as { message?: string })?.message || 'No se pudieron guardar las categorías.', completed);
  } finally {
    // A timeout can happen after the server committed a write; invalidate even
    // when no response was received. Never present partial writes as full success.
    notifyCatalogChanged();
  }
}
