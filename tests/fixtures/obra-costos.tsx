import { createRoot } from 'react-dom/client';
import ObraRecursosCostos from '../../src/components/coordinadores/ObraRecursosCostos';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(<main className="p-3"><ObraRecursosCostos obraId="00000000-0000-4000-8000-000000000001" coordinador="Coordinador existente" fases={[{ id: '00000000-0000-4000-8000-000000000002', obra_id: '00000000-0000-4000-8000-000000000001', name: 'Cableado', start_date: '2026-09-01', end_date: '2026-09-30', progress: 0, status: 'Pendiente', order_index: 1 }]} /></main>);
