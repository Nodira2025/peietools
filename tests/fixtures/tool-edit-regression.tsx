import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import HerramientaDetail from '../../src/pages/HerramientaDetail';
import { useAuthStore } from '../../src/store/auth';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { Toaster } from '../../src/components/ui/toaster';
import '../../src/index.css';

useAuthStore.setState({ loading: false, profile: {
  id: 'test-user', full_name: 'Prueba', username: 'prueba', role: 'admin',
  whatsapp: null, obra_id: null, active: true,
} });
const root = document.getElementById('root')!;
root.dataset.reactOwned = 'true';
createRoot(root).render(<StrictMode><ErrorBoundary>
  <MemoryRouter initialEntries={['/herramientas/test-tool']}>
    <Routes><Route path="/herramientas/:id" element={<HerramientaDetail />} /></Routes>
    <Toaster />
  </MemoryRouter>
</ErrorBoundary></StrictMode>);
