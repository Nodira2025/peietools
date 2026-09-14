import type { Electricista, LiquidacionCosto, ObraTarea } from '../../types/obraCostos';

export const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function tarifaLiquidacion(liquidacion: LiquidacionCosto): number | null {
  const horas = Number(liquidacion.horas_trabajadas);
  if (horas <= 0 || !['APROBADO', 'PAGADO'].includes(liquidacion.estado)) return null;
  return round((Number(liquidacion.sueldo_bruto) + Number(liquidacion.bono_presentismo || 0)) / horas);
}
export function costoTarea(tarea: ObraTarea) {
  const horas = tarea.mano_obra.reduce((sum, row) => sum + Number(row.horas), 0);
  const laboral = round(tarea.mano_obra.reduce((sum, row) => sum + round(Number(row.horas) * Number(row.valor_hora)), 0));
  const herramientas = round(tarea.herramientas.reduce((sum, row) => sum + round(Number(row.cantidad) * Number(row.costo_unitario)), 0));
  return { horas, laboral, herramientas, total: round(laboral + herramientas) };
}
export function costoTotal(tareas: ObraTarea[]) {
  return tareas.reduce((total, tarea) => {
    const costo = costoTarea(tarea);
    return { horas: round(total.horas + costo.horas), laboral: round(total.laboral + costo.laboral), herramientas: round(total.herramientas + costo.herramientas), total: round(total.total + costo.total) };
  }, { horas: 0, laboral: 0, herramientas: 0, total: 0 });
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function coincideElectricista(empleado: Electricista, query: string) {
  const text = normalize(query);
  const dni = query.replace(/\D/g, '');
  return normalize(empleado.full_name).includes(text) || (dni.length > 0 && /^[-\d.\s]+$/.test(query) && (empleado.dni || '').replace(/\D/g, '').includes(dni));
}
export function validarTarea(tarea: ObraTarea) {
  if (!tarea.name.trim() || !tarea.fase_id) throw new Error('Completá el nombre y la fase.');
  const values = [tarea.progress, ...tarea.mano_obra.flatMap(r => [r.horas, r.valor_hora]), ...tarea.herramientas.flatMap(r => [r.cantidad, r.costo_unitario])];
  if (values.some(v => !Number.isFinite(v) || v < 0) || tarea.progress > 100) throw new Error('Ingresá horas, costos y avance válidos, sin valores negativos.');
  if (new Set(tarea.mano_obra.map(r => r.empleado_id)).size !== tarea.mano_obra.length || new Set(tarea.herramientas.map(r => r.herramienta_id)).size !== tarea.herramientas.length) throw new Error('Hay recursos duplicados.');
  if (tarea.herramientas.some(r => !r.concepto.trim() || r.cantidad <= 0)) throw new Error('Cada herramienta necesita un concepto y una cantidad mayor a cero.');
}
