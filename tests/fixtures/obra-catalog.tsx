import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MisObras from '../../src/pages/MisObras';
import Herramientas from '../../src/pages/Herramientas';
import { useAuthStore } from '../../src/store/auth';
import '../../src/index.css';

useAuthStore.setState({ loading: false, profile: { id: 'test', full_name: 'Prueba', username: 'test', role: 'admin', whatsapp: null, obra_id: null, active: true } });
createRoot(document.getElementById('root')!).render(<BrowserRouter><div className="p-4">
  <Routes><Route path="/herramientas" element={<Herramientas />} /><Route path="*" element={<MisObras />} /></Routes>
</div></BrowserRouter>);
