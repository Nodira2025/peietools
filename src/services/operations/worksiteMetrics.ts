import { getToolPriceInfo } from '../tools/toolPriceReference';
import type { OperationalTool } from '../../types/operations';

export const PROGRESS_KEY = 'peie_coordinadores_obra_estado_final_cache';
export function readLocalRecord(key: string): Record<string, unknown> {
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function progressFor(id: string, records: Record<string, unknown>) {
  const raw = records[id];
  const record = raw && typeof raw === 'object' ? raw as { avanceFinal?: unknown; esMuestra?: boolean } : undefined;
  const value = record?.avanceFinal;
  return { progressPercent: typeof value === 'number' && Number.isFinite(value) && !record?.esMuestra ? Math.max(0, Math.min(100, value)) : null };
}
export function toolValuation(tools: OperationalTool[]) {
  return tools.reduce((sum, tool) => {
    const price = getToolPriceInfo(tool);
    const valid = Number.isFinite(price.effectivePrice) && price.effectivePrice >= 0;
    return { totalToolValue: sum.totalToolValue + (valid ? price.effectivePrice : 0), estimatedToolCount: sum.estimatedToolCount + (!price.isCustom || !valid ? 1 : 0) };
  }, { totalToolValue: 0, estimatedToolCount: 0 });
}
const normalized = (text: unknown) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[,.-]/g, ' ').replace(/\s+/g, ' ').trim();
const rates: Record<string, number> = { electricista: 5000, oficial: 4800, 'medio oficial': 4400, ayudante: 4000, capataz: 6000, general: 4500 };
export interface Attendance { obra_id?: string | null; obra_nombre?: string | null; empleado_id?: string | null; empleado_nombre?: string | null; horas_trabajadas?: number | string | null }
interface Employee { id: string; full_name: string; valor_hora?: number | string | null; specialty?: string | null }
export function laborMetrics(obra: { id: string; name: string }, records: Attendance[], employees: Employee[], localRates: Record<string, unknown>) {
  const matches = records.filter(record => record.obra_id ? record.obra_id === obra.id : Boolean(record.obra_nombre) && normalized(record.obra_nombre) === normalized(obra.name));
  return matches.reduce((sum, record) => {
    const hours = Number(record.horas_trabajadas);
    if (!Number.isFinite(hours) || hours <= 0) return sum;
    const candidates = record.empleado_id ? employees.filter(e => e.id === record.empleado_id) : employees.filter(e => normalized(e.full_name) === normalized(record.empleado_nombre));
    const employee = candidates.length === 1 ? candidates[0] : undefined;
    const storedRate = employee ? Number(employee.valor_hora ?? localRates[employee.id]) : NaN;
    const known = Number.isFinite(storedRate) && storedRate >= 0;
    const rate = known ? storedRate : rates[normalized(employee?.specialty)] ?? 4500;
    return { totalLaborHours: sum.totalLaborHours + hours, totalLaborCost: sum.totalLaborCost + hours * rate, estimatedLaborHours: sum.estimatedLaborHours + (known ? 0 : hours), laborRecordCount: sum.laborRecordCount + 1 };
  }, { totalLaborHours: 0, totalLaborCost: 0, estimatedLaborHours: 0, laborRecordCount: 0 });
}
