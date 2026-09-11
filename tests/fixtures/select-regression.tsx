import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../src/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '../../src/components/ui/dialog';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import '../../src/index.css';

function Fixture() {
  const [value, setValue] = useState('san-pablo');
  const [open, setOpen] = useState(false);
  const selector = (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger aria-label="Obra"><SelectValue placeholder="Seleccionar obra" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="san-pablo">SAN PABLO</SelectItem>
        <SelectItem value="domus">DOMUS</SelectItem>
      </SelectContent>
    </Select>
  );
  return <>
    <button onClick={() => setOpen(true)}>Abrir ficha</button>
    <button onClick={() => setValue('')}>Vaciar selección</button>
    <output data-testid="selection">{value || 'sin asignar'}</output>
    {selector}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent><DialogTitle>Ficha de prueba</DialogTitle>{selector}</DialogContent>
    </Dialog>
  </>;
}

const root = document.getElementById('root')!;
root.dataset.reactOwned = 'true';
createRoot(root).render(<StrictMode><ErrorBoundary><Fixture /></ErrorBoundary></StrictMode>);
