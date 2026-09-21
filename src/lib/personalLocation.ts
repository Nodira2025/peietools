import { supabase } from './supabase';
import { useAuthStore } from '../store/auth';

export interface PersonalLocation { latitude: number; longitude: number; accuracy: number; capturedAt: string }
export function readPersonalLocation(): PersonalLocation | null {
  const value = useAuthStore.getState().user?.user_metadata?.peie_location;
  return value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180 ? value : null;
}
export async function registerPersonalLocation() {
  if (!navigator.geolocation) throw new Error('Este navegador no permite obtener la ubicación.');
  const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, error => reject(new Error(error.code === 1 ? 'Permiso denegado. Habilitá la ubicación en los permisos del navegador y volvé a intentar.' : 'No pudimos obtener tu ubicación. Activá el GPS y volvé a intentar.')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }));
  const location: PersonalLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() };
  const { data, error } = await supabase.auth.updateUser({ data: { peie_location: location } });
  if (error) throw new Error('No se pudo guardar la ubicación. Volvé a intentar.');
  useAuthStore.setState({ user: data.user });
  return location;
}
