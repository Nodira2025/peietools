import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { useAuthStore } from '../../src/store/auth';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import '../../src/index.css';
const role = new URLSearchParams(location.search).get('role') || 'admin';
useAuthStore.setState({ loading: false, user: {id: 'test-user'} as never,
  profile: { id: 'test-user', full_name: 'Coordinador QA', username: 'qa', role, active: true, whatsapp: null, obra_id: null }, checkUser: async()=>{} });
window.open = () => { document.body.dataset.qaExternalLink = 'blocked'; return null; };
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
