import { useEffect, useState } from 'react';
import { readPersonalLocation } from '../lib/personalLocation';
import { useAuthStore } from '../store/auth';

export function useWelcomeMetrics() {
  useAuthStore(state => state.user);
  const position = readPersonalLocation();
  const latitude = position?.latitude;
  const longitude = position?.longitude;
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<{ temperature: number; code: number } | null>(null);
  const [weatherStatus, setWeatherStatus] = useState('Consultando…');
  const [dollar, setDollar] = useState<{ venta: number; fechaActualizacion: string } | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetch('https://dolarapi.com/v1/dolares/oficial', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => {
        if (active && Number.isFinite(data.venta) && data.venta > 0 && Number.isFinite(Date.parse(data.fechaActualizacion))) setDollar(data);
      }).catch(() => { if (active) setDollar(null); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, []);
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => {
        if (!Number.isFinite(data.current?.temperature_2m) || !Number.isFinite(data.current?.weather_code)) throw new Error();
        if (active) setWeather({ temperature: data.current.temperature_2m, code: data.current.weather_code });
      }).catch(() => { if (active) setWeatherStatus('No disponible'); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [latitude, longitude]);
  const condition = !weather ? position ? weatherStatus : 'Activar ubicación' : weather.code === 0 ? 'Despejado' : weather.code <= 3 ? 'Nublado' : weather.code <= 48 ? 'Niebla' : weather.code >= 95 ? 'Tormenta' : weather.code >= 71 && weather.code <= 77 ? 'Nieve' : 'Precipitaciones';
  return { now, weather, condition, dollar, position };
}
