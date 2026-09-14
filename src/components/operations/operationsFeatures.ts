// Cambiar a true para recuperar las métricas y acciones ampliadas.
// Ver docs/centro-operaciones-reversion.md.
export const SHOW_EXTENDED_OPERATIONS = false;

export function hasStoredCoordinates<T extends { latitude?: number | null; longitude?: number | null }>(worksite: T): worksite is T & { latitude: number; longitude: number } {
  return typeof worksite.latitude === 'number' && Number.isFinite(worksite.latitude)
    && Math.abs(worksite.latitude) <= 85.051129 && typeof worksite.longitude === 'number'
    && Number.isFinite(worksite.longitude) && Math.abs(worksite.longitude) <= 180
    && !(worksite.latitude === 0 && worksite.longitude === 0);
}
