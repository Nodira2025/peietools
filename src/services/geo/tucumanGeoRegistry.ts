import type { GeoCoordinates } from '../../types/operations';


export const TUCUMAN_CENTER: GeoCoordinates = {
  latitude: -26.82414,
  longitude: -65.22260,
};

export const TUCUMAN_BOUNDS = {
  minLat: -27.20,
  maxLat: -26.50,
  minLng: -65.50,
  maxLng: -64.95,
};

/**
 * Verified coordinates for key Tucumán locations and known PEIE worksites.
 * Used as high-fidelity fallback when an obra lacks explicit DB coordinates.
 */
export const KNOWN_TUCUMAN_LOCATIONS: Record<string, GeoCoordinates> = {
  // San Miguel de Tucumán Centro / Barrio Norte / Sur
  'QUALITY BARRIO NORTE': { latitude: -26.81880, longitude: -65.20732 },
  'QUALITY BN': { latitude: -26.81880, longitude: -65.20732 },
  'ONE RESIDENCE': { latitude: -26.82635, longitude: -65.22850 },
  'TORRE DUO - LINK': { latitude: -26.82635, longitude: -65.22850 },
  'ALBERDI 152': { latitude: -26.83113, longitude: -65.21440 },
  'LA RIOJA 846': { latitude: -26.84093, longitude: -65.21516 },
  'PIEDRAS 1668': { latitude: -26.83149, longitude: -65.22375 },
  'CLINICA MAYO': { latitude: -26.83441, longitude: -65.20574 },
  'ARQUITECTOS Y ASOCIADOS': { latitude: -26.82150, longitude: -65.21100 },
  'ONE BOULEVARD': { latitude: -26.82214, longitude: -65.20907 },
  'DEPÓSITO DE LA EMPRESA': { latitude: -26.83500, longitude: -65.22500 },
  'DEPOSITO PEIE': { latitude: -26.83500, longitude: -65.22500 },
  'OBRA CENTRAL': { latitude: -26.82700, longitude: -65.21900 },
  'MANTENIMIENTO': { latitude: -26.82900, longitude: -65.22100 },
  'CAMIONETA': { latitude: -26.82600, longitude: -65.22000 },

  // Yerba Buena
  'DOMUS': { latitude: -26.82045, longitude: -65.28450 },
  'BAMBOO': { latitude: -26.81820, longitude: -65.29050 },
  '#300 - LINK': { latitude: -26.80500, longitude: -65.27050 },
  '#300': { latitude: -26.80500, longitude: -65.27050 },
  'DITINIS': { latitude: -26.81350, longitude: -65.29570 },
  'PEDRO DE VILLALBA': { latitude: -26.81350, longitude: -65.29570 },
  'GHO': { latitude: -26.80717, longitude: -65.29570 },
  'KANTAROSKY - LOPEZ': { latitude: -26.81500, longitude: -65.30350 },
  'KANTAROSKY - LOPEZ ': { latitude: -26.81500, longitude: -65.30350 },
  'LIVE': { latitude: -26.82036, longitude: -65.28428 },
  'COLETTI - WALDHAUS': { latitude: -26.81500, longitude: -65.31200 },
  'CASA PASAJE': { latitude: -26.82100, longitude: -65.29500 },

  // Tafí Viejo / Los Nogales
  'COUNTRY CANTARES': { latitude: -26.77850, longitude: -65.23800 },
  'CANTARES': { latitude: -26.77850, longitude: -65.23800 },

  // Este / Aeropuerto / Banda del Río Salí
  // ORSNA: Aeropuerto Internacional Teniente Benjamín Matienzo (TUC).
  'AEROPUERTO': { latitude: -26.835503, longitude: -65.102254 },
  'SHELL OASIS': { latitude: -26.85018, longitude: -65.16777 },
  'OASIS': { latitude: -26.85018, longitude: -65.16777 },
  'CIRCUNVALACION': { latitude: -26.81200, longitude: -65.17800 },

  // Sur / San Pablo
  'SAN PABLO': { latitude: -26.85258, longitude: -65.31881 },
  'COUNTRY SAN PABLO': { latitude: -26.85258, longitude: -65.31881 },
  'AUSENTES / LIC. MEDICA': { latitude: -26.82414, longitude: -65.22260 },
};

/**
 * Resolves a worksite's geographic coordinates.
 * Prioritizes actual DB coordinates. If null, matches against known Tucumán points
 * or generates a deterministic clustered coordinate around Tucumán metropolitan area.
 */
export function resolveWorksiteCoordinates(worksite: {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): { coordinates: GeoCoordinates; isSimulated: boolean } {
  // 1. Check if valid coordinates are already stored in DB
  if (
    typeof worksite.latitude === 'number' &&
    typeof worksite.longitude === 'number' &&
    !isNaN(worksite.latitude) &&
    !isNaN(worksite.longitude) &&
    worksite.latitude !== 0 &&
    worksite.longitude !== 0
  ) {
    return {
      coordinates: { latitude: worksite.latitude, longitude: worksite.longitude },
      isSimulated: false,
    };
  }

  // 2. Check exact or partial match in known Tucumán locations registry
  const normalizedName = worksite.name.toUpperCase().trim();
  for (const [key, coords] of Object.entries(KNOWN_TUCUMAN_LOCATIONS)) {
    if (normalizedName === key || normalizedName.includes(key) || key.includes(normalizedName)) {
      return { coordinates: coords, isSimulated: true };
    }
  }

  // Check address
  if (worksite.address) {
    const normAddr = worksite.address.toUpperCase();
    for (const [key, coords] of Object.entries(KNOWN_TUCUMAN_LOCATIONS)) {
      if (normAddr.includes(key)) {
        return { coordinates: coords, isSimulated: true };
      }
    }
  }

  // 3. Deterministic scatter around Tucumán center based on worksite ID hash
  let hash = 0;
  for (let i = 0; i < worksite.id.length; i++) {
    hash = (hash << 5) - hash + worksite.id.charCodeAt(i);
    hash |= 0;
  }
  const offsetLat = ((Math.abs(hash) % 100) - 50) * 0.0009;
  const offsetLng = ((Math.abs(hash >> 3) % 100) - 50) * 0.0009;

  return {
    coordinates: {
      latitude: parseFloat((TUCUMAN_CENTER.latitude + offsetLat).toFixed(5)),
      longitude: parseFloat((TUCUMAN_CENTER.longitude + offsetLng).toFixed(5)),
    },
    isSimulated: true,
  };
}
