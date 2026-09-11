import { useEffect, lazy, Suspense } from 'react';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { Toaster } from '@/components/ui/toaster';

// Layouts
import AppLayout from './layouts/AppLayout';

// Pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Obras = lazy(() => import('./pages/Obras'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Herramientas = lazy(() => import('./pages/Herramientas'));
const NuevaHerramienta = lazy(() => import('./pages/NuevaHerramienta'));
const HerramientaDetail = lazy(() => import('./pages/HerramientaDetail'));
const QRScanner = lazy(() => import('./pages/QRScanner'));
const BusquedaVisual = lazy(() => import('./pages/BusquedaVisual'));
const BusquedaPersonal = lazy(() => import('./pages/BusquedaPersonal'));
const Solicitudes = lazy(() => import('./pages/Solicitudes'));
const NuevaSolicitud = lazy(() => import('./pages/NuevaSolicitud'));
const SolicitudDetail = lazy(() => import('./pages/SolicitudDetail'));
const Logistica = lazy(() => import('./pages/Logistica'));
const Compras = lazy(() => import('./pages/Compras'));
const CompraDetail = lazy(() => import('./pages/CompraDetail'));
const MisObras = lazy(() => import('./pages/MisObras'));
const Personal = lazy(() => import('./pages/Personal'));
const NuevoTrasladoPersonal = lazy(() => import('./pages/NuevoTrasladoPersonal'));
const TrasladoPersonalDetail = lazy(() => import('./pages/TrasladoPersonalDetail'));
const Ordenes = lazy(() => import('./pages/Ordenes'));
const NuevaOrden = lazy(() => import('./pages/NuevaOrden'));
const OrdenDetail = lazy(() => import('./pages/OrdenDetail'));
const NuevoPersonalAsistido = lazy(() => import('./pages/NuevoPersonalAsistido'));
const Notificaciones = lazy(() => import('./pages/Notificaciones'));
const SeguimientoTraslado = lazy(() => import('./pages/SeguimientoTraslado'));
const Contactos = lazy(() => import('./pages/Contactos'));
const Formularios = lazy(() => import('./pages/Formularios'));
const Legales = lazy(() => import('./pages/Legales'));
const Trabajadores = lazy(() => import('./pages/Trabajadores'));
const CargarHorasPublico = lazy(() => import('./pages/CargarHorasPublico'));
const LiquidacionSueldos = lazy(() => import('./pages/LiquidacionSueldos'));
const CentroOperaciones = lazy(() => import('./pages/CentroOperaciones'));
const Coordinadores = lazy(() => import('./pages/Coordinadores'));
const PostulacionPublica = lazy(() => import('./pages/PostulacionPublica'));
const Entrevistas = lazy(() => import('./pages/Entrevistas'));
const PersonalDatos = lazy(() => import('./pages/PersonalDatos'));







import LogoLoader from './components/LogoLoader';

export default function App() {
  const { checkUser, loading } = useAuthStore();

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  if (loading) {
    return <LogoLoader fullScreen text="Cargando PEIE Tools..." size="md" />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LogoLoader fullScreen text="Cargando sección..." size="md" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cargar-horas" element={<CargarHorasPublico />} />
        <Route 
          path="/postulacion" 
          element={
            <Suspense fallback={<LogoLoader fullScreen text="Cargando Postulación..." size="md" />}>
              <PostulacionPublica />
            </Suspense>
          } 
        />
        <Route path="/cargar-cv" element={<Navigate to="/postulacion" replace />} />
        
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

          <Route path="/formularios" element={<Formularios />} />
          <Route path="/legales" element={<Legales />} />
          <Route path="/trabajadores" element={<Trabajadores />} />
          <Route path="/liquidacion-sueldos" element={<LiquidacionSueldos />} />

          
          <Route path="/compras" element={<Compras />} />
          <Route path="/compras/:id" element={<CompraDetail />} />
          <Route path="/contactos" element={<Contactos />} />
          <Route path="/proveedores" element={<Navigate to="/contactos" replace />} />
          
          <Route path="/logistica" element={<Logistica />} />
          <Route path="/obras" element={<Obras />} />
          <Route path="/mis-obras" element={<MisObras />} />
          <Route 
            path="/centro-operaciones" 
            element={
              <Suspense fallback={<LogoLoader fullScreen text="Cargando Centro de Operaciones..." size="md" />}>
                <CentroOperaciones />
              </Suspense>
            } 
          />
          <Route path="/mapa-operativo" element={<Navigate to="/centro-operaciones" replace />} />
          <Route 
            path="/coordinadores" 
            element={
              <Suspense fallback={<LogoLoader fullScreen text="Cargando Coordinadores..." size="md" />}>
                <Coordinadores />
              </Suspense>
            } 
          />
          <Route 
            path="/entrevistas" 
            element={
              <Suspense fallback={<LogoLoader fullScreen text="Cargando Entrevistas..." size="md" />}>
                <Entrevistas />
              </Suspense>
            } 
          />
          <Route path="/personal" element={<Personal />} />
          <Route path="/personal-datos" element={
            <Suspense fallback={<LogoLoader fullScreen text="Cargando Personal Datos..." size="md" />}>
              <PersonalDatos />
            </Suspense>
          } />
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
      </Suspense>
      <Toaster />
    </BrowserRouter>
  );
}
