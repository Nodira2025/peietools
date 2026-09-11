import { createRoot } from 'react-dom/client';
import type { User } from '@supabase/supabase-js';
import App from '../../src/App';
import { useAuthStore } from '../../src/store/auth';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import '../../src/index.css';

useAuthStore.setState({
  loading: false,
  user: { id: 'test-user' } as User,
  profile: { id: 'test-user', full_name: 'Prueba', username: 'prueba', role: new URLSearchParams(location.search).get('role') || 'admin', whatsapp: null, obra_id: null, active: true },
  checkUser: async () => {},
});
const root = document.getElementById('root')!;
root.dataset.reactOwned = 'true';
createRoot(root).render(<ErrorBoundary><App /></ErrorBoundary>);
