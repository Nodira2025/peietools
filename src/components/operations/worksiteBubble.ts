import { SHOW_EXTENDED_OPERATIONS } from './operationsFeatures';
import type { OperationalWorksite } from '../../types/operations';
import { formatARS } from '../../services/tools/toolPriceReference';

export function progressLabel(worksite: OperationalWorksite) {
  return worksite.progressPercent == null ? 'Sin datos' : `${worksite.progressPercent}%`;
}
export function createWorksiteBubble(worksite: OperationalWorksite, size: number, selected: boolean) {
  if (!SHOW_EXTENDED_OPERATIONS) {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'peie-operation-bubble-marker';
    marker.setAttribute('aria-label', worksite.name + '. Personal: ' + worksite.workersCount + '. Herramientas: ' + worksite.toolsCount + '. Ver obra');
    marker.style.cssText = 'display:flex;flex-direction:column;align-items:center;border:0;background:transparent;padding:0;cursor:pointer;max-width:148px';
    const label = document.createElement('span');
    label.textContent = worksite.name;
    label.style.cssText = 'max-width:148px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:6px;padding:3px 7px;background:white;color:#042454;font:bold 11px system-ui;box-shadow:0 1px 4px #0003';
    const counts = document.createElement('span');
    counts.textContent = '👷 ' + worksite.workersCount + '  ·  🛠 ' + worksite.toolsCount;
    counts.style.cssText = 'border:2px solid white;border-radius:16px;padding:5px 9px;background:' + (selected ? '#b45309' : '#042454') + ';color:white;font:bold 12px system-ui;box-shadow:0 2px 6px #0004';
    const stem = document.createElement('span');
    stem.style.cssText = 'height:12px;width:2px;background:#042454';
    const point = document.createElement('span');
    point.style.cssText = 'height:8px;width:8px;border:2px solid white;border-radius:50%;background:#042454;box-shadow:0 0 2px #000';
    marker.append(label, counts, stem, point);
    return marker;
  }
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'peie-operation-bubble-marker';
  element.setAttribute('aria-label', `${worksite.name}. Avance: ${progressLabel(worksite)}. Ver resumen de obra`);
  element.style.cssText = `width:${size}px;height:${size}px;border:0;padding:7px;border-radius:50%;position:relative;cursor:pointer;background:white;box-shadow:0 2px 9px #03153066;${selected ? 'outline:3px solid #f59e0b;outline-offset:3px;' : ''}`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  const circumference = 2 * Math.PI * 45;
  for (const isProgress of [false, true]) {
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    for (const [key, value] of Object.entries({ cx: '50', cy: '50', r: '45', fill: 'none', stroke: isProgress ? (worksite.progressPercent === 100 ? '#059669' : '#0284c7') : '#cbd5e1', 'stroke-width': '8' })) circle.setAttribute(key, value);
    if (isProgress) {
      circle.setAttribute('stroke-dasharray', String(circumference));
      circle.setAttribute('stroke-dashoffset', String(circumference * (1 - (worksite.progressPercent ?? 0) / 100)));
      circle.setAttribute('transform', 'rotate(-90 50 50)');
      circle.setAttribute('data-progress-ring', String(worksite.progressPercent ?? 'unknown'));
    }
    svg.append(circle);
  }
  element.append(svg);
  const face = document.createElement('span');
  face.style.cssText = 'display:flex;position:relative;width:100%;height:100%;border-radius:50%;align-items:center;justify-content:center;flex-direction:column;background:#042454;color:white;line-height:1.1;overflow:hidden;pointer-events:none';
  if (worksite.photo_url && /^https?:\/\//i.test(worksite.photo_url)) {
    const photo = document.createElement('img'); photo.src = worksite.photo_url; photo.alt = ''; photo.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.25'; face.append(photo);
  }
  const percent = document.createElement('strong'); percent.textContent = progressLabel(worksite); percent.style.cssText = `position:relative;font-size:${worksite.progressPercent == null ? 10 : 15}px`; face.append(percent);
  const target = document.createElement('span'); target.textContent = worksite.progressPercent == null ? 'avance' : 'de 100%'; target.style.cssText = 'position:relative;font-size:8px'; face.append(target);
  element.append(face);
  return element;
}

export function createWorksiteSummary(worksite: OperationalWorksite) {
  if (!SHOW_EXTENDED_OPERATIONS) {
    const summary = document.createElement('div');
    summary.style.cssText = 'padding:10px;font:12px system-ui;color:#042454;max-width:240px';
    for (const text of [worksite.name, worksite.address || 'Sin dirección', 'Personal asignado: ' + worksite.workersCount, 'Herramientas en obra: ' + worksite.toolsCount]) {
      const row = document.createElement('p'); row.textContent = text; row.style.margin = '4px 0'; summary.append(row);
    }
    return summary;
  }
  const element = document.createElement('div');
  element.className = 'p-3 text-xs text-slate-800';
  element.style.cssText = 'min-width:220px;max-width:270px;font-family:system-ui';
  const title = document.createElement('strong'); title.textContent = worksite.name; title.style.cssText = 'display:block;font-size:14px;margin-bottom:8px;color:#042454'; element.append(title);
  const rows = [
    ['Trabajadores asignados', String(worksite.workersCount)],
    ['Horas totales registradas', `${worksite.totalLaborHours.toLocaleString('es-AR')} h`],
    ['Herramientas en obra', String(worksite.toolsCount)],
    ['Valor de herramientas', formatARS(worksite.totalToolValue ?? 0)],
    ['Costo por horas', worksite.laborRecordCount === 0 ? 'Sin registros' : formatARS(worksite.totalLaborCost)],
    ['Finalización', worksite.progressPercent == null ? 'Sin datos' : `${progressLabel(worksite)} de 100%`],
  ];
  const list = document.createElement('dl');
  for (const [label, value] of rows) {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #e2e8f0';
    const term = document.createElement('dt'); term.textContent = label;
    const data = document.createElement('dd'); data.textContent = value; data.style.cssText = 'font-weight:700;text-align:right;margin:0'; row.append(term, data); list.append(row);
  }
  element.append(list);
  const note = document.createElement('p');
  note.textContent = `${worksite.estimatedToolCount || 0} herramientas con valor estimado. ${worksite.estimatedLaborHours || 0} h con tarifa estimada. Avance y precios manuales guardados en este navegador.`;
  note.style.cssText = 'font-size:10px;line-height:1.4;color:#64748b;margin-top:8px'; element.append(note);
  return element;
}
