import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { Toaster } from '@/components/ui/toaster';

// Layouts
import AppLayout from './layouts/AppLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Obras from './pages/Obras';
import Usuarios from './pages/Usuarios';
import Herramientas from './pages/Herramientas';
import NuevaHerramienta from './pages/NuevaHerramienta';
import HerramientaDetail from './pages/HerramientaDetail';
import QRScanner from './pages/QRScanner';
import Solicitudes from './pages/Solicitudes';
import NuevaSolicitud from './pages/NuevaSolicitud';
import SolicitudDetail from './pages/SolicitudDetail';
import Logistica from './pages/Logistica';
import Compras from './pages/Compras';
import CompraDetail from './pages/CompraDetail';

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
          <Route path="/" element={<Navigate to="/solicitudes" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          <Route path="/herramientas" element={<Herramientas />} />
          <Route path="/herramientas/nueva" element={<NuevaHerramienta />} />
          <Route path="/herramientas/scanner" element={<QRScanner />} />
          <Route path="/herramientas/:id" element={<HerramientaDetail />} />
          
          <Route path="/solicitudes" element={<Solicitudes />} />
          <Route path="/solicitudes/nueva" element={<NuevaSolicitud />} />
          <Route path="/solicitudes/:id" element={<SolicitudDetail />} />
          
          <Route path="/compras" element={<Compras />} />
          <Route path="/compras/:id" element={<CompraDetail />} />
          
          <Route path="/logistica" element={<Logistica />} />
          <Route path="/obras" element={<Obras />} />
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>

        <Route path="*" element={<Navigate to="/solicitudes" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
