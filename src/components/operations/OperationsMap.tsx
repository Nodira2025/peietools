import { createWorksiteBubble, createWorksiteSummary } from './worksiteBubble';
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
  originCoords?: { latitude: number; longitude: number } | null;
  onMapClick?: (coords: { latitude: number; longitude: number }) => void;
}

export default function OperationsMap({
  worksites,
  selectedWorksiteId,
  onSelectWorksite,
  flyToCoords,
  originCoords,
  onMapClick,
}: OperationsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const originMarkerRef = useRef<Marker | null>(null);

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
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [TUCUMAN_CENTER.longitude, TUCUMAN_CENTER.latitude],
      zoom: 12.6,
      minZoom: 8,
      maxZoom: 18,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    // Observer para auto-redimensionar el mapa al cambiar ancho de pantalla o contenedor
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
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

    const popups: Popup[] = [];
    worksites.forEach((worksite) => {
      const isSelected = worksite.id === selectedWorksiteId;
      const size = Math.max(64, Math.round(worksite.bubbleRadiusPx || 64));
      const el = createWorksiteBubble(worksite, size, isSelected);
      const popup = new Popup({ offset: size / 2 + 6, closeButton: false, closeOnClick: false, maxWidth: '300px', anchor: 'bottom' })
        .setLngLat([worksite.longitude, worksite.latitude])
        .setDOMContent(createWorksiteSummary(worksite));
      el.addEventListener('mouseenter', () => popup.addTo(map));
      el.addEventListener('mouseleave', () => { if (document.activeElement !== el) popup.remove(); });
      el.addEventListener('focus', () => popup.addTo(map));
      el.addEventListener('blur', () => popup.remove());
      el.addEventListener('keydown', event => { if (event.key === 'Escape') popup.remove(); });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.remove();
        onSelectWorksite(worksite);
      });

      const marker = new Marker({ element: el })
        .setLngLat([worksite.longitude, worksite.latitude])
        .addTo(map);

      markersRef.current.push(marker);
      popups.push(popup);

    });
    return () => { popups.forEach(popup => popup.remove()); markersRef.current.forEach(marker => marker.remove()); markersRef.current = []; };
  }, [worksites, selectedWorksiteId, onSelectWorksite]);

  // 4. Render Origin Marker (Punto de Búsqueda / Tu Ubicación)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }

    if (!originCoords) return;

    const el = document.createElement('div');
    el.className = 'peie-origin-marker flex flex-col items-center select-none cursor-pointer';
    el.innerHTML = `
      <div class="relative flex items-center justify-center">
        <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-red-400 opacity-75"></span>
        <div class="relative w-6 h-6 rounded-full bg-red-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-black">
          📍
        </div>
      </div>
      <div class="bg-slate-900/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap mt-0.5">
        Tu Origen
      </div>
    `;

    const marker = new Marker({ element: el })
      .setLngLat([originCoords.longitude, originCoords.latitude])
      .addTo(map);

    originMarkerRef.current = marker;
  }, [originCoords]);

  // 5. Handle clicks on map to set origin coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;

    const handleClick = (e: any) => {
      onMapClick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [onMapClick]);

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
        className="absolute top-16 sm:top-4 right-4 z-10 bg-white/95 backdrop-blur shadow-md hover:bg-slate-50 border border-slate-200 text-peie-blue text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
      >
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
        Centrar Tucumán
      </button>

      {/* Reference note overlay */}
      <div className="absolute bottom-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] text-slate-500 font-medium pointer-events-none">
        Anillo: avance de 0 a 100% · Gris: sin avance cargado · Tamaño: recursos
      </div>
    </div>
  );
}
