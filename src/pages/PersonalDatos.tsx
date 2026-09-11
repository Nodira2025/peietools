import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, HardHat, Search, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmployeeDataFields } from '@/components/personal/EmployeeDataFields';
import {
  createEmptyEmployeeForm, mapPrivateData,
  buildPrivateDataPayload, validateEmployeeForm,
  type EmployeeFormState, type PrivateDataRecord,
} from '@/components/personal/employeeData';

interface EmployeeRow {
  id: string;
  full_name: string;
  specialty: string | null;
  whatsapp: string | null;
  obra_id: string | null;
  photo_url: string | null;
}
interface Worksite { id: string; name: string }
type LegajoRow = PrivateDataRecord & { empleado_id: string };
const fieldLabels: Record<keyof PrivateDataRecord, string> = {
  dni: 'DNI', cuil: 'CUIL', fecha_nacimiento: 'Nacimiento', nacionalidad: 'Nacionalidad',
  email: 'Correo electrónico', telefono_alternativo: 'Teléfono alternativo',
  domicilio: 'Domicilio', localidad: 'Localidad', provincia: 'Provincia', legajo: 'N.º de legajo',
  fecha_ingreso: 'Fecha de ingreso', tipo_contrato: 'Tipo de contratación',
  contacto_emergencia_nombre: 'Contacto de emergencia', contacto_emergencia_parentesco: 'Vínculo',
  contacto_emergencia_telefono: 'Teléfono de emergencia', talle_ropa: 'Talle de ropa',
  talle_calzado: 'Talle de calzado', observaciones: 'Observaciones laborales',
};

export default function PersonalDatos() {
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [legajos, setLegajos] = useState<Record<string, LegajoRow>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [privateError, setPrivateError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<EmployeeFormState>(() => createEmptyEmployeeForm());
  const [saving, setSaving] = useState(false);
  const canAccess = profile?.role === 'admin' || profile?.role === 'logistica';
  const employeeId = params.get('empleado') || '';
  const selected = employees.find(employee => employee.id === employeeId);
  const record = selected ? legajos[selected.id] : undefined;
  const [formSource, setFormSource] = useState({ selected, record });

  useEffect(() => {
    if (!canAccess) return;
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError('');
      setPrivateError('');
      try {
        const [employeeResult, worksResult, privateResult] = await Promise.all([
          supabase.from('empleados').select('id, full_name, specialty, whatsapp, obra_id, photo_url').order('full_name').returns<EmployeeRow[]>(),
          supabase.from('obras').select('id, name').order('name').returns<Worksite[]>(),
          supabase.from('empleados_legajos').select('*').returns<LegajoRow[]>(),
        ]);
        if (!active) return;
        if (employeeResult.error || worksResult.error) {
          setLoadError('No se pudo cargar el personal. Intentá nuevamente.');
          return;
        }
        setEmployees(employeeResult.data || []);
        setWorksites(worksResult.data || []);
        if (privateResult.error) {
          setLegajos({});
          setPrivateError('Los legajos todavía no están disponibles. Podés consultar la ficha básica; la edición y exportación de datos personales se habilitarán cuando se restablezca el acceso.');
        } else {
          setLegajos(Object.fromEntries((privateResult.data || []).map(row => [row.empleado_id, row])));
        }
      } catch {
        if (active) setLoadError('No se pudo conectar. Intentá nuevamente.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [canAccess, profile?.id, retry]);

  // Reset the draft when navigating to another worker or loading a new record.
  if (formSource.selected !== selected || formSource.record !== record) {
    setFormSource({ selected, record });
    setForm(selected ? {
      ...createEmptyEmployeeForm(),
      full_name: selected.full_name,
      specialty: selected.specialty || '',
      whatsapp: selected.whatsapp || '',
      obra_id: selected.obra_id,
      photo_url: selected.photo_url,
      status: selected.obra_id ? 'Trabajando' : 'Libre',
      ...mapPrivateData(record),
    } : createEmptyEmployeeForm());
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return employees.filter(employee => {
      const data = legajos[employee.id];
      return [employee.full_name, employee.specialty, data?.dni, data?.cuil, data?.legajo,
        worksites.find(worksite => worksite.id === employee.obra_id)?.name]
        .some(value => value?.toLocaleLowerCase('es').includes(query));
    });
  }, [employees, worksites, legajos, search]);

  async function save() {
    if (!canAccess || !selected || privateError || loading || saving) return;
    const error = validateEmployeeForm(form);
    if (error) { toast({ variant: 'destructive', title: 'Revisá los datos', description: error }); return; }
    setSaving(true);
    const payload = { empleado_id: selected.id, ...buildPrivateDataPayload(form) };
    try {
      const { error: saveError } = await supabase.from('empleados_legajos')
        .upsert(payload, { onConflict: 'empleado_id' }).select('empleado_id').single();
      if (saveError) {
        toast({ variant: 'destructive', title: 'No se pudo guardar', description: saveError.code === '23505'
          ? 'El DNI, CUIL o número de legajo ya pertenece a otro trabajador.'
          : 'No se guardaron los cambios. Revisá la conexión y el acceso al legajo.' });
        return;
      }
      setLegajos(previous => ({ ...previous, [payload.empleado_id]: payload }));
      toast({ title: 'Datos guardados', description: `Se actualizó el legajo de ${selected.full_name}.` });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo guardar', description: 'Revisá tu conexión e intentá nuevamente.' });
    } finally { setSaving(false); }
  }

  function exportData() {
    if (!canAccess || privateError || loading || !filtered.length) return;
    const rows = filtered.map(employee => ({
      'Nombre completo': employee.full_name,
      'Especialidad': employee.specialty || '',
      'WhatsApp / teléfono': employee.whatsapp || '',
      'Obra asignada': worksites.find(worksite => worksite.id === employee.obra_id)?.name || 'Sin asignar',
      ...Object.fromEntries(Object.entries(fieldLabels).map(([key, label]) => [label, legajos[employee.id]?.[key as keyof PrivateDataRecord] || ''])),
    }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(workbook, sheet, 'Personal Datos');
    XLSX.writeFile(workbook, `Personal_Datos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (!canAccess) return <div className="p-6 space-y-3">
    <h1 className="text-2xl font-bold text-slate-900">Personal Datos</h1>
    <p>Los legajos están disponibles para Administración y Logística.</p>
    <Button asChild variant="outline"><Link to="/personal">Volver a Personal</Link></Button>
  </div>;

  return <div className="space-y-5 pb-8">
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><h1 className="text-2xl font-extrabold text-[#031530]">Personal Datos</h1>
        <p className="text-sm text-slate-500">Legajos, documentación y datos de contacto de los trabajadores.</p></div>
      <div className="flex gap-2">
        <Button asChild variant="outline"><Link to="/personal">Ir a Personal</Link></Button>
        <Button variant="outline" onClick={exportData} disabled={loading || !!loadError || !!privateError || !filtered.length}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /><span>Exportar datos</span>
        </Button>
      </div>
    </div>
    {(loadError || privateError) && <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
      <p>{loadError || privateError}</p>
      <Button variant="outline" size="sm" className="mt-2" disabled={loading || saving} onClick={() => setRetry(value => value + 1)}>Reintentar</Button>
    </div>}
    {loading ? <p className="p-8 text-center text-slate-500">Cargando personal…</p> : !loadError && (
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
        <aside className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-4 border-b space-y-3">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input aria-label="Buscar trabajador" placeholder="Nombre, DNI, legajo u obra…" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div>
            <p className="text-xs text-slate-500">{filtered.length} trabajadores</p>
          </div>
          <div className="max-h-64 lg:max-h-[65vh] overflow-y-auto p-2 space-y-1">
            {filtered.map(employee => <button key={employee.id} type="button" disabled={saving} aria-pressed={employee.id === employeeId}
              onClick={() => setParams({ empleado: employee.id })}
              className={`w-full text-left rounded-xl p-3 flex items-center gap-3 disabled:opacity-50 ${employee.id === employeeId ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}>
              {employee.photo_url ? <img src={employee.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <HardHat className="w-10 h-10 p-2 rounded-full bg-slate-100 text-slate-500" />}
              <span className="min-w-0"><span className="block text-sm font-bold text-slate-800 truncate">{employee.full_name}</span>
                <span className="block text-xs text-slate-500">{legajos[employee.id]?.dni ? `DNI ${legajos[employee.id].dni}` : employee.specialty || 'Sin especialidad'}</span></span>
            </button>)}
            {!filtered.length && <p className="p-4 text-sm text-slate-500">No se encontraron trabajadores.</p>}
          </div>
        </aside>
        {selected ? <section className="rounded-2xl border bg-white overflow-hidden">
          <div className="bg-[#031530] p-5 text-white"><h2 className="font-bold text-lg">{selected.full_name}</h2>
            <p className="text-xs text-slate-300 mt-1">Completá los datos del legajo. Todos los campos adicionales son opcionales.</p></div>
          <div className="p-5 sm:p-6">
            <p className="mb-5 text-xs text-slate-500">Nombre, puesto, teléfono principal y obra se administran desde <Link className="text-blue-600 underline" to={`/personal?empId=${selected.id}`}>Personal</Link>.</p>
            <EmployeeDataFields form={form} setForm={setForm} obras={worksites} prefix="profile" canEdit={!privateError && !saving} canEditBasic={false} />
          </div>
          <div className="border-t bg-slate-50 p-4 flex justify-end">
            <Button onClick={save} disabled={saving || !!privateError} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="h-4 w-4 mr-2" /><span>{saving ? 'Guardando…' : 'Guardar datos'}</span>
            </Button>
          </div>
        </section> : <div className="rounded-2xl border border-dashed p-12 text-center text-slate-500">
          <HardHat className="mx-auto h-10 w-10 mb-3" />
          <h2 className="font-bold text-slate-700">Seleccioná un trabajador</h2>
          <p className="text-sm mt-1">Acá vas a poder consultar y completar su legajo.</p>
        </div>}
      </div>
    )}
  </div>;
}
