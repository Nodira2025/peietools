import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, Popup, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { OperationalWorksite } from '../../types/operations';
import { TUCUMAN_CENTER } from '../../services/geo/tucumanGeoRegistry';

interface OperationsMapProps {
  worksites: OperationalWorksite[];
  selectedWorksiteId: string | null;
  onSelectWorksite: (worksite: OperationalWorksite) => void;
  flyToCoords?: { latitude: number; longitude: number } | null;
}

export default function OperationsMap({
  worksites,
  selectedWorksiteId,
  onSelectWorksite,
  flyToCoords,
}: OperationsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  // 1. Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({

      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [TUCUMAN_CENTER.longitude, TUCUMAN_CENTER.latitude],
      zoom: 12.2,
      minZoom: 8,
      maxZoom: 18,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Handle fly-to requests
  useEffect(() => {
    if (!mapRef.current || !flyToCoords) return;
    mapRef.current.flyTo({
      center: [flyToCoords.longitude, flyToCoords.latitude],
      zoom: 14.5,
      essential: true,
      speed: 1.4,
    });
  }, [flyToCoords]);

  // 3. Render Custom Magnitude Bubbles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    worksites.forEach((worksite) => {
      const isSelected = worksite.id === selectedWorksiteId;
      const size = Math.max(38, worksite.bubbleRadiusPx || 48);

      // Outer Marker Wrapper
      const el = document.createElement('div');
      el.className = 'peie-operation-bubble-marker cursor-pointer select-none';
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;

      // Bubble styling with dynamic magnitude
      const hasPhoto = Boolean(worksite.photo_url);
      const isCompact = size < 46;

      const innerContent = `
        <div class="relative w-full h-full rounded-full transition-all duration-300 transform group hover:scale-110 flex items-center justify-center ${
          isSelected
            ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-white shadow-2xl z-30 scale-105'
            : 'hover:ring-2 hover:ring-blue-500 shadow-lg'
        }" style="background: radial-gradient(circle at 30% 30%, #042454, #031530); border: 2.5px solid ${
        worksite.isSimulatedLocation ? '#94a3b8' : '#38bdf8'
      };">
          ${
            hasPhoto
              ? `<img src="${worksite.photo_url}" class="absolute inset-0 w-full h-full object-cover rounded-full opacity-35 group-hover:opacity-45 transition-opacity" />`
              : ''
          }
          <div class="relative z-10 flex flex-col items-center justify-center text-white px-1 leading-none text-center pointer-events-none">
            ${
              isCompact
                ? `<span class="text-[10px] font-black tracking-tight">${worksite.workersCount}👷</span>`
                : `
                <span class="text-[9px] font-extrabold uppercase tracking-tight text-blue-200 truncate max-w-[90%] drop-shadow">
                  ${worksite.name.split(' ')[0]}
                </span>
                <div class="flex items-center gap-1 mt-0.5 font-black text-[10px] drop-shadow-md">
                  <span class="text-amber-300">👷${worksite.workersCount}</span>
                  <span class="text-sky-300">🛠${worksite.toolsCount}</span>
                </div>
              `
            }
          </div>
          ${
            worksite.isSimulatedLocation
              ? `<span title="Ubicación referencial en Tucumán" class="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 border border-white rounded-full"></span>`
              : ''
          }
        </div>
      `;

      el.innerHTML = innerContent;

      // Tooltip preview on hover
      const popup = new Popup({
        offset: size / 2 + 6,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(`
        <div class="p-2.5 font-sans min-w-[170px] text-slate-800">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="w-2 h-2 rounded-full ${worksite.active ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
            <p class="font-extrabold text-xs text-peie-blue leading-tight">${worksite.name}</p>
          </div>
          ${worksite.encargado_name ? `<p class="text-[10px] text-slate-500 font-semibold mb-1.5">Coordinador: <b class="text-slate-700">${worksite.encargado_name}</b></p>` : ''}
          <div class="grid grid-cols-2 gap-1.5 py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-100 text-[10px] font-bold">
            <div class="flex items-center gap-1 text-slate-700">
              <span class="text-amber-600 font-black">👷</span> ${worksite.workersCount} operarios
            </div>
            <div class="flex items-center gap-1 text-slate-700">
              <span class="text-sky-600 font-black">🛠</span> ${worksite.toolsCount} equipos
            </div>
          </div>
          <p class="text-[9px] text-blue-600 font-bold mt-1 text-center">Click para abrir panel operativo</p>
        </div>
      `);

      el.addEventListener('mouseenter', () => popup.addTo(map));
      el.addEventListener('mouseleave', () => popup.remove());

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.remove();
        onSelectWorksite(worksite);
      });

      const marker = new Marker({ element: el })
        .setLngLat([worksite.longitude, worksite.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);

    });
  }, [worksites, selectedWorksiteId, onSelectWorksite]);

  const handleResetCenter = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [TUCUMAN_CENTER.longitude, TUCUMAN_CENTER.latitude],
      zoom: 12.2,
      essential: true,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden rounded-2xl bg-slate-100">
      {/* MapLibre DOM target */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Center Map Button */}
      <button
        onClick={handleResetCenter}
        title="Centrar en Gran San Miguel de Tucumán"
        className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur shadow-md hover:bg-slate-50 border border-slate-200 text-peie-blue text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
      >
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
        Centrar Tucumán
      </button>

      {/* Reference note overlay */}
      <div className="absolute bottom-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] text-slate-500 font-medium pointer-events-none">
        Área Metropolitana de Tucumán • Magnitud por Carga Operativa
      </div>
    </div>
  );
}
