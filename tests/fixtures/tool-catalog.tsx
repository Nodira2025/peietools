import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Herramientas from '../../src/pages/Herramientas';
import HerramientaDetail from '../../src/pages/HerramientaDetail';
import NuevaHerramienta from '../../src/pages/NuevaHerramienta';
import NuevaSolicitud from '../../src/pages/NuevaSolicitud';
import { useAuthStore } from '../../src/store/auth';
import { Toaster } from '../../src/components/ui/toaster';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import '../../src/index.css';

useAuthStore.setState({ loading:false, profile:{ id:'test-user',full_name:'Prueba de catálogo',username:'test',role:'admin',whatsapp:null,obra_id:null,active:true } });
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><BrowserRouter>
  <Routes>
    <Route path="/herramientas" element={<Herramientas />} />
    <Route path="/herramientas/nueva" element={<NuevaHerramienta />} />
    <Route path="/herramientas/:id" element={<HerramientaDetail />} />
    <Route path="/solicitudes/nueva" element={<NuevaSolicitud />} />
    <Route path="*" element={<Navigate to="/herramientas" replace />} />
  </Routes>
  <Toaster />
</BrowserRouter></ErrorBoundary></StrictMode>);
