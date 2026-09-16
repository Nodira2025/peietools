import { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { catalogFilename, filterExportObras, type CatalogObra } from '../lib/obraCatalog';

interface ExportFile { file: File; url: string }

export default function ObraCatalogExport({ obras, selectedObra, disabled = false }: {
  obras: CatalogObra[]; selectedObra?: CatalogObra | null; disabled?: boolean;
}) {
  const [scope, setScope] = useState<CatalogObra[] | null>(null);
  const [allObras, setAllObras] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [files, setFiles] = useState<ExportFile[]>([]);
  const urls = useRef<string[]>([]);
  const sequence = useRef(0);
  const revoke = () => { urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = []; };
  useEffect(() => () => { sequence.current++; urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  const open = (selection: CatalogObra[], all = false) => {
    setAllObras(all);
    const targetSelection = all ? filterExportObras(selection) : selection;
    revoke(); setFiles([]); setError(''); setWarning(''); setScope(targetSelection);
  };
  const close = () => {
    sequence.current++; revoke(); setFiles([]); setScope(null); setBusy(false);
  };
  const generate = async (format: 'pdf' | 'jpeg') => {
    if (!scope?.length || busy) return;
    const request = ++sequence.current;
    setBusy(true); setError(''); setWarning(''); revoke(); setFiles([]);
    try {
      const { loadObraCatalog, renderObraCatalog, catalogPdf } = await import('../lib/obraCatalog');
      const pages = [];
      const distribution = [];
      let missingPhotos = 0;
      const date = new Date().toLocaleString('es-AR');
      for (const [index, obra] of scope.entries()) {
        setProgress(`Preparando obra ${index + 1} de ${scope.length}: ${obra.name}`);
        const data = await loadObraCatalog(obra, allObras);
        if (sequence.current !== request) return;
        if (allObras) { distribution.push(data); continue; }
        const result = await renderObraCatalog(data, date);
        if (sequence.current !== request) return;
        pages.push(...result.pages); missingPhotos += result.missingPhotos;
      }
      if (allObras) {
        const { renderObraDistribution } = await import('../lib/obraDistribution');
        pages.push(...await renderObraDistribution(distribution, date.split(',')[0]));
      }
      const name = allObras ? 'todas-las-obras' : catalogFilename(scope[0].name);
      const output = format === 'pdf'
        ? [new File([await catalogPdf(pages)], `PEIE-${name}.pdf`, { type: 'application/pdf' })]
        : pages.map(page => new File([page.blob], page.name, { type: 'image/jpeg' }));
      if (sequence.current !== request) return;
      setFiles(output.map(file => { const url = URL.createObjectURL(file); urls.current.push(url); return { file, url }; }));
      if (missingPhotos) setWarning(`${missingPhotos} fotos no se pudieron cargar y aparecen como «Sin foto». Podés reintentar la generación.`);
    } catch (cause) {
      if (sequence.current === request) setError(cause instanceof Error ? cause.message : 'No se pudo generar el catálogo. Reintentá.');
    } finally { if (sequence.current === request) setBusy(false); }
  };
  const canShare = files.length > 0 && !!navigator.canShare?.({ files: files.map(item => item.file) });
  const share = async () => {
    try { await navigator.share({ files: files.map(item => item.file), title: 'Catálogo PEIE' }); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('No se pudo compartir. Descargá los archivos y adjuntalos en WhatsApp.'); }
  };

  return <>
    <div className="flex flex-wrap gap-2">
      {selectedObra && <Button variant="outline" disabled={disabled || busy} onClick={() => open([selectedObra])}><Download className="mr-2 h-4 w-4" />Exportar obra</Button>}
      <Button variant="outline" disabled={disabled || busy || !obras.length} onClick={() => open(obras, true)}><Download className="mr-2 h-4 w-4" />Exportar todas las obras</Button>
    </div>
    <Dialog open={scope !== null} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Exportar catálogo PEIE</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-600">{scope?.length === 1 ? scope[0].name : `${scope?.length || 0} obras accesibles, incluidas las inactivas y las que no aparecen con los filtros actuales.`}</p>
        <p className="text-sm text-slate-600">{allObras ? 'PDF de una sola página continua con todas las obras. JPEG genera una única imagen con el mismo contenido.' : 'PDF reúne todas las páginas. JPEG genera una imagen por página, lista para descargar y adjuntar en WhatsApp.'}</p>
        {allObras && <p className="text-sm text-slate-600">Tabla de herramientas agrupadas por obra, con cantidades por obra y total general.</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={busy} onClick={() => void generate('pdf')}>Generar PDF</Button>
          <Button disabled={busy} onClick={() => void generate('jpeg')}>Generar JPEG</Button>
        </div>
        {busy && <p role="status" className="text-sm text-peie-blue">{progress}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {warning && <p role="status" className="text-sm text-amber-800">{warning}</p>}
        {files.length > 0 && <div className="space-y-3">
          <p className="text-sm font-semibold">{files.length} {files.length === 1 ? 'archivo listo' : 'archivos listos'}</p>
          {canShare && <Button className="w-full" onClick={() => void share()}><Share2 className="mr-2 h-4 w-4" />Compartir archivos</Button>}
          {files.map(({ file, url }, index) => <div key={url} className="rounded-xl border p-3 space-y-2">
            {file.type === 'image/jpeg' && <img loading="lazy" src={url} alt={`Página ${index + 1} del catálogo`} className="w-full rounded-lg" />}
            <a href={url} download={file.name} className="block break-all text-sm font-semibold text-peie-blue underline">Descargar {file.name}</a>
          </div>)}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
