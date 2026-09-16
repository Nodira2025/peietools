import { getObraInformant, type CatalogData, type CatalogPage } from './obraCatalog';

/** Compact grouped report, shared by the all-obras PDF and JPEG exports. */
export async function renderObraDistribution(data: CatalogData[], date: string): Promise<CatalogPage[]> {
  const canvas = document.createElement('canvas');
  canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el informe de obras.');
  const ink = '#111827';
  const xs = [48, 104, 584, 864, 1094, 1192];
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
  // Measure every group before drawing: the export is one continuous sheet.
  const groups = [...data].sort((a, b) => a.obra.name.localeCompare(b.obra.name, 'es', { numeric: true })).map(({ obra, tools }) => {
    const rows = tools.length ? tools.map(tool => ({ lines: wrap(`${tool.name} · ${tool.code}`, 444, 20), real: true })) : [{ lines: ['Sin herramientas asignadas'], real: false }];
    const labels = wrap(obra.name.toUpperCase(), 250, 20);
    const informant = getObraInformant(obra.name, obra.encargado_name);
    const informantLines = wrap(informant, 200, 19);
    const heights = rows.map(row => Math.max(44, row.lines.length * 25 + 16));
    const contentHeight = Math.max(
      labels.length * 26 + 24,
      informantLines.length * 25 + 24,
      heights.reduce((sum, h) => sum + h, 0)
    );
    const height = Math.max(48, contentHeight);
    heights[heights.length - 1] += height - heights.reduce((sum, h) => sum + h, 0);
    return { tools, rows, labels, informantLines, heights, height };
  });
  const sheetHeight = Math.ceil(234 + groups.reduce((sum, group) => sum + group.height, 0) + 108);
  // Keep a valid canvas size even for exceptionally large inventories.
  const scale = Math.min(1, 16000 / sheetHeight);
  canvas.width = Math.round(1240 * scale); canvas.height = Math.round(sheetHeight * scale);
  ctx.scale(scale, scale);
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
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1240, sheetHeight);
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 1236, sheetHeight - 4);
    text(['DISTRIBUCIÓN DE HERRAMIENTAS POR OBRA'], 620, 54, 35, 'center');
    text([`PEIE Tools · ${date}`], 620, 108, 20, 'center');
    ctx.beginPath(); ctx.moveTo(48, 151); ctx.lineTo(1192, 151); ctx.stroke();
    y = 182;
    ['#', 'Herramienta / código', 'Obra asignada', 'Relevado por', 'Cant.'].forEach((label, i) => {
      cell(xs[i], y, xs[i + 1] - xs[i], 52, ink);
      text([label], i === 1 ? xs[i] + 16 : (xs[i] + xs[i + 1]) / 2, y + 14, 19, i === 1 ? 'left' : 'center', '#FFFFFF');
    });
    y += 52;
  };
  const finish = async () => {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo generar el informe.')), 'image/jpeg', 0.93));
    pages.push({ blob, name: 'PEIE-distribucion-herramientas.jpeg', width: canvas.width, height: canvas.height });
  };
  start();
  for (const { tools, rows, labels, informantLines, heights, height } of groups) {
      let rowY = y;
      for (let i = 0; i < rows.length; i++) {
        const h = heights[i];
        cell(xs[0], rowY, xs[1] - xs[0], h);
        cell(xs[1], rowY, xs[2] - xs[1], h);
        if (rows[i].real) text([String(++number)], (xs[0] + xs[1]) / 2, rowY + (h - 24) / 2, 19, 'center');
        text(rows[i].lines, xs[1] + 16, rowY + (h - rows[i].lines.length * 25) / 2, 20);
        rowY += h;
      }
      cell(xs[2], y, xs[3] - xs[2], height, '#F8FAFC');
      cell(xs[3], y, xs[4] - xs[3], height, '#F8FAFC');
      cell(xs[4], y, xs[5] - xs[4], height, '#F8FAFC');
      text(labels, (xs[2] + xs[3]) / 2, y + (height - labels.length * 26) / 2, 20, 'center');
      text(informantLines, (xs[3] + xs[4]) / 2, y + (height - informantLines.length * 25) / 2, 19, 'center', '#1e293b');
      text([String(tools.length)], (xs[4] + xs[5]) / 2, y + (height - 30) / 2, 24, 'center');
      y += height;
  }
  cell(48, y, xs[4] - 48, 60, '#F1F5F9'); cell(xs[4], y, xs[5] - xs[4], 60, '#E2E8F0');
  text([`TOTAL HERRAMIENTAS EN ${data.length} OBRAS:`], xs[4] - 18, y + 16, 22, 'right');
  text([String(data.reduce((sum, row) => sum + row.tools.length, 0))], (xs[4] + xs[5]) / 2, y + 14, 25, 'center');
  await finish(); canvas.width = 0; canvas.height = 0;
  return pages;
}
