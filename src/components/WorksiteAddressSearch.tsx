import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { findWorksiteAddress, type AddressMatch } from '../lib/worksiteGeocoding';

export default function WorksiteAddressSearch({address, onSelect}: {address: string; onSelect: (match: AddressMatch) => void}) {
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [matches,setMatches] = useState<AddressMatch[]>([]);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const search = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(),15000);
    setBusy(true); setMessage(''); setMatches([]);
    try {
      const results = await findWorksiteAddress(address,controller.signal);
      if (request.current !== controller) return;
      setMatches(results);
      if (!results.length) setMessage('No encontramos una coincidencia de calle y altura. El mapa puede no tener registrada esa numeración. Revisá el domicilio en Google Maps y cargá sus coordenadas; no uses un punto de la calle sin número.');
    } catch (error) {
      if (request.current === controller) setMessage(controller.signal.aborted ? 'La búsqueda demoró demasiado. Intentá nuevamente.' : error instanceof Error ? error.message : 'No se pudo buscar el domicilio.');
    } finally { clearTimeout(timer); if (request.current === controller) setBusy(false); }
  };
  return <div className="space-y-2">
    <Button type="button" variant="outline" disabled={busy || address.trim().length < 5} onClick={search}>{busy ? 'Buscando domicilio…' : 'Ubicar domicilio en el mapa'}</Button>
    <p className="text-xs text-muted-foreground">Incluí calle, altura y localidad. Elegí la coincidencia correcta para guardar su ubicación.</p>
    {message && <p role="status" className="text-sm text-amber-800">{message}</p>}
    {message && !matches.length && <a className="block text-sm text-blue-700 underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Buscar domicilio completo en Google Maps</a>}
    {matches.length > 0 && <div className="rounded-lg border divide-y" aria-label="Domicilios encontrados">
      {matches.map((match,index) => <button type="button" key={index} className="block p-3 text-left text-sm hover:bg-blue-50 w-full" onClick={() => { onSelect(match); setMatches([]); setMessage('Ubicación seleccionada. Guardá la obra para actualizar el Centro de Operaciones.'); }}>{match.label}</button>)}
    </div>}
    <a className="text-xs text-slate-500 underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Mapa: © OpenStreetMap · búsqueda Photon</a>
  </div>;
}
