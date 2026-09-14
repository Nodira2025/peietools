import { supabase } from '../../lib/supabase';
import type { Electricista, LiquidacionCosto, ObraTarea, RecursoHerramienta } from '../../types/obraCostos';
import { validarTarea } from './costosCalculator';

// Paginar evita truncar silenciosamente directorios de más de 1.000 registros.
async function allRows<T>(table: string, columns: string, obraId?: string): Promise<T[]> {
  const result: T[] = [];
  for (let start = 0; ; start += 500) {
    let query = supabase.from(table).select(columns).order('id').range(start, start + 499);
    if (obraId) query = query.eq('obra_id', obraId);
    const { data, error } = await query;
    if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`);
    result.push(...(data as unknown as T[]));
    if (data.length < 500) return result;
  }
}
export const obraCostosService = {
  async load(obraId: string) {
    const [employees, tools, payroll, tasks] = await Promise.all([
      allRows<Electricista & { empleados_legajos: { dni: string | null } | { dni: string | null }[] | null }>('empleados', 'id,full_name,specialty,photo_url,obra_id,valor_hora,empleados_legajos(dni)'),
      allRows<RecursoHerramienta>('herramientas', 'id,name,code,current_obra_id'),
      allRows<LiquidacionCosto>('liquidaciones_sueldos', 'id,empleado_id,fecha_desde,fecha_hasta,horas_trabajadas,sueldo_bruto,bono_presentismo,estado'),
      allRows<ObraTarea>('obra_tareas', '*,mano_obra:obra_tarea_personal(*),herramientas:obra_tarea_herramientas(*)', obraId)
    ]);
    return {
      employees: employees.map(e => ({ ...e, dni: (Array.isArray(e.empleados_legajos) ? e.empleados_legajos[0] : e.empleados_legajos)?.dni || null })).sort((a, b) => a.full_name.localeCompare(b.full_name)),
      tools, payroll, tasks
    };
  },
  async save(tarea: ObraTarea) {
    validarTarea(tarea);
    const { error } = await supabase.rpc('guardar_obra_tarea', { tarea });
    if (error) throw new Error(error.message);
  },
  async remove(id: string) {
    const { error } = await supabase.from('obra_tareas').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
};
