import { classifyTool, matchesToolSearch } from '../../lib/toolTaxonomy';
import { useState, useMemo, useEffect } from 'react';
import type { OperationalWorksite, OperationalTool, GeoCoordinates } from '../../types/operations';
import { calculateHaversineDistance, formatDistance } from '../../services/geo/haversine';
import { TUCUMAN_CENTER, KNOWN_TUCUMAN_LOCATIONS } from '../../services/geo/tucumanGeoRegistry';
import { 
  MapPin, Navigation, Search, Wrench, ExternalLink, Sparkles, 
  Building2, Crosshair, X, CheckCircle2, ChevronRight, Phone, Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NearestToolFinderProps {
  worksites: OperationalWorksite[];
  allTools: OperationalTool[];
  onFlyTo: (coords: GeoCoordinates, obraId?: string) => void;
  onSelectWorksite?: (worksite: OperationalWorksite) => void;
  onSetMapOrigin?: (coords: GeoCoordinates | null) => void;
  mapClickCoords?: GeoCoordinates | null;
  onClose?: () => void;
}

export interface NearestToolMatch {
  tool: OperationalTool;
  worksite: OperationalWorksite | null;
  locationName: string;
  coordinates: GeoCoordinates;
  distanceKm: number;
  formattedDistance: string;
  isDirectGPS: boolean;
}

const TUCUMAN_PRESETS: { label: string; coords: GeoCoordinates }[] = [
  { label: 'Centro (Plaza Indep.)', coords: { latitude: -26.83113, longitude: -26.83113 ? -65.2045 : -65.2045 } },
  { label: 'Depósito PEIE', coords: { latitude: -26.83500, longitude: -65.22500 } },
  { label: 'Barrio Norte', coords: { latitude: -26.81880, longitude: -65.20732 } },
  { label: 'Yerba Buena', coords: { latitude: -26.81820, longitude: -65.29050 } },
  { label: 'Tafí Viejo', coords: { latitude: -26.77850, longitude: -65.23800 } },
  { label: 'Banda del Río Salí', coords: { latitude: -26.85018, longitude: -65.16777 } },
];

export default function NearestToolFinder({
  worksites,
  allTools,
  onFlyTo,
  onSelectWorksite,
  onSetMapOrigin,
  mapClickCoords,
  onClose,
}: NearestToolFinderProps) {
  // Origin State
  const [originInput, setOriginInput] = useState('');
  const [originCoords, setOriginCoords] = useState<GeoCoordinates>(TUCUMAN_CENTER);
  const [originLabel, setOriginLabel] = useState('San Miguel de Tucumán (Centro)');
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [isMapPickActive, setIsMapPickActive] = useState(false);

  // Search & Filter State
  const [toolQuery, setToolQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Sync with external click on map
  useEffect(() => {
    if (mapClickCoords) {
      setOriginCoords(mapClickCoords);
      setOriginLabel(`Coordenadas: ${mapClickCoords.latitude.toFixed(4)}, ${mapClickCoords.longitude.toFixed(4)}`);
      setOriginInput(`${mapClickCoords.latitude.toFixed(5)}, ${mapClickCoords.longitude.toFixed(5)}`);
      onSetMapOrigin?.(mapClickCoords);
      setIsMapPickActive(false);
    }
  }, [mapClickCoords]);

  // Handle GPS detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }
    setIsLocatingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setOriginCoords(coords);
        setOriginLabel('Mi Ubicación GPS Actual');
        setOriginInput(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        onSetMapOrigin?.(coords);
        setIsLocatingGPS(false);
        onFlyTo(coords);
      },
      (err) => {
        setIsLocatingGPS(false);
        console.warn('GPS Error:', err);
        alert('No se pudo obtener tu ubicación GPS. Podés elegir un punto de Tucumán o ingresar coordenadas.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Parse custom text or coordinates input
  const handleApplyOriginText = () => {
    const text = originInput.trim();
    if (!text) return;

    // 1. Check if coordinates: lat, lng
    const coordMatch = text.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat < 0 && lng < 0) {
        const newCoords = { latitude: lat, longitude: lng };
        setOriginCoords(newCoords);
        setOriginLabel(`Punto Personalizado (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        onSetMapOrigin?.(newCoords);
        onFlyTo(newCoords);
        return;
      }
    }

    // 2. Check if matches any known Tucumán location
    const normText = text.toUpperCase();
    for (const [key, coords] of Object.entries(KNOWN_TUCUMAN_LOCATIONS)) {
      if (key.includes(normText) || normText.includes(key)) {
        setOriginCoords(coords);
        setOriginLabel(`Ubicación: ${key}`);
        onSetMapOrigin?.(coords);
        onFlyTo(coords);
        return;
      }
    }

    // 3. Check if matches any obra name or address
    const matchedObra = worksites.find((w) => 
      w.name.toUpperCase().includes(normText) || 
      (w.address && w.address.toUpperCase().includes(normText))
    );
    if (matchedObra) {
      const coords = { latitude: matchedObra.latitude, longitude: matchedObra.longitude };
      setOriginCoords(coords);
      setOriginLabel(`Obra: ${matchedObra.name}`);
      onSetMapOrigin?.(coords);
      onFlyTo(coords, matchedObra.id);
      return;
    }

    alert('No reconocimos esa dirección en Tucumán. Probá ingresar coordenadas (ej: -26.83, -65.22) o seleccionar un punto.');
  };

  const handleSelectPreset = (preset: { label: string; coords: GeoCoordinates }) => {
    setOriginCoords(preset.coords);
    setOriginLabel(preset.label);
    setOriginInput(`${preset.coords.latitude.toFixed(5)}, ${preset.coords.longitude.toFixed(5)}`);
    onSetMapOrigin?.(preset.coords);
    onFlyTo(preset.coords);
  };

  // Compute nearest tools using Haversine formula
  const rankedTools: NearestToolMatch[] = useMemo(() => {
    if (!originCoords) return [];

    const normQuery = toolQuery.trim().toLowerCase();
    const worksiteMap = new Map<string, OperationalWorksite>();
    worksites.forEach((w) => worksiteMap.set(w.id, w));

    const matches: NearestToolMatch[] = [];

    allTools.forEach((tool) => {
      // 1. Availability filter
      if (onlyAvailable && tool.status !== 'Disponible') {
        return;
      }

      // 2. Query filter
      if (normQuery) {
        if (!matchesToolSearch(tool, normQuery)) {
          return;
        }
      }

      // 3. Category filter
      if (selectedCategory !== 'all' && classifyTool(tool).category !== selectedCategory) {
        return;
      }

      // 4. Determine tool coordinates
      let toolCoords: GeoCoordinates | null = null;
      let isDirectGPS = false;
      let worksite: OperationalWorksite | null = null;
      let locationName = 'Ubicación Desconocida';

      if (
        typeof tool.last_latitude === 'number' &&
        typeof tool.last_longitude === 'number' &&
        tool.last_latitude !== 0 &&
        tool.last_longitude !== 0
      ) {
        toolCoords = { latitude: tool.last_latitude, longitude: tool.last_longitude };
        isDirectGPS = true;
        locationName = 'GPS directo de la herramienta';
      } else if (tool.current_obra_id && worksiteMap.has(tool.current_obra_id)) {
        worksite = worksiteMap.get(tool.current_obra_id)!;
        toolCoords = { latitude: worksite.latitude, longitude: worksite.longitude };
        locationName = worksite.name;
      } else {
        // Fallback to central warehouse
        toolCoords = { latitude: -26.83500, longitude: -65.22500 };
        locationName = 'Depósito Central PEIE';
      }

      const distanceKm = calculateHaversineDistance(originCoords, toolCoords);

      matches.push({
        tool,
        worksite,
        locationName,
        coordinates: toolCoords,
        distanceKm,
        formattedDistance: formatDistance(distanceKm),
        isDirectGPS,
      });
    });

    return matches.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [allTools, worksites, originCoords, toolQuery, onlyAvailable, selectedCategory]);

  const topMatch = rankedTools[0] || null;
  const otherMatches = rankedTools.slice(1, 5);

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    allTools.forEach((t) => {
      set.add(classifyTool(t).category);
    });
    return Array.from(set);
  }, [allTools]);

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-4 max-h-[85vh] overflow-y-auto w-full max-w-lg font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-peie-blue text-white shadow-xs">
            <Compass className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 leading-tight flex items-center gap-1.5">
              Recomendador de Herramienta Más Cercana
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Calcula la distancia Haversine a herramientas disponibles en Tucumán
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X size={18} />
          </button>
        )}
      </div>

      {/* 1. Selección de Origen / Ubicación de Partida */}
      <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-red-500" /> Punto de Origen:
          </span>
          <span className="text-[11px] font-extrabold text-peie-blue truncate max-w-[200px]" title={originLabel}>
            {originLabel}
          </span>
        </div>

        {/* Input con botón Aplicar y GPS */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Input
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyOriginText()}
              placeholder="Dirección, obra o coordenadas lat,lng..."
              className="h-9 text-xs pl-8 rounded-xl bg-white"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
          <Button
            size="sm"
            onClick={handleApplyOriginText}
            className="h-9 px-2.5 text-xs font-bold bg-peie-blue text-white rounded-xl"
          >
            Fijar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDetectGPS}
            disabled={isLocatingGPS}
            title="Usar GPS actual"
            className="h-9 px-2.5 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocatingGPS ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Chips de puntos de referencia en Gran San Miguel de Tucumán */}
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <span className="text-[10px] text-slate-400 font-bold mr-1">Rápidos:</span>
          {TUCUMAN_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handleSelectPreset(p)}
              className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all border ${
                originLabel === p.label
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => {
              setIsMapPickActive(true);
              alert('Hacé click en cualquier punto del mapa para fijar tu ubicación de origen.');
            }}
            className={`text-[10px] px-2 py-0.5 rounded-md font-bold border flex items-center gap-1 ${
              isMapPickActive
                ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Crosshair className="w-2.5 h-2.5" /> Elegir en Mapa
          </button>
        </div>
      </div>

      {/* 2. Filtro de Herramienta */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              value={toolQuery}
              onChange={(e) => setToolQuery(e.target.value)}
              placeholder="¿Qué herramienta buscás? (ej: amoladora, rotomartillo...)"
              className="h-9 text-xs pl-8 rounded-xl"
            />
            <Wrench className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none shrink-0 bg-slate-50 px-2.5 py-2 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="rounded text-peie-blue focus:ring-peie-blue h-3.5 w-3.5"
            />
            <span>Solo Disponibles</span>
          </label>
        </div>

        {categoriesList.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap border ${
                selectedCategory === 'all'
                  ? 'bg-peie-blue text-white border-peie-blue'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todas ({allTools.length})
            </button>
            {categoriesList.slice(0, 6).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap border ${
                  selectedCategory === cat
                    ? 'bg-peie-blue text-white border-peie-blue'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. RECOMENDACIÓN DESTACADA (#1 MÁS CERCANA) */}
      {topMatch ? (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-blue-50 border-2 border-emerald-300 shadow-sm relative overflow-hidden">
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
              <Sparkles className="w-3 h-3" /> Opción #1 Más Cercana
            </div>

            <div className="pr-24">
              <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded font-bold">
                {topMatch.tool.code}
              </span>
              <h4 className="text-sm font-black text-slate-900 mt-1 leading-tight">
                {topMatch.tool.name}
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                {topMatch.tool.brand} {topMatch.tool.model}
              </p>
            </div>

            {/* Distancia y Ubicación */}
            <div className="mt-3 grid grid-cols-2 gap-2 bg-white/80 p-2.5 rounded-xl border border-emerald-150">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Distancia</p>
                <p className="text-base font-black text-emerald-700 font-mono leading-none mt-0.5">
                  {topMatch.formattedDistance}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Línea recta (Haversine)</p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Ubicación / Obra</p>
                <p className="text-xs font-black text-slate-800 truncate mt-0.5 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-peie-blue shrink-0" />
                  <span className="truncate">{topMatch.locationName}</span>
                </p>
                {topMatch.worksite?.encargado_name && (
                  <p className="text-[10px] text-slate-500 truncate font-medium">
                    Encargado: {topMatch.worksite.encargado_name}
                  </p>
                )}
              </div>
            </div>

            {/* Botones de Acción Inmediata */}
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onFlyTo(topMatch.coordinates, topMatch.worksite?.id);
                  if (topMatch.worksite && onSelectWorksite) {
                    onSelectWorksite(topMatch.worksite);
                  }
                }}
                className="flex-1 h-8 bg-peie-blue hover:bg-peie-blue/90 text-white text-xs font-bold rounded-xl"
              >
                <Crosshair className="w-3 h-3 mr-1" /> Ver en Mapa
              </Button>

              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${originCoords.latitude},${originCoords.longitude}&destination=${topMatch.coordinates.latitude},${topMatch.coordinates.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 h-8 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
                title="Abrir indicaciones en Google Maps"
              >
                <ExternalLink className="w-3 h-3 text-blue-600" /> Cómo llegar
              </a>

              {topMatch.worksite?.phone && (
                <a
                  href={`tel:${topMatch.worksite.phone}`}
                  className="flex items-center justify-center h-8 w-8 rounded-xl bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                  title="Llamar al encargado de la obra"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Alternativas Cercanas (Top 2 a 5) */}
          {otherMatches.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Otras opciones cercanas ({rankedTools.length} disponibles)
              </p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {otherMatches.map((m, idx) => (
                  <div
                    key={m.tool.id}
                    onClick={() => {
                      onFlyTo(m.coordinates, m.worksite?.id);
                      if (m.worksite && onSelectWorksite) {
                        onSelectWorksite(m.worksite);
                      }
                    }}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-100 cursor-pointer transition-colors text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400 font-bold">#{idx + 2}</span>
                        <span className="font-black text-slate-800 truncate">{m.tool.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <Building2 className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        {m.locationName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black text-peie-blue border border-blue-200 bg-blue-50/70">
                        {m.formattedDistance}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
          <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No se encontraron herramientas con esos criterios</p>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            Probá quitando el filtro de &ldquo;Solo Disponibles&rdquo; o buscando otro término más general.
          </p>
          {onlyAvailable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOnlyAvailable(false)}
              className="text-xs font-bold mt-1"
            >
              Ver también herramientas en uso
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
