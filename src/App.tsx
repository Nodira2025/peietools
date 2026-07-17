import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { Toaster } from '@/components/ui/toaster';

// Layouts
import AppLayout from './layouts/AppLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reportes from './pages/Reportes';
import Obras from './pages/Obras';
import Usuarios from './pages/Usuarios';
import Herramientas from './pages/Herramientas';
import NuevaHerramienta from './pages/NuevaHerramienta';
import HerramientaDetail from './pages/HerramientaDetail';
import QRScanner from './pages/QRScanner';
import BusquedaVisual from './pages/BusquedaVisual';
import BusquedaPersonal from './pages/BusquedaPersonal';
import Solicitudes from './pages/Solicitudes';
import NuevaSolicitud from './pages/NuevaSolicitud';
import SolicitudDetail from './pages/SolicitudDetail';
import Logistica from './pages/Logistica';
import Compras from './pages/Compras';
import CompraDetail from './pages/CompraDetail';
import MisObras from './pages/MisObras';
import Personal from './pages/Personal';
import NuevoTrasladoPersonal from './pages/NuevoTrasladoPersonal';
import TrasladoPersonalDetail from './pages/TrasladoPersonalDetail';
import Ordenes from './pages/Ordenes';
import NuevaOrden from './pages/NuevaOrden';
import OrdenDetail from './pages/OrdenDetail';
import NuevoPersonalAsistido from './pages/NuevoPersonalAsistido';
import Notificaciones from './pages/Notificaciones';
import SeguimientoTraslado from './pages/SeguimientoTraslado';


export default function App() {
  const { checkUser, loading } = useAuthStore();

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  if (loading) {
    return (
      <div className="min-h-[100svh] flex flex-col items-center justify-center bg-peie-bg gap-3">
        <div className="w-10 h-10 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin" />
        <span className="text-xs font-semibold text-peie-blue animate-pulse">Cargando PEIE Tools...</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reportes" element={<Reportes />} />
          
          <Route path="/herramientas" element={<Herramientas />} />
          <Route path="/herramientas/nueva" element={<NuevaHerramienta />} />
          <Route path="/herramientas/scanner" element={<QRScanner />} />
          <Route path="/herramientas/busqueda-visual" element={<BusquedaVisual />} />
          <Route path="/herramientas/:id" element={<HerramientaDetail />} />
          
          <Route path="/pedidos-herramientas" element={<Solicitudes />} />
          <Route path="/pedidos-personal" element={<Solicitudes />} />
          <Route path="/solicitudes" element={<Navigate to="/pedidos-herramientas" replace />} />
          <Route path="/solicitudes/nueva" element={<NuevaSolicitud />} />
          <Route path="/solicitudes/:id" element={<SolicitudDetail />} />
          <Route path="/solicitudes/:id/seguimiento" element={<SeguimientoTraslado />} />
          <Route path="/notificaciones" element={<Notificaciones />} />
          
          <Route path="/compras" element={<Compras />} />
          <Route path="/compras/:id" element={<CompraDetail />} />
          
          <Route path="/logistica" element={<Logistica />} />
          <Route path="/obras" element={<Obras />} />
          <Route path="/mis-obras" element={<MisObras />} />
          <Route path="/personal" element={<Personal />} />
          <Route path="/personal/nuevo-asistido" element={<NuevoPersonalAsistido />} />
          <Route path="/personal/busqueda-visual" element={<BusquedaPersonal />} />
          <Route path="/personal/trasladar/:id" element={<NuevoTrasladoPersonal />} />
          <Route path="/personal/traslados/:id" element={<TrasladoPersonalDetail />} />
          <Route path="/ordenes" element={<Ordenes />} />
          <Route path="/ordenes/nueva" element={<NuevaOrden />} />
          <Route path="/ordenes/:id" element={<OrdenDetail />} />
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
