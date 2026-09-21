import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Camera, ChartNoAxesColumnIncreasing, ChevronRight, CircleHelp, Clock3, DollarSign, HardHat, Menu, Settings, Sun, UserRound } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useWelcomeMetrics } from '../hooks/useWelcomeMetrics';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import './DesktopWelcome.css';

export default function DesktopWelcome({ pendingCount }: { pendingCount: number }) {
  const { profile } = useAuthStore();
  const { now, weather, condition, dollar, position } = useWelcomeMetrics();
  const [help, setHelp] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const name = profile?.full_name?.trim().split(/\s+/)[0] || 'equipo';
  const photo = profile?.photo_url;
  return <div className="desktop-welcome">
    <header className="desktop-welcome-toolbar">
      <Link to="/notificaciones" className="desktop-notification">
        <span className="desktop-notification-icon"><Bell size={19} />{pendingCount > 0 && <i />}</span>
        <span><strong>Notificaciones</strong><small>{pendingCount > 0 ? `Tenés ${pendingCount} ${pendingCount === 1 ? 'notificación pendiente' : 'notificaciones pendientes'}` : 'No tenés notificaciones pendientes'}</small></span><ChevronRight size={16} />
      </Link>
      <div className="desktop-toolbar-actions"><button aria-label="Ayuda para comenzar" onClick={() => setHelp(true)}><CircleHelp size={19} /></button><Link to="/perfil" className="desktop-user-link"><span>{name.charAt(0).toUpperCase()}</span><strong>{name}</strong><ChevronRight size={13} /></Link></div>
    </header>

    <section className="desktop-welcome-hero" aria-label="Bienvenida a PEIE">
      <div className="desktop-worksite-photo" aria-hidden="true"><img src="/img/peie-desktop-worksite.png" alt="" /></div>
      <div className="desktop-hero-wash" aria-hidden="true" />
      <div className="desktop-hero-values" aria-hidden="true"><i />ENERGÍA<br />INFRAESTRUCTURA<br />PERSONAS<br /><strong>UN MEJOR MAÑANA</strong></div>
      <div className="desktop-brand-wave" aria-hidden="true"><img src="/logo-peie.png" alt="" /><span>TRAZABILIDAD ACTIVA</span></div>

      <div className="desktop-metrics" aria-label="Información del día">
        <Link to="/perfil" title={position ? 'Clima de tu ubicación registrada. Podés actualizarla en tu perfil.' : 'Registrá tu ubicación GPS desde tu perfil para consultar el clima.'}><Sun /><span><small>Clima</small><strong>{weather ? `${Math.round(weather.temperature)}° ${condition}` : condition}</strong></span></Link>
        <div><Clock3 /><span><small>Hora</small><strong>{now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</strong></span></div>
        <a href="https://dolarapi.com/docs/argentina/" target="_blank" rel="noreferrer" title={dollar ? `Venta. Actualizado: ${new Date(dollar.fechaActualizacion).toLocaleString('es-AR')}` : 'Cotización no disponible'}><DollarSign /><span><small>Dólar oficial · Venta</small><strong>{dollar ? `$${dollar.venta.toLocaleString('es-AR')}` : 'Sin conexión'}</strong>{dollar && <em>{new Date(dollar.fechaActualizacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</em>}</span></a>
        <div><CalendarDays /><span><small>Fecha</small><strong>{now.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong></span></div>
      </div>

      <div className="desktop-welcome-copy">
        <p className="desktop-eyebrow">TRAZABILIDAD ACTIVA</p>
        <h1>¡Bienvenido, <span>{name}!</span></h1>
        <p className="desktop-intro">Aquí podés gestionar tus pedidos, herramientas, obras<br className="desktop-intro-break" /> y la logística de tu equipo, de forma rápida y eficiente.</p>
        <Link to="/perfil" aria-label="Mi perfil: reemplazar foto" className="desktop-welcome-avatar">{photo && !photoFailed ? <img src={photo} alt={`Foto de ${profile?.full_name}`} onError={() => setPhotoFailed(true)} /> : <UserRound size={68} strokeWidth={1.3} />}<span><Camera size={15} /></span></Link>
        <div className="desktop-sidebar-guide"><span><Menu size={30} /></span><p>Seleccioná alguna de las opciones<br />para comenzar a trabajar.</p></div>
        <svg className="desktop-menu-arrow" viewBox="0 0 130 190" fill="none" aria-hidden="true"><path d="M121 177C38 176 99 33 14 27M14 27l23-9M14 27l14 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M13 13 8 3M5 25 0 23" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        <div className="desktop-welcome-pillars">
          <Link to="/personal"><HardHat /><span>Personas<small>que construyen</small></span></Link>
          <Link to="/herramientas"><Settings /><span>Herramientas<small>que impulsan</small></span></Link>
          <Link to="/mis-obras"><ChartNoAxesColumnIncreasing /><span>Obras<small>que conectan</small></span></Link>
        </div>
        <footer className="desktop-welcome-footer"><i /><p>Más control. Más progreso.</p><span>Un sistema, un mismo equipo.</span><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Clima: Open-Meteo</a></footer>
      </div>
    </section>

    <Dialog open={help} onOpenChange={setHelp}><DialogContent><DialogHeader><DialogTitle>Tu espacio de trabajo</DialogTitle><DialogDescription>Elegí una sección en el menú lateral para comenzar.</DialogDescription></DialogHeader><p className="text-sm text-slate-600">Desde Herramientas podés consultar el inventario; desde Mis Obras, acceder a tus obras; y desde Personal, gestionar tu equipo. En Mi perfil podés reemplazar tu foto y registrar o actualizar tu ubicación para consultar el clima.</p></DialogContent></Dialog>
  </div>;
}
