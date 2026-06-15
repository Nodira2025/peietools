import { useState, useEffect } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { Home, Wrench, FileText, Truck, Users, Building, LogOut, ShoppingCart, Sparkles, HardHat, ClipboardList, BarChart3, MoreHorizontal, Bell } from 'lucide-react';

export default function AppLayout() {
  const { user, profile, loading, signOut } = useAuthStore();
  const location = useLocation();
  const [showMas, setShowMas] = useState(false);
  const [deviceMode] = useState<'auto' | 'mobile' | 'desktop'>(() => {
    return (localStorage.getItem('login_device_mode') as any) || 'auto';
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    async function fetchPendingCount() {
      try {
        const [
          { data: toolsData },
          { data: personalData }
        ] = await Promise.all([
          supabase.from('solicitudes').select('id, requester_id, assigned_to').eq('status', 'Pendiente'),
          supabase.from('traslados_personal').select(`
            id, requester_id, source_obra_id, target_obra_id,
            source_obra:obras!traslados_personal_source_obra_id_fkey(encargado_name),
            target_obra:obras!traslados_personal_target_obra_id_fkey(encargado_name)
          `).eq('status', 'Pendiente')
        ]);

        const isAdmin = profile.role?.toLowerCase() === 'admin';
        const userFullName = profile.full_name?.toLowerCase().trim() || '';

        const filteredTools = (toolsData || []).filter((s: any) => {
          if (isAdmin) return true;
          return s.requester_id === profile.id || s.assigned_to === profile.id;
        });

        const filteredPersonal = (personalData || []).filter((t: any) => {
          if (isAdmin) return true;
          const isRequester = t.requester_id === profile.id;
          const isSourceManager = t.source_obra?.encargado_name && 
            t.source_obra.encargado_name.toLowerCase().trim() === userFullName;
          const isTargetManager = t.target_obra?.encargado_name && 
            t.target_obra.encargado_name.toLowerCase().trim() === userFullName;
          const isSourceObra = profile.obra_id === t.source_obra_id;
          const isTargetObra = profile.obra_id === t.target_obra_id;
          return isRequester || isSourceManager || isTargetManager || isSourceObra || isTargetObra;
        });

        setPendingCount(filteredTools.length + filteredPersonal.length);
      } catch (e) {
        console.error(e);
      }
    }

    fetchPendingCount();
    
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissBanner = () => {
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
    setShowInstallBanner(false);
  };

  if (loading) {
    return (
      <div className="min-h-[100svh] flex flex-col items-center justify-center bg-peie-bg gap-3">
        <div className="w-12 h-12 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin" />
        <p className="text-sm font-medium text-peie-blue animate-pulse">Cargando plataforma...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = profile.role === 'admin';
  const isLogistica = profile.role === 'logistica';

  const navItems = [
    { name: 'Inicio', path: '/dashboard', icon: Sparkles, show: true },
    { name: 'Notificaciones', path: '/notificaciones', icon: Bell, show: true, badge: pendingCount },
    { name: 'Reportes', path: '/reportes', icon: BarChart3, show: false },
    { name: 'Movimiento de Herramientas', path: '/pedidos-herramientas', icon: FileText, show: true },
    { name: 'Movimiento de Personal', path: '/pedidos-personal', icon: HardHat, show: true },
    { name: 'Herramientas', path: '/herramientas', icon: Wrench, show: true },
    { name: 'Mis Obras', path: '/mis-obras', icon: Building, show: true },
    { name: 'Personal', path: '/personal', icon: HardHat, show: true },
    { name: 'Órdenes', path: '/ordenes', icon: ClipboardList, show: false },
    { name: 'Logística', path: '/logistica', icon: Truck, show: isLogistica || isAdmin },
    { name: 'Compras', path: '/compras', icon: ShoppingCart, show: false },
    { name: 'Obras (Admin)', path: '/obras', icon: Building, show: isAdmin },
    { name: 'Usuarios', path: '/usuarios', icon: Users, show: isAdmin },
  ].filter(item => item.show);

  const wrapperClass = deviceMode === 'mobile'
    ? 'min-h-[100svh] bg-peie-bg text-foreground flex flex-col w-full overflow-x-hidden'
    : deviceMode === 'desktop'
      ? 'min-h-[100svh] bg-peie-bg text-foreground flex flex-row w-full overflow-x-hidden'
      : 'min-h-[100svh] bg-peie-bg text-foreground flex flex-col md:flex-row w-full overflow-x-hidden';

  const sidebarClass = deviceMode === 'mobile' 
    ? 'hidden' 
    : deviceMode === 'desktop' 
      ? 'flex flex-col w-64 bg-white border-r border-slate-100 min-h-screen shadow-sm shrink-0' 
      : 'hidden md:flex flex-col w-64 bg-white border-r border-slate-100 min-h-screen shadow-sm shrink-0';

  const headerClass = deviceMode === 'desktop'
    ? 'hidden'
    : deviceMode === 'mobile'
      ? 'bg-gradient-to-r from-[#031530] to-[#042454] text-white shadow-md rounded-b-[28px] px-4 py-4 pt-safe flex justify-between items-center z-30 sticky top-0 border-b border-slate-800/10 gap-3'
      : 'md:hidden bg-gradient-to-r from-[#031530] to-[#042454] text-white shadow-md rounded-b-[28px] px-4 py-4 pt-safe flex justify-between items-center z-30 sticky top-0 border-b border-slate-800/10 gap-3';

  const mainClass = deviceMode === 'mobile'
    ? 'flex-1 pb-20 overflow-y-auto min-h-[100svh] flex flex-col'
    : deviceMode === 'desktop'
      ? 'flex-1 pb-0 overflow-y-auto min-h-[100svh] flex flex-col'
      : 'flex-1 pb-20 md:pb-0 overflow-y-auto min-h-[100svh] flex flex-col';

  const containerClass = deviceMode === 'mobile'
    ? 'p-4 max-w-7xl w-full mx-auto flex-1'
    : deviceMode === 'desktop'
      ? 'p-8 max-w-7xl w-full mx-auto flex-1'
      : 'p-4 md:p-8 max-w-7xl w-full mx-auto flex-1';

  const navClass = deviceMode === 'desktop'
    ? 'hidden'
    : deviceMode === 'mobile'
      ? 'fixed bottom-0 left-0 right-0 bg-[#031530] text-white shadow-[0_-8px_30px_rgba(0,0,0,0.2)] rounded-t-[32px] z-40 flex overflow-x-auto no-scrollbar justify-around pb-safe pt-3 px-2 border-t border-slate-800/20'
      : 'md:hidden fixed bottom-0 left-0 right-0 bg-[#031530] text-white shadow-[0_-8px_30px_rgba(0,0,0,0.2)] rounded-t-[32px] z-40 flex overflow-x-auto no-scrollbar justify-around pb-safe pt-3 px-2 border-t border-slate-800/20';

  const bottomSheetOverlayClass = deviceMode === 'desktop'
    ? 'hidden'
    : deviceMode === 'mobile'
      ? 'fixed inset-0 bg-black/60 z-50 transition-opacity duration-300'
      : 'md:hidden fixed inset-0 bg-black/60 z-50 transition-opacity duration-300';

  return (
    <div className={wrapperClass}>
      
      {/* Sidebar de Escritorio */}
      <aside className={sidebarClass}>
        
        {/* Cabecera Sidebar con Logo */}
        <div className="p-6 border-b border-slate-50 flex flex-col items-center">
          <Link to="/" className="block w-40 transition-transform hover:scale-105">
            <img src="/logo-peie.png" alt="PEIE Tools" className="w-full h-auto object-contain" />
          </Link>
          <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            Trazabilidad Activa
          </div>
        </div>

        {/* Links Sidebar */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-peie-blue text-white font-medium shadow-md shadow-peie-blue/10' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-peie-blue'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-peie-light' : 'text-slate-400'} />
                <span className="text-sm">{item.name}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="ml-auto bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : isActive ? (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-peie-light animate-pulse" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Pie Sidebar: Perfil de Usuario */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="mb-3 px-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-peie-blue/10 border border-peie-blue/20 flex items-center justify-center font-bold text-peie-blue shrink-0">
              {profile.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{profile.full_name}</p>
              <span className="inline-block px-2 py-0.5 mt-0.5 text-[10px] bg-peie-light/10 text-peie-blue font-semibold rounded capitalize">
                {profile.role}
              </span>
            </div>
          </div>

          <button
            onClick={signOut}
            className="flex items-center justify-center space-x-2 px-3 py-2.5 w-full text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-100/50 rounded-xl transition-colors"
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>

      </aside>

      {/* Área de Contenido Principal */}
      <main className={mainClass}>
        
        {/* Encabezado Flotante Móvil */}
        <header className={headerClass}>
          {/* Botón Home Izquierdo */}
          <Link 
            to="/" 
            className="p-2.5 text-white/80 hover:text-white border border-slate-700/40 rounded-xl bg-[#041d44]/40 active:scale-90 transition-all"
            aria-label="Ir al Inicio"
          >
            <Home size={18} className="stroke-[2.5]" />
          </Link>

          {/* Botón Campana Notificaciones */}
          <Link 
            to="/notificaciones" 
            className="p-2.5 text-white/80 hover:text-white border border-slate-700/40 rounded-xl bg-[#041d44]/40 active:scale-90 transition-all relative"
            aria-label="Notificaciones"
          >
            <Bell size={18} className="stroke-[2.5]" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                {pendingCount}
              </span>
            )}
          </Link>

          {/* Logo Centrado */}
          <Link to="/" className="flex-1 flex justify-center transition-transform active:scale-95">
            <img src="/logo-peie.png" alt="PEIE" className="h-7 w-auto object-contain brightness-0 invert" />
          </Link>

          {/* Perfil de Usuario y Logout Derecho */}
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-white leading-tight">{profile.full_name?.split(' ')[0]}</span>
              <span className="text-[9px] text-sky-400 font-black capitalize leading-none mt-0.5">{profile.role}</span>
            </div>
            
            <button 
              onClick={signOut} 
              className="p-2.5 text-white/80 hover:text-white border border-slate-700/40 rounded-xl bg-[#041d44]/40 active:scale-90 transition-all"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} className="stroke-[2.5]" />
            </button>
          </div>
        </header>
        
        {/* Contenedor fluido de páginas */}
        <div className={containerClass}>
          <Outlet />
        </div>

      </main>

      {/* Barra de Navegación Inferior (Exclusiva para Móviles) */}
      <nav className={navClass}>
        {[
          { name: 'Inicio', path: '/dashboard', icon: Home, isButton: false },
          { name: 'Mis Obras', path: '/mis-obras', icon: Building, isButton: false },
          { name: 'Herramientas', path: '/herramientas', icon: Wrench, isButton: false },
          { name: 'Personal', path: '/personal', icon: Users, isButton: false },
          { name: 'Más', path: '#', icon: MoreHorizontal, isButton: true },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = !item.isButton && (location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path)));
          
          if (item.isButton) {
            return (
              <button
                key={item.name}
                onClick={() => setShowMas(true)}
                className="flex flex-col items-center justify-center py-1 px-1 flex-1 min-w-[64px] transition-all duration-200 relative text-left"
              >
                <div className="relative p-2.5 rounded-full transition-all duration-200 text-slate-400 hover:text-slate-200">
                  <Icon size={20} className="stroke-2" />
                </div>
                <span className="text-[9px] tracking-tight mt-0.5 whitespace-nowrap font-semibold text-slate-400">
                  {item.name}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center py-1 px-1 flex-1 min-w-[64px] transition-all duration-200 relative"
            >
              <div className={`relative p-2.5 rounded-full transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-110 -translate-y-1.5' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}>
                <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-2'} />
              </div>
              <span className={`text-[9px] tracking-tight mt-0.5 whitespace-nowrap ${
                isActive ? 'font-black text-white' : 'font-semibold text-slate-400'
              }`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Sheet para el menú "Más" */}
      {showMas && (
        <div className={bottomSheetOverlayClass} onClick={() => setShowMas(false)}>
          <div 
            className="fixed bottom-0 left-0 right-0 bg-[#031530] text-white rounded-t-[32px] p-6 space-y-6 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del cajón */}
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Más Opciones</h3>
              <button onClick={() => setShowMas(false)} className="text-slate-400 hover:text-white text-xs font-bold bg-slate-800/40 px-3 py-1 rounded-full">
                Cerrar
              </button>
            </div>

            {/* Listado de links */}
            <div className="grid grid-cols-2 gap-4 py-2">
              <Link 
                to="/pedidos-herramientas" 
                onClick={() => setShowMas(false)}
                className="flex flex-col items-center justify-center p-4 bg-slate-900/60 border border-slate-800 rounded-2xl hover:bg-slate-900 transition-all text-center gap-2"
              >
                <FileText size={24} className="text-blue-400" />
                <span className="text-[11px] font-black uppercase tracking-tight">Mov. Herramientas</span>
              </Link>

              <Link 
                to="/pedidos-personal" 
                onClick={() => setShowMas(false)}
                className="flex flex-col items-center justify-center p-4 bg-slate-900/60 border border-slate-800 rounded-2xl hover:bg-slate-900 transition-all text-center gap-2"
              >
                <HardHat size={24} className="text-emerald-400" />
                <span className="text-[11px] font-black uppercase tracking-tight">Mov. Personal</span>
              </Link>

              <Link 
                to="/logistica" 
                onClick={() => setShowMas(false)}
                className="flex flex-col items-center justify-center p-4 bg-slate-900/60 border border-slate-800 rounded-2xl hover:bg-slate-900 transition-all text-center gap-2"
              >
                <Truck size={24} className="text-purple-400" />
                <span className="text-[11px] font-black uppercase tracking-tight">Mapa Logística</span>
              </Link>

              <Link 
                to="/reportes" 
                onClick={() => setShowMas(false)}
                className="flex flex-col items-center justify-center p-4 bg-slate-900/60 border border-slate-800 rounded-2xl hover:bg-slate-900 transition-all text-center gap-2"
              >
                <BarChart3 size={24} className="text-orange-400" />
                <span className="text-[11px] font-black uppercase tracking-tight">Reportes KPI</span>
              </Link>

              {isAdmin && (
                <Link 
                  to="/usuarios" 
                  onClick={() => setShowMas(false)}
                  className="flex flex-col items-center justify-center p-4 bg-slate-900/60 border border-slate-800 rounded-2xl hover:bg-slate-900 transition-all text-center gap-2"
                >
                  <Users size={24} className="text-sky-400" />
                  <span className="text-[11px] font-black uppercase tracking-tight">Usuarios</span>
                </Link>
              )}

              {isAdmin && (
                <Link 
                  to="/obras" 
                  onClick={() => setShowMas(false)}
                  className="flex flex-col items-center justify-center p-4 bg-slate-900/60 border border-slate-800 rounded-2xl hover:bg-slate-900 transition-all text-center gap-2"
                >
                  <Building size={24} className="text-amber-400" />
                  <span className="text-[11px] font-black uppercase tracking-tight">Obras (Admin)</span>
                </Link>
              )}
            </div>

            {/* Logout button */}
            <button
              onClick={() => { signOut(); setShowMas(false); }}
              className="w-full py-3 bg-rose-950/20 border border-rose-900/50 hover:bg-rose-950/40 text-rose-400 font-black text-xs rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all mt-4"
            >
              <LogOut size={16} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}

      {/* PWA Install Floating Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:right-6 md:left-auto md:w-96 bg-white border border-peie-blue/15 shadow-xl rounded-2xl p-4 flex items-center justify-between gap-4 animate-bounce-short">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-peie-blue/10 text-peie-blue flex items-center justify-center shrink-0">
              <Sparkles size={20} className="text-peie-blue animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Instalá PEIE Tools</p>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">Accedé al instante y usalo sin internet como una app nativa.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleDismissBanner}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2.5 py-1.5 rounded-lg"
            >
              Cerrar
            </button>
            <button
              onClick={handleInstallClick}
              className="bg-peie-blue hover:bg-peie-blue/90 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-md"
            >
              Instalar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
