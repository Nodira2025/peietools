import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Wrench, Plus, QrCode, Search, Layers, Disc, Hammer, Shield, Ruler, ChevronLeft, ChevronRight, Building2, LayoutGrid, List, Download, Truck, Camera, Package, FileSpreadsheet, Tag, type LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '../lib/useCategories';
import { canonicalCategory, classifyTool, compareCategories, compareSubcategories, matchesToolSearch, parseCategoryPath, type ToolClassification } from '../lib/toolTaxonomy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FilterBar from '../components/FilterBar';
import ToolPhoto from '../components/ToolPhoto';
import ModalGestionCategorias from '../components/ModalGestionCategorias';
import ModalImportarCategoriasExcel from '../components/ModalImportarCategoriasExcel';

interface Herramienta {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: string;
  category: string | null;
  current_obra_id: string | null;
  obras?: { name: string; encargado_name: string | null } | null;
}
type ClassifiedTool = Herramienta & { classification: ToolClassification };
const icons: Record<string, LucideIcon> = {
  Escalera: Layers, Andamio: Layers, Amoladora: Disc, Taladro: Hammer,
  Rotomartillo: Hammer, Arnés: Shield, Resorte: Ruler, Rotuladora: Tag,
  'Cajón de herramientas': Package, Vaselina: Package,
};
const quantity = (count: number) => count + (count === 1 ? ' unidad' : ' unidades');
const availabilityLabel = (count: number) => count + (count === 1 ? ' disponible' : ' disponibles');
const statusStyle = (status: string) => ({
  Disponible: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'En uso': 'bg-orange-50 text-orange-800 border-orange-200',
  Reservada: 'bg-amber-50 text-amber-800 border-amber-200',
  'En traslado': 'bg-blue-50 text-blue-800 border-blue-200',
  'En mantenimiento': 'bg-purple-50 text-purple-800 border-purple-200',
}[status] || 'bg-rose-50 text-rose-800 border-rose-200');

function cachedInventory(): Herramienta[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem('peie_cache_herramientas') || '[]');
    return Array.isArray(rows) && rows.every(row => row && typeof row.id === 'string' && typeof row.name === 'string' && typeof row.code === 'string') ? rows : [];
  } catch { return []; }
}

export default function Herramientas() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const [herramientas, setHerramientas] = useState<Herramienta[]>(cachedInventory);
  const [loading, setLoading] = useState(herramientas.length === 0);
  const [loadError, setLoadError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => location.state?.category ? canonicalCategory(parseCategoryPath(location.state.category)?.category || location.state.category) : null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(location.state?.subcategory ?? null);
  const [searchTerm, setSearchTerm] = useState<string>(location.state?.searchTerm ?? '');
  const [filterObra, setFilterObra] = useState<string>(location.state?.filterObra ?? '');
  const [filterStatus, setFilterStatus] = useState<string>(location.state?.filterStatus ?? '');
  const [filterEncargado, setFilterEncargado] = useState<string>(location.state?.filterEncargado ?? '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(location.state?.viewMode === 'list' ? 'list' : 'grid');
  const [isGestionCategoriasOpen, setIsGestionCategoriasOpen] = useState(false);
  const [isImportarExcelOpen, setIsImportarExcelOpen] = useState(false);
  const requestSequence = useRef(0);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'logistica';
  const canManageTools = ['admin', 'logistica', 'encargado', 'solicitante', 'coordinador'].includes(profile?.role || '');
  const { registeredNames } = useCategories(herramientas);

  const fetchHerramientas = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const rows: Herramienta[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('herramientas')
          .select('id, code, name, brand, model, status, category, current_obra_id, obras(name, encargado_name)')
          .order('id').range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data || []).map(row => ({
          ...row, obras: Array.isArray(row.obras) ? row.obras[0] || null : row.obras,
        })));
        if ((data?.length || 0) < 500) break;
      }
      if (sequence !== requestSequence.current) return;
      setHerramientas(rows);
      setLoadError('');
      try { localStorage.setItem('peie_cache_herramientas', JSON.stringify(rows)); } catch { /* Optional cache; no photos stored. */ }
    } catch {
      if (sequence === requestSequence.current) setLoadError('No se pudo actualizar el inventario. Los datos guardados pueden estar desactualizados.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Revalidate the cached inventory against the remote source.
    void fetchHerramientas();
    const refresh = () => { void fetchHerramientas(); };
    window.addEventListener('peie:catalog-changed', refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- This is a request counter, not a DOM ref; invalidate its latest value on unmount.
    return () => { requestSequence.current++; window.removeEventListener('peie:catalog-changed', refresh); };
  }, [fetchHerramientas]);

  const navigationState = useMemo(() => ({
    from: '/herramientas', category: selectedCategory, subcategory: selectedSubcategory,
    searchTerm, filterObra, filterStatus, filterEncargado, viewMode,
  }), [selectedCategory, selectedSubcategory, searchTerm, filterObra, filterStatus, filterEncargado, viewMode]);

  // Save the current level before opening a tool so both app-back and browser-back
  // restore the category, subcategory and filters (also after a reload).
  useEffect(() => {
    if (JSON.stringify(location.state) !== JSON.stringify(navigationState)) {
      navigate(location.pathname + location.search, { replace: true, state: navigationState });
    }
  }, [navigationState, navigate, location.pathname, location.search, location.state]);

  const classified = useMemo<ClassifiedTool[]>(() => herramientas.map(tool => ({
    ...tool, classification: classifyTool(tool),
  })), [herramientas]);
  const scoped = useMemo(() => classified.filter(tool =>
    (!filterObra || tool.obras?.name === filterObra) &&
    (!filterStatus || tool.status === filterStatus) &&
    (!filterEncargado || tool.obras?.encargado_name === filterEncargado)
  ), [classified, filterObra, filterStatus, filterEncargado]);
  const filtered = useMemo(() => scoped.filter(tool =>
    (!selectedCategory || tool.classification.category === selectedCategory) &&
    (!selectedSubcategory || tool.classification.subcategory === selectedSubcategory) &&
    matchesToolSearch(tool, searchTerm)
  ).sort((a,b) => a.name.localeCompare(b.name, 'es', { numeric: true }) || a.code.localeCompare(b.code, 'es', { numeric: true })), [scoped, selectedCategory, selectedSubcategory, searchTerm]);

  const categories = useMemo(() => {
    const names = new Set(classified.map(tool => tool.classification.category));
    names.add('Escalera');
    names.add('Rotuladora');
    registeredNames.forEach(name => {
      const explicit = parseCategoryPath(name);
      if (explicit) names.add(explicit.category);
      else if (name === canonicalCategory(name)) names.add(name);
    });
    return [...names].sort(compareCategories).map(name => ({
      name,
      rows: scoped.filter(tool => tool.classification.category === name),
      subcategories: [...new Set(classified.filter(tool => tool.classification.category === name).map(tool => tool.classification.subcategory))].sort(compareSubcategories),
    }));
  }, [classified, scoped, registeredNames]);

  const subcategories = useMemo(() => {
    const names = new Set(classified.filter(tool => tool.classification.category === selectedCategory).map(tool => tool.classification.subcategory));
    registeredNames.forEach(name => {
      const explicit = parseCategoryPath(name);
      if (explicit?.category === selectedCategory) names.add(explicit.subcategory);
    });
    if (selectedCategory === 'Escalera') names.add('2 peldaños');
    return [...names].sort(compareSubcategories).map(name => ({
      name, rows: scoped.filter(tool => tool.classification.category === selectedCategory && tool.classification.subcategory === name),
    }));
  }, [classified, scoped, selectedCategory, registeredNames]);

  const obras = useMemo(() => [...new Set(herramientas.flatMap(t => t.obras?.name ? [t.obras.name] : []))].sort(), [herramientas]);
  const encargados = useMemo(() => [...new Set(herramientas.flatMap(t => t.obras?.encargado_name ? [t.obras.encargado_name] : []))].sort(), [herramientas]);
  const statuses = useMemo(() => [...new Set(herramientas.map(t => t.status))].sort(), [herramientas]);
  const showUnits = Boolean(selectedSubcategory || searchTerm.trim());
  const stage = showUnits ? 3 : selectedCategory ? 2 : 1;
  const goHome = () => { setSelectedCategory(null); setSelectedSubcategory(null); setSearchTerm(''); };
  const goCategory = () => { setSelectedSubcategory(null); setSearchTerm(''); };
  const clearFilters = () => { setSearchTerm(''); setFilterObra(''); setFilterStatus(''); setFilterEncargado(''); };
  const openTool = (id: string) => navigate('/herramientas/' + id, { state: navigationState });
  const exportToExcel = async (all = false) => {
    const rows = all ? classified : filtered;
    if (!rows.length) { toast({ title: 'Sin datos', description: 'No hay herramientas para exportar.' }); return; }
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(rows.map(tool => ({
        'Código': tool.code, 'Nombre': tool.name, 'Marca': tool.brand || '', 'Modelo': tool.model || '',
        'Categoría principal': tool.classification.category, 'Subcategoría': tool.classification.subcategory,
        'Estado': tool.status, 'Obra actual': tool.obras?.name || 'Sin ubicación asignada',
        'Coordinador': tool.obras?.encargado_name || '',
      })));
      sheet['!cols'] = [12, 36, 18, 24, 25, 28, 20, 26, 26].map(wch => ({ wch }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Herramientas');
      XLSX.writeFile(workbook, 'Inventario_Herramientas_' + new Date().toISOString().slice(0,10) + '.xlsx');
      toast({ title: 'Inventario exportado', description: quantity(rows.length) + ' con categoría y subcategoría.' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'No se pudo exportar el inventario.' }); }
  };

  return <div className="space-y-5 pb-safe">
    <div className="flex flex-col xl:flex-row justify-between gap-4">
      <div>
        <nav aria-label="Ruta de herramientas" className="flex flex-wrap items-center gap-2 text-sm mb-3">
          <button type="button" onClick={goHome} className="text-peie-blue hover:underline py-1">Herramientas</button>
          {selectedCategory && <><ChevronRight className="h-4 w-4 text-slate-400" /><button type="button" onClick={goCategory} className="text-peie-blue hover:underline py-1">{selectedCategory}</button></>}
          {selectedSubcategory && <><ChevronRight className="h-4 w-4 text-slate-400" /><span aria-current="page" className="text-slate-600">{selectedSubcategory}</span></>}
        </nav>
        <div className="flex items-center gap-2">
          {(selectedCategory || searchTerm) && <Button variant="ghost" size="icon" aria-label="Volver al nivel anterior" onClick={() => searchTerm ? setSearchTerm('') : selectedSubcategory ? goCategory() : goHome()}><ChevronLeft className="h-5 w-5" /></Button>}
          <h1 className="text-2xl font-bold tracking-tight text-peie-blue">{searchTerm.trim() ? 'Resultados de búsqueda' : selectedSubcategory || selectedCategory || 'Herramientas'}</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">{showUnits ? quantity(filtered.length) : selectedCategory ? 'Elegí una subcategoría para ver sus herramientas.' : 'Elegí una categoría principal.'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" aria-label="Buscar con cámara" onClick={() => navigate('/herramientas/busqueda-visual')}><Camera className="h-4 w-4 mr-2" /><span className="hidden sm:inline">Buscar con foto</span><span className="sm:hidden">Foto</span></Button>
        <Button variant="outline" aria-label="Escanear QR" onClick={() => navigate('/herramientas/scanner')}><QrCode className="h-4 w-4 mr-2" />QR</Button>
        {canManageTools && <Button className="bg-peie-blue" aria-label="Nueva herramienta" onClick={() => navigate('/herramientas/nueva')}><Plus className="h-4 w-4 mr-2" /><span className="hidden sm:inline">Nueva herramienta</span><span className="sm:hidden">Nueva</span></Button>}
      </div>
    </div>

    <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm flex-wrap" aria-label="Pasos de selección">
      {['Categoría', 'Subcategoría', 'Herramientas'].map((label, i) => <span key={label} aria-current={stage === i+1 ? 'step' : undefined} className={'flex items-center gap-2 ' + (stage === i+1 ? 'font-semibold text-peie-blue' : 'text-slate-500')}>
        <span className={'w-6 h-6 grid place-items-center rounded-full ' + (stage === i+1 ? 'bg-peie-blue text-white' : 'bg-slate-100')}>{i+1}</span>{label}
        {i<2 && <ChevronRight className="h-3 w-3 text-slate-400 ml-1" />}
      </span>)}
    </div>

    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input aria-label="Buscar herramientas" placeholder="Buscar por nombre, medida, código o marca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-11 pl-10 rounded-xl" /></div>
        <Button variant="outline" className="h-11" onClick={clearFilters}>Limpiar</Button>
        <Button variant="outline" className="h-11" aria-label="Exportar Excel" onClick={() => void exportToExcel()}><Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Excel</span></Button>
      </div>
      <FilterBar filters={[
        { key: 'status', label: 'Estado', value: filterStatus, options: statuses.map(s => ({ value:s, label:s })) },
        { key: 'obra', label: 'Obra actual', value: filterObra, options: obras.map(s => ({ value:s, label:s })) },
        { key: 'encargado', label: 'Coordinador', value: filterEncargado, options: encargados.map(s => ({ value:s, label:s })) },
      ]} onFilterChange={(key, value) => { if(key==='status') setFilterStatus(value); if(key==='obra') setFilterObra(value); if(key==='encargado') setFilterEncargado(value); }} />
    </div>

    {isAdmin && <details data-catalog-admin className="text-sm">
      <summary className="cursor-pointer text-peie-blue font-medium py-2">Administrar catálogo</summary>
      <div className="flex gap-2 flex-wrap mt-2">
      <Button size="sm" variant="outline" onClick={() => setIsGestionCategoriasOpen(true)}><Layers className="h-4 w-4 mr-2" />Gestionar categorías</Button>
      <Button size="sm" variant="outline" onClick={() => setIsImportarExcelOpen(true)}><FileSpreadsheet className="h-4 w-4 mr-2" />Importar categorías Excel</Button>
      <Button size="sm" variant="ghost" onClick={() => void exportToExcel(true)}>Exportar inventario completo</Button>
      </div>
    </details>}

    {loadError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{loadError}<Button size="sm" variant="ghost" onClick={() => void fetchHerramientas()}>Reintentar</Button></div>}
    {loading ? <p className="py-12 text-center text-slate-500">Cargando inventario…</p> : !showUnits ? <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(selectedCategory ? subcategories : categories).map(group => {
          const Icon = icons[selectedCategory || group.name] || Wrench;
          const available = group.rows.filter(tool => tool.status === 'Disponible').length;
          const categorySummary = 'subcategories' in group ? (group.subcategories as string[]).slice(0,3).join(' · ') : '';
          return <button key={group.name} type="button" onClick={() => selectedCategory ? setSelectedSubcategory(group.name) : (setSelectedCategory(group.name), setSelectedSubcategory(null))} className="rounded-2xl border border-slate-200 bg-white p-5 text-left flex flex-col gap-4 hover:border-blue-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-peie-blue">
            <span className="flex items-center justify-between gap-2"><span className="p-3 rounded-xl bg-blue-50 text-peie-blue"><Icon className="h-6 w-6" /></span><span className="text-xs rounded-full bg-slate-100 px-3 py-1 text-slate-600">{quantity(group.rows.length)}</span></span>
            <span className="font-bold text-base text-slate-800">{group.name}</span>
            {categorySummary && <span className="text-xs text-slate-500">{categorySummary}</span>}
            <span className={'text-xs ' + (/confirmar|Por clasificar/.test(group.name) ? 'text-amber-700' : 'text-slate-500')}>{/confirmar|Por clasificar/.test(group.name) ? 'Datos pendientes de confirmar' : group.rows.length ? availabilityLabel(available) : 'Sin unidades con los filtros actuales'}</span>
            <span className="flex justify-between items-center mt-auto text-sm font-medium text-peie-blue">{selectedCategory ? 'Ver herramientas' : 'Ver subcategorías'}<ChevronRight className="h-4 w-4" /></span>
          </button>;
        })}
      </div>
      {selectedCategory && !subcategories.length && <p className="text-center p-10 text-slate-500">Todavía no hay herramientas ni subcategorías registradas en esta categoría.</p>}
    </> : <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500" aria-live="polite">{quantity(filtered.length)} · {availabilityLabel(filtered.filter(t=>t.status==='Disponible').length)}</p>
        <div className="flex gap-1">
          <Button variant={viewMode==='grid'?'default':'outline'} size="sm" aria-label="Vista de tarjetas" aria-pressed={viewMode==='grid'} onClick={()=>setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant={viewMode==='list'?'default':'outline'} size="sm" aria-label="Vista de lista" aria-pressed={viewMode==='list'} onClick={()=>setViewMode('list')}><List className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className={viewMode==='grid'?'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4':'flex flex-col gap-3'}>
        {filtered.map(tool => {
          const Icon = icons[tool.classification.category] || Wrench;
          return <article key={tool.id} className={'rounded-2xl border border-slate-200 bg-white overflow-hidden ' + (viewMode==='list'?'sm:flex sm:items-center':'flex flex-col')}>
            {viewMode==='grid' && <button type="button" aria-label={'Abrir ' + tool.name + ' ' + tool.code} onClick={()=>openTool(tool.id)} className="h-36 w-full bg-slate-50 overflow-hidden"><ToolPhoto id={tool.id} name={tool.name} className="w-full h-full object-cover" fallback={<Icon className="h-8 w-8 text-slate-400" />} /></button>}
            <div className="p-4 flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap gap-2 items-center justify-between"><span className="font-mono text-xs text-slate-500 break-all">{tool.code}</span><span className={'text-xs px-2 py-1 border rounded-full ' + statusStyle(tool.status)}>{tool.status}</span></div>
              <button type="button" onClick={()=>openTool(tool.id)} className="text-left hover:text-peie-blue"><h2 className="text-base font-semibold">{tool.name}</h2></button>
              <p className="text-xs font-medium text-peie-blue">{tool.classification.category} › {tool.classification.subcategory}</p>
              <p className="text-xs text-slate-500">{tool.brand || 'Marca sin registrar'}{tool.model ? ' · ' + tool.model : ''}</p>
              <p className="text-xs text-slate-500 flex gap-1 items-center"><Building2 className="h-3.5 w-3.5 shrink-0" />{tool.obras?.name || 'Sin ubicación asignada'}</p>
            </div>
            <div className="p-3 border-t border-slate-100 flex gap-2 justify-between sm:shrink-0">
              <Button size="sm" variant="ghost" onClick={()=>openTool(tool.id)}>Ver ficha</Button>
              <Button size="sm" className="bg-peie-blue" onClick={()=>navigate('/solicitudes/nueva',{state:{herramientaId:tool.id}})}><Truck className="h-3.5 w-3.5 mr-1" />Pedir</Button>
            </div>
          </article>;
        })}
      </div>
      {!filtered.length && <div className="text-center py-12 px-4 border border-dashed rounded-2xl bg-white">
        <Wrench className="h-9 w-9 mx-auto mb-3 text-slate-300" />
        <h2 className="font-semibold text-slate-700">No encontramos herramientas</h2>
        <p className="text-sm text-slate-500 mt-2">{selectedSubcategory==='2 peldaños' ? 'No hay unidades registradas de 2 peldaños que coincidan con los filtros.' : 'Probá otra búsqueda o cambiá los filtros.'}</p>
        <Button variant="outline" className="mt-4" onClick={clearFilters}>Restablecer filtros</Button>
      </div>}
    </>}
    {isAdmin && isGestionCategoriasOpen && <ModalGestionCategorias open={isGestionCategoriasOpen} onOpenChange={setIsGestionCategoriasOpen} onCategoriesUpdated={fetchHerramientas} herramientas={herramientas} />}
    {isAdmin && isImportarExcelOpen && <ModalImportarCategoriasExcel open={isImportarExcelOpen} onOpenChange={setIsImportarExcelOpen} herramientas={herramientas} onSuccess={fetchHerramientas} />}
  </div>;
}
