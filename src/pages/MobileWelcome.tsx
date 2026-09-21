import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Bell, Camera, Clock3, CloudSun, DollarSign, LogOut, MapPin, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useMobileMode } from '../hooks/useMobileMode';
import { readPersonalLocation, registerPersonalLocation } from '../lib/personalLocation';
import './MobileWelcome.css';

export default function MobileWelcome({ pendingCount = 0 }: { pendingCount?: number }) {
  const { profile, signOut } = useAuthStore();
  const mobile = useMobileMode();
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [weather, setWeather] = useState<{ temperature: number; code: number } | null>(null);
  const [weatherState, setWeatherState] = useState('Consultando…');
  const [dollar, setDollar] = useState<{ venta: number; fechaActualizacion: string } | null>(null);
  const position = readPersonalLocation();
  const latitude = position?.latitude;
  const longitude = position?.longitude;
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!mobile) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetch('https://dolarapi.com/v1/dolares/oficial', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (Number.isFinite(data.venta) && data.venta > 0 && Number.isFinite(Date.parse(data.fechaActualizacion))) setDollar(data); }).catch(() => setDollar(null));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [mobile]);
  useEffect(() => {
    if (!mobile || latitude == null || longitude == null) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      if (!Number.isFinite(data.current?.temperature_2m) || !Number.isFinite(data.current?.weather_code)) throw new Error();
      setWeather({ temperature: data.current.temperature_2m, code: data.current.weather_code });
    }).catch(() => { if (!controller.signal.aborted) setWeatherState('Sin conexión'); else setWeatherState('No disponible'); });
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [latitude, longitude, mobile]);
  if (!mobile) return <Navigate to="/dashboard" replace />;
  const greeting = now.getHours() < 12 ? 'Buenos días,' : now.getHours() < 20 ? 'Buenas tardes,' : 'Buenas noches,';
  const condition = weather ? weather.code === 0 ? 'Despejado' : weather.code <= 3 ? 'Nublado' : weather.code <= 48 ? 'Niebla' : weather.code >= 95 ? 'Tormenta' : weather.code >= 71 && weather.code <= 77 ? 'Nieve' : 'Precipitaciones' : position ? weatherState : 'Sin ubicación';
  return <section className="peie-welcome">
    <header className="welcome-header"><Link to="/notificaciones" aria-label={`Notificaciones${pendingCount ? `: ${pendingCount} pendientes` : ''}`} className="welcome-icon"><Bell />{pendingCount > 0 && <span className="welcome-badge">{pendingCount}</span>}</Link><img src="/logo-peie.png" alt="PEIE, energía en tu vida" /><button className="welcome-icon" onClick={signOut} aria-label="Cerrar sesión"><LogOut /></button></header>
    <div className="welcome-info">
      <div><CloudSun /><strong>{weather ? `${Math.round(weather.temperature)}°` : '—°'}</strong><small>{condition}</small></div>
      <div><Clock3 /><strong>{now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</strong><small>{now.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</small></div>
      <a href="https://dolarapi.com/docs/argentina/" target="_blank" rel="noreferrer" title={dollar ? `Actualizado: ${new Date(dollar.fechaActualizacion).toLocaleString('es-AR')}` : 'Cotización no disponible'}><DollarSign /><strong>{dollar ? `$${dollar.venta.toLocaleString('es-AR')}` : '—'}</strong><small>Dólar oficial · Venta{dollar ? ` · ${new Date(dollar.fechaActualizacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}` : ' · Sin conexión'}</small></a>
      <Link to="/perfil"><MapPin /><strong>{position ? 'Tu zona' : 'Activar GPS'}</strong><small>{position ? `${position.latitude.toFixed(2)}, ${position.longitude.toFixed(2)}` : 'Ubicación'}</small></Link>
    </div>
    <div className="welcome-main"><p className="welcome-greeting">{greeting}</p><h1>{profile?.full_name?.trim().split(/\s+/)[0] || 'Hola'}<span>.</span></h1><p className="welcome-motto">La energía de hoy construye<br />un mejor mañana.</p>
      <div className="welcome-portrait-wrap"><p className="welcome-script">Personas<br />que iluminan<br />comunidades</p><Link to="/perfil" aria-label="Mi perfil: reemplazar foto" className="welcome-portrait">{profile?.photo_url ? <img src={profile.photo_url} alt={`Foto de ${profile.full_name}`} /> : <UserRound size={84} strokeWidth={1} />}<span><Camera size={17} /></span></Link><p className="welcome-values">TRABAJO<br />SEGURIDAD<br />EQUIPO<br />PROGRESO</p></div>
      <Link className="welcome-start" to="/dashboard">Iniciar <ArrowRight /></Link><p className="welcome-hint">Al iniciar se abrirá<br />tu panel de trabajo</p>
      {!position && <div className="welcome-gps"><p>Activá tu ubicación para ver el clima de tu zona.</p><button disabled={busy} onClick={async () => { setBusy(true); setMessage(''); try { await registerPersonalLocation(); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo obtener la ubicación.'); } finally { setBusy(false); } }}>{busy ? 'Obteniendo ubicación…' : 'Registrar ubicación GPS'}</button><small>Se guarda en tu cuenta. Sin seguimiento continuo.</small></div>}
      {message && <p className="welcome-message" role="status">{message}</p>}
    </div>
    <footer className="welcome-social"><p>CONECTEMOS</p><div><a href="https://www.instagram.com/peie.tucuman/" target="_blank" rel="noreferrer"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" /></svg></span>Instagram</a><a href="https://ar.linkedin.com/company/peie-proyectos-e-instalaciones-el%C3%A9ctricas" target="_blank" rel="noreferrer"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 10v7m0-10v.1M11 17v-7m0 3a3 3 0 0 1 6 0v4" /></svg></span>LinkedIn</a><Link to="/perfil"><span><UserRound /></span>Mi perfil</Link></div><a className="welcome-source" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Clima: Open-Meteo</a></footer>
  </section>;
}
