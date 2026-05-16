import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Home, Wrench, FileText, Truck, Users, Building, LogOut, ShoppingCart, Sparkles, HardHat, ClipboardList } from 'lucide-react';

export default function AppLayout() {
  const { user, profile, loading, signOut } = useAuthStore();
  const location = useLocation();

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
    { name: 'Pedidos', path: '/solicitudes', icon: Home, show: true },
    { name: 'Herramientas', path: '/herramientas', icon: Wrench, show: true },
    { name: 'Mis Obras', path: '/mis-obras', icon: Building, show: true },
    { name: 'Personal', path: '/personal', icon: HardHat, show: true },
    { name: 'Órdenes', path: '/ordenes', icon: ClipboardList, show: true },
    { name: 'Logística', path: '/logistica', icon: Truck, show: isLogistica || isAdmin },
    { name: 'Compras', path: '/compras', icon: ShoppingCart, show: true },
    { name: 'Obras (Admin)', path: '/obras', icon: Building, show: isAdmin },
    { name: 'Usuarios', path: '/usuarios', icon: Users, show: isAdmin },
  ].filter(item => item.show);

  return (
    <div className="min-h-[100svh] bg-peie-bg text-foreground flex flex-col md:flex-row w-full overflow-x-hidden">
      
      {/* Sidebar de Escritorio */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-100 min-h-screen shadow-sm shrink-0">
        
        {/* Cabecera Sidebar con Logo */}
        <div className="p-6 border-b border-slate-50 flex flex-col items-center">
          <Link to="/solicitudes" className="block w-40 transition-transform hover:scale-105">
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
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-peie-light animate-pulse" />}
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
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto min-h-[100svh] flex flex-col">
        
        {/* Encabezado Flotante Móvil */}
        <header className="md:hidden bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm pt-safe">
          <Link to="/solicitudes" className="flex items-center gap-2">
            <img src="/logo-peie.png" alt="PEIE" className="h-7 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="flex flex-col text-right">
              <span className="text-[11px] font-bold text-slate-800 leading-none">{profile.full_name?.split(' ')[0]}</span>
              <span className="text-[9px] text-peie-light font-bold capitalize mt-0.5">{profile.role}</span>
            </div>
            
            <button 
              onClick={signOut} 
              className="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-lg bg-slate-50 border border-slate-100"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        
        {/* Contenedor fluido de páginas */}
        <div className="p-4 md:p-8 max-w-7xl w-full mx-auto flex-1">
          <Outlet />
        </div>

      </main>

      {/* Barra de Navegación Inferior (Exclusiva para Móviles) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] z-40 flex overflow-x-auto no-scrollbar justify-start pb-safe pt-1 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-2 px-3 min-w-[70px] rounded-xl transition-all duration-150 ${
                isActive 
                  ? 'text-peie-blue scale-105' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`relative p-1 rounded-lg ${isActive ? 'bg-peie-blue/5' : ''}`}>
                <Icon size={20} className={isActive ? 'text-peie-blue stroke-[2.5]' : 'stroke-2'} />
                {isActive && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-peie-light rounded-full" />}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-peie-blue' : 'font-medium'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
