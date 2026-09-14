import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Logistica from '../../src/pages/Logistica';
import Dashboard from '../../src/pages/Dashboard';
import { useAuthStore } from '../../src/store/auth';
import '../../src/index.css';
useAuthStore.setState({ profile: { id: 'test-user', full_name: 'Usuario de prueba', role: 'logistica' } as never, loading: false });
const isDashboard = new URLSearchParams(location.search).get('view') === 'dashboard';
createRoot(document.getElementById('root')!).render(<BrowserRouter>{isDashboard ? <Dashboard /> : <Logistica />}</BrowserRouter>);
