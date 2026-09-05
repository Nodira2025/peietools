import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import LogoLoader from '../components/LogoLoader';
import OperationsMap from '../components/operations/OperationsMap';
import OperationsSidebar from '../components/operations/OperationsSidebar';
import OperationsKPIs from '../components/operations/OperationsKPIs';
import OperationsFilters from '../components/operations/OperationsFilters';
import RecommendationCards from '../components/operations/RecommendationCards';
import type {
  OperationalWorksite,
  OperationalEmployee,
  OperationalTool,
  OperationsKPIs as KPIsType,
  OperationsFilterState,
} from '../types/operations';
import { resolveWorksiteCoordinates } from '../services/geo/tucumanGeoRegistry';
import {
  calculateRawMagnitude,
  computeRelativeBubbleRadius,
} from '../services/operations/magnitudeCalculator';
import {
  generateOperationalSuggestions,
  type OperationalSuggestion,
} from '../services/operations/recommendationEngine';

import { Compass, Sparkles, SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';

export default function CentroOperaciones() {
  const [loading, setLoading] = useState(true);
  const [worksites, setWorksites] = useState<OperationalWorksite[]>([]);
  const [allEmployees, setAllEmployees] = useState<OperationalEmployee[]>([]);
  const [allTools, setAllTools] = useState<OperationalTool[]>([]);
  const [selectedWorksiteId, setSelectedWorksiteId] = useState<string | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showSuggestionsDrawer, setShowSuggestionsDrawer] = useState(false);

  // Filters State
  const [filters, setFilters] = useState<OperationsFilterState>({
    searchQuery: '',
    showWorksites: true,
    showStaff: true,
    showTools: true,
    selectedStatus: '',
    selectedSpecialty: '',
    selectedCategory: '',
    selectedEncargado: '',
  });

  // 1. Data Fetching from Supabase
  useEffect(() => {
    async function loadOperationalData() {
      try {
        setLoading(true);

        const [obrasRes, empsRes, toolsRes] = await Promise.all([
          supabase
            .from('obras')
            .select('id, code, name, address, encargado_name, phone, latitude, longitude, photo_url, active, status')
            .order('name'),
          supabase
            .from('empleados')
            .select('id, full_name, role, whatsapp, active, obra_id, status, specialty, photo_url')
            .order('full_name'),
          supabase
            .from('herramientas')
            .select('id, code, name, description, brand, model, photo_url, status, current_obra_id, category, last_latitude, last_longitude')
            .order('name'),
        ]);

        const rawObras = obrasRes.data || [];
        const rawEmps: OperationalEmployee[] = (empsRes.data || []).map((e: any) => ({
          ...e,
          lastKnownLocation: null,
          lastLocationUpdate: null,
        }));
        const rawTools: OperationalTool[] = (toolsRes.data || []).map((t: any) => ({
          ...t,
        }));

        setAllEmployees(rawEmps);
        setAllTools(rawTools);

        // Map workers and tools to worksites
        const initialWorksites: Omit<OperationalWorksite, 'bubbleRadiusPx'>[] = rawObras.map((obra: any) => {
          const assignedWorkers = rawEmps.filter((e) => e.obra_id === obra.id);
          const assignedTools = rawTools.filter((t) => t.current_obra_id === obra.id);
          const { coordinates, isSimulated } = resolveWorksiteCoordinates(obra);

          const rawMagnitude = calculateRawMagnitude(
            assignedWorkers.length,
            assignedTools.length,
            obra.active ? 1.5 : 0.5
          );

          return {
            id: obra.id,
            code: obra.code || null,
            name: obra.name,
            address: obra.address || null,
            encargado_name: obra.encargado_name || null,
            status: obra.status || (obra.active ? 'Activa' : 'Inactiva'),
            active: obra.active ?? true,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            isSimulatedLocation: isSimulated,
            photo_url: obra.photo_url || null,
            workersCount: assignedWorkers.length,
            toolsCount: assignedTools.length,
            assignedWorkers,
            assignedTools,
            magnitudeIndex: rawMagnitude,
          };
        });

        // Compute min & max magnitudes for relative logarithmic sizing
        const magnitudes = initialWorksites.map((w) => w.magnitudeIndex);
        const minMag = Math.min(...magnitudes, 0);
        const maxMag = Math.max(...magnitudes, 10);

        const finalWorksites: OperationalWorksite[] = initialWorksites.map((w) => ({
          ...w,
          bubbleRadiusPx: computeRelativeBubbleRadius(w.magnitudeIndex, minMag, maxMag),
        }));

        setWorksites(finalWorksites);
      } catch (err) {
        console.error('Error loading operational data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOperationalData();
  }, []);

  // 2. Coordinators list for filters
  const encargadosList = useMemo(() => {
    return Array.from(
      new Set(worksites.map((w) => w.encargado_name).filter((name): name is string => Boolean(name)))
    ).sort();
  }, [worksites]);

  // 3. Global Search & Filter Matching
  const filteredWorksites = useMemo(() => {
    return worksites.filter((w) => {
      // Coordinator filter
      if (filters.selectedEncargado && w.encargado_name !== filters.selectedEncargado) {
        return false;
      }

      // Search Query filter (matches worksite name, assigned worker name, or assigned tool name/code)
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        const matchesWorksite =
          w.name.toLowerCase().includes(query) ||
          (w.address && w.address.toLowerCase().includes(query)) ||
          (w.encargado_name && w.encargado_name.toLowerCase().includes(query));

        const matchesWorker = w.assignedWorkers.some(
          (emp) =>
            emp.full_name.toLowerCase().includes(query) ||
            (emp.specialty && emp.specialty.toLowerCase().includes(query))
        );

        const matchesTool = w.assignedTools.some(
          (tool) =>
            tool.name.toLowerCase().includes(query) ||
            tool.code.toLowerCase().includes(query) ||
            (tool.brand && tool.brand.toLowerCase().includes(query))
        );

        return matchesWorksite || matchesWorker || matchesTool;
      }

      return true;
    });
  }, [worksites, filters]);

  // Handle Search Fly-to
  useEffect(() => {
    if (!filters.searchQuery.trim() || filteredWorksites.length === 0) return;

    // Focus on the first match
    const target = filteredWorksites[0];
    setFlyToCoords({ latitude: target.latitude, longitude: target.longitude });
    setSelectedWorksiteId(target.id);
  }, [filters.searchQuery, filteredWorksites]);

  // 4. Compute KPIs
  const kpis: KPIsType = useMemo(() => {
    const totalActiveWorksites = worksites.filter((w) => w.active).length;
    const totalFieldWorkers = allEmployees.filter((e) => e.status === 'Trabajando').length;
    const totalAvailableWorkers = allEmployees.filter(
      (e) => e.status === 'Libre' || !e.obra_id || e.status === 'Disponible'
    ).length;
    const totalInUseTools = allTools.filter((t) => t.status === 'En uso').length;
    const totalAvailableTools = allTools.filter((t) => t.status === 'Disponible').length;

    // Alerts: inactive worksites with resources, or active worksites with 0 workers
    const alertsCount = worksites.filter(
      (w) => (!w.active && (w.workersCount > 0 || w.toolsCount > 0)) || (w.active && w.workersCount === 0)
    ).length;

    return {
      totalActiveWorksites,
      totalFieldWorkers,
      totalAvailableWorkers,
      totalInUseTools,
      totalAvailableTools,
      alertsCount,
      suggestionsCount: 0,
    };
  }, [worksites, allEmployees, allTools]);

  // 5. Generate Deterministic Suggestions
  const suggestions: OperationalSuggestion[] = useMemo(() => {
    return generateOperationalSuggestions(worksites, allEmployees, allTools);
  }, [worksites, allEmployees, allTools]);

  const selectedWorksite = useMemo(() => {
    return worksites.find((w) => w.id === selectedWorksiteId) || null;
  }, [worksites, selectedWorksiteId]);

  const handleSelectWorksite = (worksite: OperationalWorksite) => {
    setSelectedWorksiteId(worksite.id);
    setFlyToCoords({ latitude: worksite.latitude, longitude: worksite.longitude });
    setShowMobileDrawer(true);
  };

  if (loading) {
    return <LogoLoader fullScreen text="Cargando Centro de Operaciones..." size="md" />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] overflow-hidden font-sans space-y-2 p-2 sm:p-3">
      {/* 1. Header & KPIs */}
      <div className="space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-peie-blue text-white shadow-sm">
              <Compass className="h-5 w-5 text-sky-400 animate-spin" style={{ animationDuration: '20s' }} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-peie-blue tracking-tight leading-none">
                Centro de Operaciones
              </h1>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                Radar geoespacial y logística de obras en Gran San Miguel de Tucumán
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSuggestionsDrawer(!showSuggestionsDrawer)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-black shadow-sm transition-all"
          >
            <Sparkles size={14} className="text-amber-600" />
            <span>Sugerencias ({suggestions.length})</span>
            {showSuggestionsDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Top KPIs Banner */}
        <OperationsKPIs kpis={{ ...kpis, suggestionsCount: suggestions.length }} />

        {/* Filter bar & Global Search */}
        <OperationsFilters
          filters={filters}
          onFilterChange={setFilters}
          encargadosList={encargadosList}
          searchMatchesCount={filteredWorksites.length}
        />
      </div>

      {/* Sugerencias Operativas Desplegables (Banner Superior) */}
      {showSuggestionsDrawer && (
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl max-h-56 overflow-y-auto animate-in fade-in duration-200 shrink-0">
          <RecommendationCards
            suggestions={suggestions}
            worksites={worksites}
            onFlyToWorksite={handleSelectWorksite}
          />
        </div>
      )}

      {/* 2. Main Map & Contextual Panel Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0 relative">
        {/* Geographic MapLibre Container */}
        <div className="flex-1 h-full min-h-[350px] rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          <OperationsMap
            worksites={filteredWorksites}
            selectedWorksiteId={selectedWorksiteId}
            onSelectWorksite={handleSelectWorksite}
            flyToCoords={flyToCoords}
          />
        </div>

        {/* Desktop Contextual Sidebar (Hidden on Mobile) */}
        <div className="hidden md:block w-80 lg:w-96 h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 shrink-0 bg-white">
          <OperationsSidebar
            selectedWorksite={selectedWorksite}
            onClose={() => setSelectedWorksiteId(null)}
            allWorksites={worksites}
            onSelectWorksite={handleSelectWorksite}
          />
        </div>

        {/* Mobile Floating Drawer Trigger & Drawer */}
        <div className="md:hidden">
          {selectedWorksite && showMobileDrawer && (
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
              <OperationsSidebar
                selectedWorksite={selectedWorksite}
                onClose={() => setShowMobileDrawer(false)}
                allWorksites={worksites}
                onSelectWorksite={handleSelectWorksite}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
