import type { CatalogData, CatalogPage } from './obraCatalog';

/** Compact grouped report, shared by the all-obras PDF and JPEG exports. */
export async function renderObraDistribution(data: CatalogData[], date: string): Promise<CatalogPage[]> {
  const canvas = document.createElement('canvas');
  canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el informe de obras.');
  const ink = '#111827';
  const xs = [48, 112, 702, 1062, 1192];
  const bottom = 1620;
  const pages: CatalogPage[] = [];
  let y = 0;
  let number = 0;
  const wrap = (value: string, width: number, size: number) => {
    ctx.font = `700 ${size}px Arial`;
    const lines: string[] = []; let line = '';
    for (let word of value.trim().split(/\s+/)) {
      if (line && ctx.measureText(`${line} ${word}`).width > width) { lines.push(line); line = ''; }
      while (ctx.measureText(word).width > width) {
        let end = word.length - 1;
        while (end > 1 && ctx.measureText(word.slice(0, end)).width > width) end--;
        lines.push(word.slice(0, end)); word = word.slice(end);
      }
      line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (lines: string[], x: number, top: number, size: number, align: CanvasTextAlign = 'left', color = ink) => {
    ctx.font = `700 ${size}px Arial`; ctx.fillStyle = color; ctx.textAlign = align;
    lines.forEach((line, i) => ctx.fillText(line, x, top + size + i * size * 1.25));
    ctx.textAlign = 'left';
  };
  const cell = (x: number, top: number, w: number, h: number, fill = '#FFFFFF') => {
    ctx.fillStyle = fill; ctx.fillRect(x, top, w, h);
    ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.strokeRect(x, top, w, h);
  };
  const start = () => {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1240, 1754);
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 1236, 1750);
    text(['DISTRIBUCIÓN DE HERRAMIENTAS POR OBRA'], 620, 54, 35, 'center');
    text([`PEIE Tools · ${date}`], 620, 108, 20, 'center');
    ctx.beginPath(); ctx.moveTo(48, 151); ctx.lineTo(1192, 151); ctx.stroke();
    y = 182;
    ['#', 'Herramienta / código', 'Obra asignada', 'Cantidad'].forEach((label, i) => {
      cell(xs[i], y, xs[i + 1] - xs[i], 52, ink);
      text([label], i === 1 ? xs[i] + 18 : (xs[i] + xs[i + 1]) / 2, y + 13, 20, i === 1 ? 'left' : 'center', '#FFFFFF');
    });
    y += 52;
  };
  const finish = async () => {
    text([`Página ${pages.length + 1}`], 1192, 1676, 19, 'right');
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo generar el informe.')), 'image/jpeg', 0.93));
    pages.push({ blob, name: `PEIE-distribucion-herramientas-${pages.length + 1}.jpeg` });
  };
  start();
  for (const { obra, tools } of [...data].sort((a, b) => a.obra.name.localeCompare(b.obra.name, 'es', { numeric: true }))) {
    const rows = tools.length ? tools.map(tool => ({ lines: wrap(`${tool.name} · ${tool.code}`, 554, 21), real: true })) : [{ lines: ['Sin herramientas asignadas'], real: false }];
    const obraLines = wrap(obra.name.toUpperCase(), 320, 22);
    const labelHeight = obraLines.length * 27.5 + 24;
    const heights = rows.map(row => Math.max(44, row.lines.length * 26.25 + 16));
    const groupHeight = Math.max(labelHeight, heights.reduce((sum, h) => sum + h, 0));
    if (groupHeight <= bottom - 234 && y + groupHeight > bottom) { await finish(); start(); }
    for (let index = 0; index < rows.length;) {
      const continued = index > 0;
      const labels = continued ? [...obraLines, '(continuación)'] : obraLines;
      const minHeight = labels.length * 27.5 + 24;
      if (bottom - y < Math.max(minHeight, heights[index])) { await finish(); start(); }
      const first = index;
      let height = 0;
      while (index < rows.length && height + heights[index] <= bottom - y) { height += heights[index]; index++; }
      if (index === first) throw new Error('Un nombre de herramienta es demasiado largo para el informe.');
      const extra = Math.max(0, minHeight - height);
      height += extra;
      let rowY = y;
      for (let i = first; i < index; i++) {
        const h = heights[i] + (i === index - 1 ? extra : 0);
        cell(xs[0], rowY, xs[1] - xs[0], h);
        cell(xs[1], rowY, xs[2] - xs[1], h);
        if (rows[i].real) text([String(++number)], 80, rowY + (h - 26) / 2, 20, 'center');
        text(rows[i].lines, xs[1] + 18, rowY + (h - rows[i].lines.length * 26.25) / 2, 21);
        rowY += h;
      }
      cell(xs[2], y, xs[3] - xs[2], height, '#F8FAFC');
      cell(xs[3], y, xs[4] - xs[3], height, '#F8FAFC');
      text(labels, (xs[2] + xs[3]) / 2, y + (height - labels.length * 27.5) / 2, 22, 'center');
      text([String(tools.length)], (xs[3] + xs[4]) / 2, y + (height - 30) / 2, 24, 'center');
      y += height;
      if (index < rows.length) { await finish(); start(); }
    }
  }
  if (y + 60 > bottom) { await finish(); start(); }
  cell(48, y, 1014, 60, '#F1F5F9'); cell(1062, y, 130, 60, '#E2E8F0');
  text([`TOTAL HERRAMIENTAS EN ${data.length} OBRAS:`], 1044, y + 16, 22, 'right');
  text([String(data.reduce((sum, row) => sum + row.tools.length, 0))], 1127, y + 14, 25, 'center');
  await finish(); canvas.width = 0; canvas.height = 0;
  return pages;
}
