import { useEffect, useState } from 'react';
import { Users, Wrench, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import ToolPhoto from '../ToolPhoto';
import type { ObraFase } from '../../types/coordinadores';
import type { Electricista, ManoObra, ObraTarea } from '../../types/obraCostos';
import { obraCostosService } from '../../services/coordinadores/obraCostosService';
import { coincideElectricista, costoTarea, costoTotal, money, tarifaLiquidacion } from '../../services/coordinadores/costosCalculator';

type Data = Awaited<ReturnType<typeof obraCostosService.load>>;
const selectClass = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function EmployeePhoto({ employee }: { employee: Electricista }) {
  const [failed, setFailed] = useState(false);
  return <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-blue-50 flex items-center justify-center text-blue-700">
    {employee.photo_url && !failed ? <img src={employee.photo_url} alt={employee.full_name} loading="lazy" className="w-full h-full object-cover" onError={() => setFailed(true)} /> : <span aria-label="Sin foto">{employee.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>}
  </div>;
}

export default function ObraRecursosCostos({ obraId, fases, coordinador }: { obraId: string; fases: ObraFase[]; coordinador?: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<ObraTarea | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [toolSearch, setToolSearch] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await obraCostosService.load(obraId);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los recursos.'); setData(null); }
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [obraId, revision]);

  const edit = (tarea: ObraTarea) => {
    setDraft(structuredClone(tarea)); setEmployeeSearch(''); setToolSearch(''); setFormError('');
  };
  const updateEmployee = (id: string, changes: Partial<ManoObra>) => {
    setDraft(prev => prev && ({ ...prev, mano_obra: prev.mano_obra.map(r => r.empleado_id === id ? { ...r, ...changes } : r) }));
  };
  const persist = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true); setFormError('');
    try {
      await obraCostosService.save(draft);
      setDraft(null); setNotice('Tarea y costos guardados.'); setRevision(r => r + 1);
    } catch (e) { setFormError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  };
  const remove = async (tarea: ObraTarea) => {
    if (!confirm(`¿Eliminar “${tarea.name}” y sus imputaciones de costos?`)) return;
    setSaving(true); setNotice('');
    try { await obraCostosService.remove(tarea.id); setRevision(r => r + 1); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'No se pudo eliminar.'); }
    finally { setSaving(false); }
  };

  if (loading) return <section className="bg-white rounded-2xl border p-6" aria-live="polite">Cargando electricistas, herramientas y costos…</section>;
  if (error || !data) return <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5 space-y-3"><p role="alert">{error}</p><Button variant="outline" onClick={() => setRevision(r => r + 1)}>Reintentar</Button></section>;

  const totals = costoTotal(data.tasks);
  const assignedEmployees = data.employees.filter(e => e.obra_id === obraId || data.tasks.some(t => t.mano_obra.some(r => r.empleado_id === e.id)));
  const assignedTools = data.tools.filter(h => h.current_obra_id === obraId || data.tasks.some(t => t.herramientas.some(r => r.herramienta_id === h.id)));
  const persistedPhases = fases.filter(f => f.obra_id === obraId && uuid.test(f.id));
  const employeeResults = data.employees.filter(e => coincideElectricista(e, employeeSearch) && !draft?.mano_obra.some(r => r.empleado_id === e.id));
  const toolResults = data.tools.filter(h => `${h.name} ${h.code}`.toLowerCase().includes(toolSearch.toLowerCase()) && !draft?.herramientas.some(r => r.herramienta_id === h.id));
  const missingRates = data.tasks.some(t => t.mano_obra.some(r => r.horas > 0 && Number(r.valor_hora) === 0) || t.herramientas.some(r => Number(r.costo_unitario) === 0));
  const groups = [...persistedPhases.map(f => ({ id: f.id, name: f.name })), ...(!persistedPhases.length || data.tasks.some(t => !persistedPhases.some(f => f.id === t.fase_id)) ? [{ id: '', name: 'Otras fases registradas' }] : [])];

  return <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-bold text-slate-900">Equipo, tareas y costos de obra</h3><p className="text-sm text-slate-500">Coordinador: {coordinador || 'Sin coordinador informado'}</p></div>
      <div className="flex gap-2"><Button variant="outline" aria-label="Actualizar recursos" onClick={() => setRevision(r => r + 1)}><RefreshCw className="w-4 h-4" /></Button><Button disabled={!persistedPhases.length || saving} onClick={() => edit({ id: crypto.randomUUID(), obra_id: obraId, fase_id: persistedPhases[0].id, name: '', progress: 0, mano_obra: [], herramientas: [] })}><Plus className="w-4 h-4 mr-1" />Nueva tarea</Button></div>
    </div>
    {notice && <p role="status" className="text-sm text-blue-800">{notice}</p>}
    {!persistedPhases.length && <p className="text-sm text-amber-800">Guardá una fase en el cronograma para crear tareas vinculadas a ella.</p>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[['Horas imputadas', `${totals.horas} h`], ['Mano de obra', money(totals.laboral)], ['Herramientas imputadas', money(totals.herramientas)], ['Costo total imputado', money(totals.total)]].map(([label, value]) => <div key={label} className="bg-slate-50 rounded-xl p-3 min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="font-bold text-lg break-words">{value}</p></div>)}
    </div>
    <p className="text-xs text-slate-500">Importes en ARS de las tareas cargadas. El costo incluye horas × tarifa y costos de herramientas imputados; no representa un precio de venta ni confirma pagos. Categoría y tarifa quedan guardadas con cada tarea.</p>
    {missingRates && <p className="text-sm text-amber-800" role="status">Costo incompleto: hay recursos con tarifa o costo en cero.</p>}

    <div className="grid lg:grid-cols-2 gap-6">
      <div><h4 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" />Electricistas asignados ({assignedEmployees.length})</h4><div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
        {assignedEmployees.map(e => <div key={e.id} className="flex items-center gap-2 border rounded-xl p-2"><EmployeePhoto employee={e} /><div className="min-w-0"><p className="text-sm font-medium break-words">{e.full_name}</p><p className="text-xs text-slate-500">{e.specialty || 'Sin categoría'} · DNI {e.dni || 'no disponible'}</p><p className="text-xs text-blue-700">{e.obra_id === obraId ? 'Asignado a la obra' : 'Asignado a tareas de esta obra'}</p></div></div>)}
      </div>{!assignedEmployees.length && <p className="text-sm text-slate-500">Todavía no hay electricistas asignados.</p>}</div>
      <div><h4 className="font-semibold mb-3 flex items-center gap-2"><Wrench className="w-4 h-4" />Herramientas ({assignedTools.length})</h4><div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
        {assignedTools.map(h => <div key={h.id} className="flex items-center gap-2 border rounded-xl p-2"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-50"><ToolPhoto id={h.id} name={h.name} className="w-full h-full object-cover" fallback={<Wrench className="w-5 h-5" />} /></div><div><p className="text-sm font-medium">{h.name}</p><p className="text-xs text-slate-500">{h.code}</p><p className="text-xs text-blue-700">{h.current_obra_id === obraId ? 'En la obra' : 'Imputada a tareas'}</p></div></div>)}
      </div>{!assignedTools.length && <p className="text-sm text-slate-500">Sin herramientas en esta obra.</p>}</div>
    </div>

    <div className="space-y-4">{!data.tasks.length && <p className="py-6 text-center text-slate-500">Creá la primera tarea para asignar electricistas y registrar costos.</p>}
      {groups.map(group => {
        const tasks = data.tasks.filter(t => group.id ? t.fase_id === group.id : !persistedPhases.some(f => f.id === t.fase_id));
        if (!tasks.length) return null;
        return <div key={group.id} className="border rounded-xl overflow-hidden"><div className="bg-blue-50 p-3 flex flex-wrap justify-between gap-2"><h4 className="font-semibold">{group.name}</h4><span className="font-bold">{money(costoTotal(tasks).total)}</span></div><div className="divide-y">{tasks.map(t => {
          const cost = costoTarea(t);
          return <div key={t.id} className="p-3 space-y-2"><div className="flex items-center justify-between gap-2"><div><p className="font-semibold">{t.name}</p><p className="text-xs text-slate-500">Avance {t.progress}% · {cost.horas} h · {t.mano_obra.length} electricistas</p></div><div className="flex"><Button size="sm" variant="ghost" aria-label={`Editar ${t.name}`} onClick={() => edit(t)} disabled={saving}><Pencil className="w-4 h-4" /></Button><Button size="sm" variant="ghost" aria-label={`Eliminar ${t.name}`} onClick={() => void remove(t)} disabled={saving}><Trash2 className="w-4 h-4 text-rose-600" /></Button></div></div>
            <div className="flex flex-wrap gap-2">{t.mano_obra.map(r => { const e = data.employees.find(e => e.id === r.empleado_id); return <span key={r.empleado_id} className="text-xs bg-slate-50 rounded-lg p-2">{e?.full_name || 'Electricista'} · {r.categoria || 'Sin categoría'} · {r.horas} h × {money(r.valor_hora)}{r.liquidacion_id ? ' · Liquidación' : ' · Tarifa imputada'}</span>; })}</div>
            <div className="text-xs text-slate-600 flex flex-wrap gap-x-5 gap-y-1"><span>Mano de obra: {money(cost.laboral)}</span><span>Herramientas: {money(cost.herramientas)}</span><strong>Total: {money(cost.total)}</strong></div>
          </div>;
        })}</div></div>;
      })}
    </div>

    <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}><DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{data.tasks.some(t => t.id === draft?.id) ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle><DialogDescription>Vinculá electricistas y herramientas y registrá el costo de esta tarea.</DialogDescription></DialogHeader>
      {draft && <form onSubmit={persist} className="space-y-5"><fieldset disabled={saving} className="space-y-5 min-w-0">
        <label className="block text-sm font-medium">Nombre de la tarea<Input required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm">Fase / etapa<select required className={selectClass} value={draft.fase_id} onChange={e => setDraft({ ...draft, fase_id: e.target.value })}>{persistedPhases.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label className="text-sm">Avance (%)<Input type="number" min="0" max="100" step="1" required value={draft.progress} onChange={e => setDraft({ ...draft, progress: e.target.valueAsNumber })} /></label></div>
        <div className="space-y-2"><h4 className="font-semibold">Electricistas</h4><Input aria-label="Buscar electricista por nombre o DNI" placeholder="Escribí nombre o DNI…" value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} />
          {employeeSearch.trim() && <div className="max-h-48 overflow-y-auto border rounded-lg" aria-label="Resultados de electricistas">{employeeResults.length ? employeeResults.map(e => <button key={e.id} type="button" className="w-full text-left p-2 hover:bg-blue-50 flex items-center gap-2 border-b" onClick={() => { setDraft({ ...draft, mano_obra: [...draft.mano_obra, { empleado_id: e.id, categoria: e.specialty || '', horas: 0, valor_hora: Number(e.valor_hora) || 0, liquidacion_id: null }] }); setEmployeeSearch(''); }}><EmployeePhoto employee={e} /><span className="text-sm">{e.full_name}<span className="block text-xs text-slate-500">DNI {e.dni || 'no disponible'} · {e.specialty || 'Sin categoría'}{e.obra_id === obraId ? ' · En esta obra' : ''}</span></span><Plus className="w-4 h-4 ml-auto" /></button>) : <p className="p-3 text-sm">Sin coincidencias disponibles. El DNI requiere acceso al legajo.</p>}</div>}
          {draft.mano_obra.map(r => { const employee = data.employees.find(e => e.id === r.empleado_id); const payroll = data.payroll.filter(p => p.empleado_id === r.empleado_id && tarifaLiquidacion(p) !== null); return <div key={r.empleado_id} className="rounded-xl border p-3 space-y-3"><div className="flex items-center justify-between"><span className="font-medium text-sm">{employee?.full_name || 'Electricista no disponible'}</span><Button type="button" variant="ghost" size="sm" aria-label={`Quitar ${employee?.full_name}`} onClick={() => setDraft({ ...draft, mano_obra: draft.mano_obra.filter(row => row.empleado_id !== r.empleado_id) })}>Quitar</Button></div>
            <label className="block text-xs">Origen de tarifa<select className={selectClass} value={r.liquidacion_id || ''} onChange={e => { const payroll = data.payroll.find(p => p.id === e.target.value); updateEmployee(r.empleado_id, { liquidacion_id: payroll?.id || null, valor_hora: payroll ? tarifaLiquidacion(payroll)! : Number(employee?.valor_hora) || 0 }); }}><option value="">Tarifa del empleado / manual</option>{payroll.map(p => <option key={p.id} value={p.id}>{p.fecha_desde} al {p.fecha_hasta} · {p.horas_trabajadas} h · {money(tarifaLiquidacion(p)!)} / h</option>)}</select></label>
            <div className="grid sm:grid-cols-3 gap-2"><label className="text-xs">Categoría<Input value={r.categoria} onChange={e => updateEmployee(r.empleado_id, { categoria: e.target.value })} /></label><label className="text-xs">Horas imputadas<Input type="number" required min="0" step="0.01" value={r.horas} onChange={e => updateEmployee(r.empleado_id, { horas: e.target.valueAsNumber })} /></label><label className="text-xs">Costo por hora (ARS)<Input type="number" required min="0" step="0.01" readOnly={!!r.liquidacion_id} value={r.valor_hora} onChange={e => updateEmployee(r.empleado_id, { valor_hora: e.target.valueAsNumber })} /></label></div>
            <p className="text-xs text-slate-500">{r.liquidacion_id ? 'Tarifa = (sueldo bruto + presentismo) ÷ horas liquidadas. Las horas disponibles se validan al guardar.' : 'Tarifa inicial del empleado. Completá la tarifa si falta y las horas efectivamente dedicadas a esta tarea.'}</p>
          </div>; })}
        </div>
        <div className="space-y-2"><h4 className="font-semibold">Herramientas y costo imputado</h4><Input aria-label="Buscar herramienta" placeholder="Buscar por nombre o código…" value={toolSearch} onChange={e => setToolSearch(e.target.value)} />
          {toolSearch.trim() && <div className="max-h-40 overflow-y-auto border rounded-lg">{toolResults.length ? toolResults.map(h => <button type="button" key={h.id} className="block w-full text-left p-2 text-sm hover:bg-blue-50" onClick={() => { setDraft({ ...draft, herramientas: [...draft.herramientas, { herramienta_id: h.id, concepto: 'Uso / amortización', cantidad: 1, costo_unitario: 0 }] }); setToolSearch(''); }}>{h.code} · {h.name}{h.current_obra_id === obraId ? ' · En esta obra' : ''}</button>) : <p className="p-3 text-sm">Sin herramientas coincidentes.</p>}</div>}
          {draft.herramientas.map((r, index) => { const tool = data.tools.find(h => h.id === r.herramienta_id); const update = (change: Partial<typeof r>) => setDraft({ ...draft, herramientas: draft.herramientas.map((row, i) => i === index ? { ...row, ...change } : row) }); return <div key={r.herramienta_id} className="border rounded-xl p-3 space-y-2"><div className="flex justify-between items-center"><span className="text-sm font-medium">{tool?.code} · {tool?.name}</span><Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, herramientas: draft.herramientas.filter(h => h.herramienta_id !== r.herramienta_id) })}>Quitar</Button></div><label className="block text-xs">Concepto y unidad (alquiler por día, uso por hora, compra…)<Input required value={r.concepto} onChange={e => update({ concepto: e.target.value })} /></label><div className="grid grid-cols-2 gap-2"><label className="text-xs">Cantidad de unidades<Input type="number" min="0.01" step="0.01" required value={r.cantidad} onChange={e => update({ cantidad: e.target.valueAsNumber })} /></label><label className="text-xs">Costo por unidad (ARS)<Input type="number" min="0" step="0.01" required value={r.costo_unitario} onChange={e => update({ costo_unitario: e.target.valueAsNumber })} /></label></div></div>; })}
          <p className="text-xs text-slate-500">Ingresá el gasto o la porción de inversión correspondiente a esta tarea. Asignar una herramienta no genera un gasto automáticamente ni modifica su ubicación.</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 font-semibold">Costo de la tarea: {money(costoTarea(draft).total)}</div>
        {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancelar</Button><Button type="submit">{saving ? 'Guardando…' : 'Guardar tarea'}</Button></div>
      </fieldset></form>}
    </DialogContent></Dialog>
  </section>;
}
