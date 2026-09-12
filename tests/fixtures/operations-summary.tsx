import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CentroOperaciones from '../../src/pages/CentroOperaciones';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(<BrowserRouter><CentroOperaciones /></BrowserRouter>);
