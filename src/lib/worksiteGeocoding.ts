export interface AddressMatch { label: string; latitude: number; longitude: number }

const normalizeStreet = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\b(avenida|av|avda|calle)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function requestedStreetNumber(address: string): {street: string; number: string} | null {
  // Use the last number in the street segment: "9 de Julio 279" is not number 9.
  const match = address.split(',')[0].trim().match(/^(.*?)\s+(\d+[a-z]?)\s*$/i);
  return match ? {street: normalizeStreet(match[1]), number: match[2].toLowerCase()} : null;
}

export function parseAddressMatches(data: unknown, address = ''): AddressMatch[] {
  const requested = requestedStreetNumber(address);
  if (!data || typeof data !== 'object' || !('features' in data) || !Array.isArray(data.features)) return [];
  return data.features.flatMap(feature => {
    const coordinates = feature?.geometry?.coordinates;
    const properties = feature?.properties;
    if (!Array.isArray(coordinates) || coordinates.length < 2 || !properties) return [];
    const [longitude, latitude] = coordinates;
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 85 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return [];
    if (properties.countrycode && (typeof properties.countrycode !== 'string' || properties.countrycode.toUpperCase() !== 'AR')) return [];
    if (requested && (typeof properties.street !== 'string'
      || normalizeStreet(properties.street) !== requested.street
      || String(properties.housenumber ?? '').toLowerCase() !== requested.number)) return [];
    const street = [properties.street, properties.housenumber].filter(Boolean).join(' ');
    const label = [...new Set([properties.name, street, properties.city, properties.district, properties.state, properties.country].filter(value => typeof value === 'string' && value.trim()))].join(', ');
    return label ? [{label, latitude, longitude}] : [];
  });
}

const cache = new Map<string, AddressMatch[]>();
let lastRequest = 0;
export async function findWorksiteAddress(address: string, signal: AbortSignal): Promise<AddressMatch[]> {
  const query = address.trim();
  if (query.length < 5) throw new Error('Ingresá calle, altura y localidad.');
  if (cache.has(query)) return cache.get(query)!;
  if (Date.now() - lastRequest < 1200) throw new Error('Esperá un momento antes de buscar nuevamente.');
  lastRequest = Date.now();
  const url = new URL(import.meta.env.VITE_GEOCODING_URL || 'https://photon.komoot.io/api/');
  url.search = new URLSearchParams({q:query,limit:'10',lat:'-26.83',lon:'-65.20'}).toString();
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error('No se pudo consultar el mapa. Reintentá o ingresá las coordenadas.');
  const matches = parseAddressMatches(await response.json(), query);
  if (cache.size >= 50) cache.clear();
  cache.set(query,matches);
  return matches;
}
