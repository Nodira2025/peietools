import { supabase } from './supabase';

export interface CatalogObra {
  id: string;
  name: string;
  address: string | null;
  encargado_name: string | null;
  active: boolean;
  latitude?: number | null;
  longitude?: number | null;
}
interface Worker { id: string; full_name: string; specialty: string | null; photo_url: string | null }
interface Tool { id: string; name: string; code: string; brand: string | null; status: string; photo_url: string | null }
export interface CatalogData { obra: CatalogObra; workers: Worker[]; tools: Tool[] }
export interface CatalogPage { blob: Blob; name: string }

// Explicit ranges prevent Supabase's row limit from silently truncating a catalog.
export async function loadObraCatalog(obra: CatalogObra, toolsOnly = false): Promise<CatalogData> {
  const workers: Worker[] = [];
  const tools: Tool[] = [];
  for (let offset = 0; !toolsOnly; offset += 500) {
    const result = await supabase.from('empleados').select('id, full_name, specialty, photo_url')
      .eq('obra_id', obra.id).eq('active', true).order('full_name').order('id').range(offset, offset + 499);
    if (result.error) throw new Error('No se pudo cargar el personal de ' + obra.name);
    workers.push(...(result.data || []));
    if ((result.data?.length || 0) < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const query = toolsOnly
      ? supabase.from('herramientas').select('id, name, code, brand, status')
      : supabase.from('herramientas').select('id, name, code, brand, status, photo_url');
    const result = await query
      .eq('current_obra_id', obra.id).order('name').order('id').range(offset, offset + 499);
    if (result.error) throw new Error('No se pudieron cargar las herramientas de ' + obra.name);
    tools.push(...(result.data || []).map(tool => ({ ...tool, photo_url: 'photo_url' in tool ? tool.photo_url : null })) as Tool[]);
    if ((result.data?.length || 0) < 500) break;
  }
  return { obra, workers, tools };
}

function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    const timer = window.setTimeout(() => { img.src = ''; resolve(null); }, 10000);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

export const catalogFilename = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'obra';

/** One canvas per page: bounded memory on phones, with identical PDF/JPEG layout. */
export async function renderObraCatalog(data: CatalogData, date: string): Promise<{ pages: CatalogPage[]; missingPhotos: number }> {
  const { obra, workers, tools } = data;
  const logo = await loadImage('/logo-peie.png');
  if (!logo) throw new Error('No se pudo cargar el logo de PEIE. Reintentá la exportación.');
  const sections = [
    { title: 'TRABAJADORES', rows: workers.map(w => ({ name: w.full_name, detail: 'Rol: ' + (w.specialty || 'Sin registrar'), extra: '', photo: w.photo_url })) },
    { title: 'HERRAMIENTAS', rows: tools.map(t => ({ name: t.name, detail: t.code + ' · ' + (t.brand || 'Marca sin registrar'), extra: t.status, photo: t.photo_url })) },
  ];
  const totalPages = sections.reduce((sum, section) => sum + Math.max(1, Math.ceil(section.rows.length / 8)), 0);
  const pages: CatalogPage[] = [];
  let missingPhotos = 0;
  for (const section of sections) {
    for (let start = 0; start < Math.max(1, section.rows.length); start += 8) {
      const canvas = document.createElement('canvas');
      canvas.width = 1240; canvas.height = 1754;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Este navegador no pudo crear el catálogo.');
      const text = (value: string, x: number, y: number, width: number, size = 24, bold = false, color = '#081A63', maxLines = 2) => {
        ctx.fillStyle = color; ctx.font = `${bold ? '700' : '400'} ${size}px Arial`;
        const words = value.trim().split(/\s+/);
        const lines: string[] = []; let line = '';
        for (let word of words) {
          if (line && ctx.measureText(line + ' ' + word).width > width) { lines.push(line); line = ''; }
          // Split only individual tokens that cannot fit on a full line.
          while (ctx.measureText(word).width > width) {
            let cut = word.length - 1;
            while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > width) cut--;
            lines.push(word.slice(0, cut)); word = word.slice(cut);
          }
          line = line ? line + ' ' + word : word;
        }
        if (line) lines.push(line);
        lines.slice(0, maxLines).forEach((line, i) => {
          if (i === maxLines - 1 && lines.length > maxLines) {
            while (ctx.measureText(line + '…').width > width) line = line.slice(0, -1);
            line += '…';
          }
          ctx.fillText(line, x, y + i * size * 1.25);
        });
      };
      ctx.fillStyle = '#F8FAFC'; ctx.fillRect(0, 0, 1240, 1754);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1240, 150);
      const scale = Math.min(230 / logo.width, 100 / logo.height);
      ctx.drawImage(logo, 48, 25, logo.width * scale, logo.height * scale);
      text('CATÁLOGO DE OBRA', 330, 67, 860, 31, true);
      text('PEIE · Personal y herramientas', 330, 109, 860, 24);
      ctx.fillStyle = '#081A63'; ctx.fillRect(0, 150, 1240, 370);
      text(obra.name, 48, 205, 1144, 38, true, '#FFFFFF');
      text('Ubicación: ' + (obra.address || 'Sin dirección registrada'), 48, 304, 1144, 25, false, '#FFFFFF');
      text('Responsable: ' + (obra.encargado_name || 'Sin asignar'), 48, 379, 1144, 25, false, '#FFFFFF');
      text(`${workers.length} trabajadores    |    ${tools.length} herramientas    |    ${obra.active ? 'Activa' : 'Inactiva'}`, 48, 468, 1144, 27, true, '#4FC3F7', 1);
      text(section.title, 48, 577, 900, 29, true);
      text(`${section.rows.length} en esta obra`, 920, 577, 270, 22);
      const rows = section.rows.slice(start, start + 8);
      const photos = await Promise.all(rows.map(row => loadImage(row.photo)));
      rows.forEach((row, index) => {
        const x = 48 + (index % 2) * 584;
        const y = 612 + Math.floor(index / 2) * 248;
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, 560, 226);
        ctx.strokeStyle = '#E5E7EB'; ctx.strokeRect(x, y, 560, 226);
        const image = photos[index];
        ctx.fillStyle = '#E5E7EB'; ctx.fillRect(x + 16, y + 18, 138, 174);
        if (image) {
          // Contain preserves the full tool and workers' faces.
          const scale = Math.min(138 / image.width, 174 / image.height);
          ctx.drawImage(image, x + 16 + (138 - image.width * scale) / 2, y + 18 + (174 - image.height * scale) / 2, image.width * scale, image.height * scale);
        } else {
          if (row.photo) missingPhotos++;
          text('Sin foto', x + 36, y + 107, 110, 21, false, '#64748B');
        }
        text(row.name, x + 174, y + 44, 368, 26, true, '#081A63', 3);
        text(row.detail, x + 174, y + 146, 368, 22, false, '#475569');
        text(row.extra, x + 174, y + 207, 368, 21, true, '#081A63', 1);
      });
      if (!rows.length) text('Sin ' + section.title.toLowerCase() + ' asignados a esta obra.', 48, 670, 1144, 27);
      ctx.fillStyle = '#081A63'; ctx.fillRect(48, 1642, 1144, 3);
      text('Actualizado: ' + date, 48, 1687, 850, 21, false, '#475569', 1);
      text(`Página ${pages.length + 1} de ${totalPages}`, 960, 1687, 232, 21, false, '#475569', 1);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.')), 'image/jpeg', 0.9));
      pages.push({ blob, name: `PEIE-${catalogFilename(obra.name)}-${catalogFilename(obra.id).slice(0, 8)}-${pages.length + 1}.jpeg` });
      canvas.width = 0; canvas.height = 0;
    }
  }
  return { pages, missingPhotos };
}

export async function catalogPdf(pages: CatalogPage[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: 'PEIE - Catálogo de obras', author: 'PEIE' });
  for (let index = 0; index < pages.length; index++) {
    if (index) pdf.addPage();
    pdf.addImage(new Uint8Array(await pages[index].blob.arrayBuffer()), 'JPEG', 0, 0, 210, 297);
  }
  return pdf.output('blob');
}
