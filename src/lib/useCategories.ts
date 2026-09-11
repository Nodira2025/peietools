import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { buildToolCatalog, type TaxonomyTool } from './toolTaxonomy';

export function notifyCatalogChanged() {
  try {
    localStorage.removeItem('peie_cache_herramientas');
    localStorage.removeItem('peie_cache_herramientas_solicitables');
  } catch { /* Optional cache. */ }
  window.dispatchEvent(new Event('peie:catalog-changed'));
}

export function useCategories(inventory?: readonly TaxonomyTool[]) {
  const [registeredNames, setRegisteredNames] = useState<string[]>([]);
  const [tools, setTools] = useState<TaxonomyTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasInventory = inventory !== undefined;
  const refreshCategories = useCallback(async () => {
    setLoading(true);
    const failures: string[] = [];
    await Promise.all([
      (async () => {
        try {
          const names: string[] = [];
          for (let offset = 0; ; offset += 500) {
            const result = await supabase.from('categorias_herramientas').select('name').order('name').range(offset, offset + 499);
            if (result.error) throw result.error;
            names.push(...(result.data || []).map(row => row.name).filter(Boolean));
            if ((result.data?.length || 0) < 500) break;
          }
          setRegisteredNames(names);
        } catch { failures.push('No se pudo actualizar el catálogo de categorías.'); }
      })(),
      (async () => {
        if (hasInventory) return;
        try {
          const rows: TaxonomyTool[] = [];
          for (let offset = 0; ; offset += 500) {
            const result = await supabase.from('herramientas').select('id, name, category, model').order('id').range(offset, offset + 499);
            if (result.error) throw result.error;
            rows.push(...(result.data || []));
            if ((result.data?.length || 0) < 500) break;
          }
          setTools(rows);
        } catch { failures.push('No se pudieron actualizar las categorías del inventario.'); }
      })(),
    ]);
    setError(failures.join(' '));
    setLoading(false);
  }, [hasInventory]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the remote catalog; subsequent refreshes are driven by catalog events.
    void refreshCategories();
    const refresh = () => { void refreshCategories(); };
    window.addEventListener('peie:catalog-changed', refresh);
    return () => window.removeEventListener('peie:catalog-changed', refresh);
  }, [refreshCategories]);

  const catalog = useMemo(() => buildToolCatalog(inventory ?? tools, registeredNames), [inventory, tools, registeredNames]);
  const categories = useMemo(() => catalog.map(c => c.name), [catalog]);
  return { categories, catalog, registeredNames, loading, error, refreshCategories };
}
