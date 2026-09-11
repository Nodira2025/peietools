import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Herramientas from '../../src/pages/Herramientas';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import '../../src/index.css';

const root = document.getElementById('root')!;
root.dataset.reactOwned = 'true';
createRoot(root).render(<StrictMode><ErrorBoundary>
  <MemoryRouter><Herramientas /></MemoryRouter>
</ErrorBoundary></StrictMode>);
