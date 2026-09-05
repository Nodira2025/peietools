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
  'QUALITY BARRIO NORTE': { latitude: -26.8185, longitude: -65.2038 },
  'ALBERDI 152': { latitude: -26.8360, longitude: -65.2110 },
  'LA RIOJA 846': { latitude: -26.8395, longitude: -65.2155 },
  'PIEDRAS 1668': { latitude: -26.8430, longitude: -65.2285 },
  'PEDRO DE VILLALBA': { latitude: -26.8305, longitude: -65.2340 },
  'CLINICA MAYO': { latitude: -26.8315, longitude: -65.2085 },
  'DOMUS': { latitude: -26.8220, longitude: -65.2140 },
  'TORRE DUO - LINK': { latitude: -26.8190, longitude: -65.2105 },
  '#300 - LINK': { latitude: -26.8250, longitude: -65.2170 },
  'ONE BOULEVARD': { latitude: -26.8150, longitude: -65.2060 },
  'ONE RESIDENCE': { latitude: -26.8165, longitude: -65.2080 },
  'DEPÓSITO DE LA EMPRESA': { latitude: -26.8350, longitude: -65.2250 },
  'DEPOSITO PEIE': { latitude: -26.8350, longitude: -65.2250 },
  'OBRA CENTRAL': { latitude: -26.8270, longitude: -65.2190 },
  'MANTENIMIENTO': { latitude: -26.8290, longitude: -65.2210 },
  'CAMIONETA': { latitude: -26.8260, longitude: -65.2200 },

  // Yerba Buena
  'ARQUITECTOS Y ASOCIADOS': { latitude: -26.8130, longitude: -65.2890 },
  'BAMBOO': { latitude: -26.8170, longitude: -65.3040 },
  'COUNTRY CANTARES': { latitude: -26.8090, longitude: -65.3180 },
  'COLETTI - WALDHAUS': { latitude: -26.8150, longitude: -65.3120 },
  'CASA PASAJE': { latitude: -26.8210, longitude: -65.2950 },
  'DITINIS': { latitude: -26.8140, longitude: -65.2850 },

  // Este / Aeropuerto / Banda del Río Salí
  'AEROPUERTO': { latitude: -26.8410, longitude: -65.1050 },
  'CIRCUNVALACION': { latitude: -26.8120, longitude: -65.1780 },
  'GHO': { latitude: -26.8040, longitude: -65.1850 },
  'SHELL OASIS': { latitude: -26.8490, longitude: -65.1820 },

  // Oeste / San Pablo / Lules
  'SAN PABLO': { latitude: -26.8680, longitude: -65.3120 },
  'LIVE': { latitude: -26.8115, longitude: -65.2980 },
  'AUSENTES / LIC. MEDICA': { latitude: -26.8241, longitude: -65.2226 },
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
