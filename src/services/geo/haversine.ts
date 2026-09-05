import type { GeoCoordinates } from '../../types/operations';


/**
 * Level 1: Straight-line distance calculation using the Haversine formula.
 * Zero external API dependencies, lightweight and instantaneous.
 * Returns distance in kilometers (km).
 */
export function calculateHaversineDistance(
  coord1: GeoCoordinates,
  coord2: GeoCoordinates
): number {
  const toRad = (angle: number) => (angle * Math.PI) / 180;
  const R = 6371; // Earth radius in kilometers

  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return parseFloat((R * c).toFixed(2));
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
