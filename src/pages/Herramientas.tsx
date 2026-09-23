import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Wrench, Plus, Search, Layers, Disc, Hammer, Shield, Ruler, ChevronLeft, ChevronRight, Building2, LayoutGrid, List, Download, Truck, Camera, Package, FileSpreadsheet, Tag, type LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useToast } from '@/hooks/use-toast';
import { classifyTool, compareCategories, matchesToolSearch, type ToolClassification } from '../lib/toolTaxonomy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FilterBar from '../components/FilterBar';
import { inventoryGroup } from '../lib/inventoryGroups';
import ToolPhoto from '../components/ToolPhoto';
import ModalGestionCategorias from '../components/ModalGestionCategorias';
import ModalImportarCategoriasExcel from '../components/ModalImportarCategoriasExcel';

interface Herramienta {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  description?: string | null;
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
  const [selectedGroup, setSelectedGroup] = useState<string | null>(location.state?.group ?? null);
  const [searchTerm, setSearchTerm] = useState<string>(location.state?.searchTerm ?? '');
  const [filterObra, setFilterObra] = useState<string>(location.state?.filterObra ?? '');
  const [filterStatus, setFilterStatus] = useState<string>(location.state?.filterStatus ?? '');
  const [filterEncargado, setFilterEncargado] = useState<string>(location.state?.filterEncargado ?? '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(location.state?.viewMode === 'list' ? 'list' : 'grid');
  const [isGestionCategoriasOpen, setIsGestionCategoriasOpen] = useState(false);
  const [isImportarExcelOpen, setIsImportarExcelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const requestSequence = useRef(0);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'logistica';
  const canManageTools = ['admin', 'logistica', 'encargado', 'solicitante', 'coordinador'].includes(profile?.role || '');

  const fetchHerramientas = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const rows: Herramienta[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('herramientas')
          .select('id, code, name, brand, model, description, status, category, current_obra_id, obras(name, encargado_name)')
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
    from: '/herramientas', group: selectedGroup,
    searchTerm, filterObra, filterStatus, filterEncargado, viewMode,
  }), [selectedGroup, searchTerm, filterObra, filterStatus, filterEncargado, viewMode]);

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
    (!selectedGroup || inventoryGroup(tool).key === selectedGroup) &&
    matchesToolSearch(tool, searchTerm)
  ).sort((a,b) => a.name.localeCompare(b.name, 'es', { numeric: true }) || a.code.localeCompare(b.code, 'es', { numeric: true })), [scoped, selectedGroup, searchTerm]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; category: string; rows: ClassifiedTool[] }>();
    scoped.filter(tool => matchesToolSearch(tool, searchTerm)).forEach(tool => {
      const group = inventoryGroup(tool);
      if (!map.has(group.key)) map.set(group.key, { ...group, rows: [] });
      map.get(group.key)!.rows.push(tool);
    });
    return [...map.values()].sort((a, b) => compareCategories(a.category, b.category) || a.label.localeCompare(b.label, "es"));
  }, [scoped, searchTerm]);
  const selectedLabel = selectedGroup ? classified.map(inventoryGroup).find(group => group.key === selectedGroup)?.label || selectedGroup : "";
  const changeScope = (key: string, value: string) => {
    if (key === "obra") setFilterObra(value);
    if (key === "status") setFilterStatus(value);
    if (key === "encargado") setFilterEncargado(value);
  };

  const obras = useMemo(() => [...new Set(herramientas.flatMap(t => t.obras?.name ? [t.obras.name] : []))].sort(), [herramientas]);
  const encargados = useMemo(() => [...new Set(herramientas.flatMap(t => t.obras?.encargado_name ? [t.obras.encargado_name] : []))].sort(), [herramientas]);
  const statuses = useMemo(() => [...new Set(herramientas.map(t => t.status))].sort(), [herramientas]);
  const goHome = () => { setSelectedGroup(null); setSearchTerm(''); };
  const clearFilters = () => { setSearchTerm(''); setFilterObra(''); setFilterStatus(''); setFilterEncargado(''); setSelectedGroup(null); };
  const openTool = (id: string) => navigate('/herramientas/' + id, { state: navigationState });
  const exportToExcel = async (all = false) => {
    const rows = all ? classified : filtered;
    if (!rows.length) { toast({ title: 'Sin datos', description: 'No hay herramientas para exportar.' }); return; }
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(rows.map(tool => ({
        'Código': tool.code, 'Nombre': tool.name, 'Marca': tool.brand || '', 'Modelo': tool.model || '', 'Características': tool.description || '',
        'Categoría principal': tool.classification.category, 'Subcategoría': tool.classification.subcategory,
        'Estado': tool.status, 'Obra actual': tool.obras?.name || 'Sin ubicación asignada',
        'Coordinador': tool.obras?.encargado_name || '',
      })));
      sheet['!cols'] = [12, 36, 18, 24, 50, 25, 28, 20, 26, 26].map(wch => ({ wch }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Herramientas');
      XLSX.writeFile(workbook, 'Inventario_Herramientas_' + new Date().toISOString().slice(0,10) + '.xlsx');
      toast({ title: 'Inventario exportado', description: quantity(rows.length) + ' con categoría y subcategoría.' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'No se pudo exportar el inventario.' }); }
  };

  return <div className="space-y-2 sm:space-y-5 pb-safe">
    <div className="flex flex-row sm:flex-col xl:flex-row justify-between items-center sm:items-stretch gap-2 sm:gap-4">
      <div className="min-w-0">
        <nav aria-label="Ruta de herramientas" className="hidden sm:flex flex-wrap items-center gap-2 text-sm mb-3">
          <button type="button" onClick={goHome} className="text-peie-blue hover:underline py-1">Herramientas</button>
          {selectedGroup && <><ChevronRight className="h-4 w-4 text-slate-400" /><span aria-current="page" className="text-slate-600">{selectedLabel}</span></>}
        </nav>
        <div className="flex items-center gap-2">
          {(selectedGroup || searchTerm) && <Button variant="ghost" size="icon" aria-label="Volver al nivel anterior" onClick={() => searchTerm ? setSearchTerm('') : goHome()}><ChevronLeft className="h-5 w-5" /></Button>}
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-peie-blue">{selectedLabel || 'Herramientas'}</h1>
        </div>
        <p className="hidden sm:block text-sm text-slate-500 mt-1">{quantity(filtered.length)}</p>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <Button variant="outline" className="h-9 w-9 p-0 sm:h-10 sm:w-auto sm:px-4" aria-label="Buscar con cámara" onClick={() => navigate('/herramientas/busqueda-visual')}><Camera className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Buscar con foto</span></Button>
        {canManageTools && <Button className="bg-peie-blue h-9 px-2 sm:h-10 sm:px-4" aria-label="Nueva herramienta" onClick={() => navigate('/herramientas/nueva')}><Plus className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Nueva herramienta</span><span className="sm:hidden text-xs">Nueva</span></Button>}
      </div>
    </div>

    <div className="space-y-2 sm:space-y-3">
      <div className="flex gap-1 sm:gap-2">
        <div className="relative flex-1 min-w-0"><Search className="absolute left-2 top-2.5 sm:top-3.5 h-4 w-4 text-slate-400" /><Input aria-label="Buscar herramientas" placeholder="Buscar herramienta..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-9 sm:h-11 pl-7 text-sm rounded-lg" /></div>
        <Button variant="outline" className="h-9 sm:h-11 px-2 text-xs sm:text-sm" onClick={clearFilters}>Limpiar</Button>
        <Button variant="outline" className="h-9 w-9 p-0 sm:h-11 sm:w-auto sm:px-4 shrink-0" aria-label="Exportar Excel" onClick={() => void exportToExcel()}><Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Excel</span></Button>
      </div>
      <div className="max-sm:[&>div]:grid max-sm:[&>div]:grid-cols-3 max-sm:[&>div]:gap-1 max-sm:[&>div>div]:min-w-0 max-sm:[&_select]:w-full max-sm:[&_select]:h-9 max-sm:[&_select]:truncate max-sm:[&_select]:rounded-lg max-sm:[&_select]:pl-2 max-sm:[&>div>button]:hidden">
      <FilterBar filters={[
        { key: 'status', label: 'Estado', value: filterStatus, options: statuses.map(s => ({ value:s, label:s })) },
        { key: 'obra', label: 'Obra actual', value: filterObra, options: obras.map(s => ({ value:s, label:s })) },
        { key: 'encargado', label: 'Coordinador', value: filterEncargado, options: encargados.map(s => ({ value:s, label:s })) },
      ]} onFilterChange={changeScope} />
      </div>
    </div>

    {isAdmin && <details data-catalog-admin className="text-sm">
      <summary className="cursor-pointer text-peie-blue font-medium text-xs sm:text-sm py-1 sm:py-2">Administrar catálogo</summary>
      <div className="flex gap-2 flex-wrap mt-2">
      <Button size="sm" variant="outline" onClick={() => setIsGestionCategoriasOpen(true)}><Layers className="h-4 w-4 mr-2" />Gestionar categorías</Button>
      <Button size="sm" variant="outline" onClick={() => setIsImportarExcelOpen(true)}><FileSpreadsheet className="h-4 w-4 mr-2" />Importar categorías Excel</Button>
      <Button size="sm" variant="ghost" onClick={() => void exportToExcel(true)}>Exportar inventario completo</Button>
      </div>
    </details>}

    {loadError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{loadError}<Button size="sm" variant="ghost" onClick={() => void fetchHerramientas()}>Reintentar</Button></div>}
    {loading ? <p className="py-12 text-center text-slate-500">Cargando inventario…</p> : !selectedGroup && !searchTerm.trim() ? <>
      <p className="text-xs text-slate-500">Elegí un grupo para ver las unidades y dónde están.</p>
      <div data-tool-groups className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
        {groups.map(group => {
          const Icon = icons[group.category] || Wrench;
          const locations = new Set(group.rows.map(tool => tool.current_obra_id).filter(Boolean)).size;
          return <button key={group.key} onClick={() => setSelectedGroup(group.key)} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-left space-y-2 hover:border-blue-400 hover:shadow-sm">
            <div data-group-cover className="aspect-video overflow-hidden rounded-xl bg-slate-50">
              <ToolPhoto landscape id={group.rows[0].id} candidateIds={group.rows.map(tool => tool.id)} name={group.label} className="w-full h-full object-contain" fallback={<Icon className="h-10 w-10 text-slate-300" />} />
            </div>
            <div className="flex items-center justify-between gap-2"><Icon className="h-6 w-6 text-peie-blue" /><span className="text-xl font-bold text-peie-blue">{group.rows.length}</span></div>
            <h2 className="font-semibold text-sm text-slate-800 break-words">{group.label}</h2>
            <p className="text-xs text-slate-500">{quantity(group.rows.length)} · {locations} {locations === 1 ? "obra" : "obras"}</p>
            <span className="text-xs font-semibold text-peie-blue flex items-center justify-between">Ver dónde están<ChevronRight className="h-4 w-4" /></span>
          </button>;
        })}
      </div>
      {!groups.length && <p className="text-sm text-slate-500 py-8 text-center">No hay herramientas con estos filtros.</p>}
    </> : <>
      <Button variant="ghost" className="h-8 px-0 text-peie-blue" onClick={goHome}><ChevronLeft className="h-4 w-4 mr-1" />Volver a grupos</Button>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500" aria-live="polite">{quantity(filtered.length)} · {availabilityLabel(filtered.filter(t=>t.status==='Disponible').length)}</p>
        <div className="hidden sm:flex gap-1">
          <Button variant={viewMode==='grid'?'default':'outline'} size="sm" aria-label="Vista de tarjetas" aria-pressed={viewMode==='grid'} onClick={()=>setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant={viewMode==='list'?'default':'outline'} size="sm" aria-label="Vista de lista" aria-pressed={viewMode==='list'} onClick={()=>setViewMode('list')}><List className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className={isMobile || viewMode==='grid'?'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4':'flex flex-col gap-3'}>
        {filtered.map(tool => {
          const Icon = icons[tool.classification.category] || Wrench;
          return <article key={tool.id} className={'min-w-0 rounded-2xl border border-slate-200 bg-white overflow-hidden ' + (!isMobile && viewMode==='list'?'sm:flex sm:items-center':'flex flex-col')}>
            {(isMobile || viewMode==='grid') && <button type="button" aria-label={'Abrir ' + tool.name + ' ' + tool.code} onClick={()=>openTool(tool.id)} className="h-20 sm:h-36 w-full bg-slate-50 overflow-hidden"><ToolPhoto id={tool.id} name={tool.name} className="w-full h-full object-cover" fallback={<Icon className="h-8 w-8 text-slate-400" />} /></button>}
            <div className="p-2 sm:p-4 flex-1 min-w-0 space-y-1 sm:space-y-2 break-words">
              <div className="flex flex-wrap gap-1 sm:gap-2 items-center justify-between"><span className="font-mono text-[10px] sm:text-xs text-slate-500 break-all">{tool.code}</span><span className={'text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 border rounded-full ' + statusStyle(tool.status)}>{tool.status}</span></div>
              <button type="button" onClick={()=>openTool(tool.id)} className="text-left hover:text-peie-blue"><h2 className="text-sm sm:text-base font-semibold">{tool.name}</h2></button>
              <p className="text-xs font-medium text-peie-blue">{tool.classification.category} › {tool.classification.subcategory}</p>
              <p className="text-xs text-slate-500">{tool.brand || 'Marca sin registrar'}{tool.model ? ' · ' + tool.model : ''}</p>
              <p className="text-xs text-slate-500 flex gap-1 items-center"><Building2 className="h-3.5 w-3.5 shrink-0" />{tool.obras?.name || 'Sin ubicación asignada'}</p>
              <p className="text-xs text-slate-600">Responsable: {tool.obras?.encargado_name || 'Sin asignar'}</p>
            </div>
            <div className="p-2 sm:p-3 border-t border-slate-100 flex flex-wrap gap-1 justify-between sm:shrink-0">
              <Button size="sm" aria-label="Ver ficha" className="px-2 text-xs sm:text-sm" variant="ghost" onClick={()=>openTool(tool.id)}><span className="sm:hidden">Ficha</span><span className="hidden sm:inline">Ver ficha</span></Button>
              <Button size="sm" className="bg-peie-blue px-2 text-xs sm:text-sm" onClick={()=>navigate('/solicitudes/nueva',{state:{herramientaId:tool.id}})}><Truck className="h-3.5 w-3.5 mr-1" />Pedir</Button>
            </div>
          </article>;
        })}
      </div>
      {!filtered.length && <div className="text-center py-12 px-4 border border-dashed rounded-2xl bg-white">
        <Wrench className="h-9 w-9 mx-auto mb-3 text-slate-300" />
        <h2 className="font-semibold text-slate-700">No encontramos herramientas</h2>
        <p className="text-sm text-slate-500 mt-2">Probá otra búsqueda o cambiá los filtros.</p>
        <Button variant="outline" className="mt-4" onClick={clearFilters}>Restablecer filtros</Button>
      </div>}
    </>}
    {isAdmin && isGestionCategoriasOpen && <ModalGestionCategorias open={isGestionCategoriasOpen} onOpenChange={setIsGestionCategoriasOpen} onCategoriesUpdated={fetchHerramientas} herramientas={herramientas} />}
    {isAdmin && isImportarExcelOpen && <ModalImportarCategoriasExcel open={isImportarExcelOpen} onOpenChange={setIsImportarExcelOpen} herramientas={herramientas} onSuccess={fetchHerramientas} />}
  </div>;
}
