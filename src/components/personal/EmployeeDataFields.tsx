import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { EmployeeFormState } from './employeeData';

interface EmployeeDataFieldsProps {
  form: EmployeeFormState;
  setForm: Dispatch<SetStateAction<EmployeeFormState>>;
  obras: { id: string; name: string; encargado_name?: string | null }[];
  prefix: 'profile' | 'add';
  canEdit: boolean;
  canEditBasic?: boolean;
}

export function EmployeeDataFields({ form, setForm, obras, prefix, canEdit, canEditBasic = canEdit }: EmployeeDataFieldsProps) {
  const updateField = <K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };
  const inputClass = 'rounded-xl border-slate-200 focus-visible:ring-blue-600 font-semibold text-slate-800 disabled:bg-slate-50 disabled:text-slate-600';
  const labelClass = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider';

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#031530]">Identificación</h3>
          <p className="text-[11px] text-slate-400 font-medium">Datos personales y documentación del trabajador.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${prefix}-name`} className={labelClass}>Nombre completo *</Label>
            <Input id={`${prefix}-name`} value={form.full_name} disabled={!canEditBasic} onChange={e => updateField('full_name', e.target.value)} className={inputClass} placeholder="Ej: Pérez, Juan Carlos" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-dni`} className={labelClass}>DNI</Label>
            <Input id={`${prefix}-dni`} value={form.dni} disabled={!canEdit} inputMode="numeric" onChange={e => updateField('dni', e.target.value)} className={inputClass} placeholder="Ej: 30123456" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-cuil`} className={labelClass}>CUIL</Label>
            <Input id={`${prefix}-cuil`} value={form.cuil} disabled={!canEdit} inputMode="numeric" onChange={e => updateField('cuil', e.target.value)} className={inputClass} placeholder="Ej: 20-30123456-7" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-birth-date`} className={labelClass}>Fecha de nacimiento</Label>
            <Input id={`${prefix}-birth-date`} type="date" max={new Date().toISOString().split('T')[0]} value={form.fecha_nacimiento} disabled={!canEdit} onChange={e => updateField('fecha_nacimiento', e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-nationality`} className={labelClass}>Nacionalidad</Label>
            <Input id={`${prefix}-nationality`} value={form.nacionalidad} disabled={!canEdit} onChange={e => updateField('nacionalidad', e.target.value)} className={inputClass} placeholder="Ej: Argentina" />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <div>
          <h3 className="text-sm font-extrabold text-[#031530]">Contacto y domicilio</h3>
          <p className="text-[11px] text-slate-400 font-medium">Medios de contacto y residencia actual.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-whatsapp`} className={labelClass}>WhatsApp / teléfono</Label>
            <Input id={`${prefix}-whatsapp`} value={form.whatsapp} disabled={!canEditBasic} inputMode="tel" onChange={e => updateField('whatsapp', e.target.value)} className={inputClass} placeholder="Ej: +54 9 381..." />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-secondary-phone`} className={labelClass}>Teléfono alternativo</Label>
            <Input id={`${prefix}-secondary-phone`} value={form.telefono_alternativo} disabled={!canEdit} inputMode="tel" onChange={e => updateField('telefono_alternativo', e.target.value)} className={inputClass} placeholder="Ej: 381 4000000" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${prefix}-email`} className={labelClass}>Correo electrónico</Label>
            <Input id={`${prefix}-email`} type="email" value={form.email} disabled={!canEdit} onChange={e => updateField('email', e.target.value)} className={inputClass} placeholder="nombre@correo.com" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${prefix}-address`} className={labelClass}>Domicilio</Label>
            <Input id={`${prefix}-address`} value={form.domicilio} disabled={!canEdit} onChange={e => updateField('domicilio', e.target.value)} className={inputClass} placeholder="Calle, número, piso o barrio" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-city`} className={labelClass}>Localidad</Label>
            <Input id={`${prefix}-city`} value={form.localidad} disabled={!canEdit} onChange={e => updateField('localidad', e.target.value)} className={inputClass} placeholder="Ej: San Miguel de Tucumán" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-province`} className={labelClass}>Provincia</Label>
            <Input id={`${prefix}-province`} value={form.provincia} disabled={!canEdit} onChange={e => updateField('provincia', e.target.value)} className={inputClass} placeholder="Ej: Tucumán" />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <div>
          <h3 className="text-sm font-extrabold text-[#031530]">Datos laborales</h3>
          <p className="text-[11px] text-slate-400 font-medium">Información de ingreso, puesto y asignación.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-employee-number`} className={labelClass}>N.º de legajo</Label>
            <Input id={`${prefix}-employee-number`} value={form.legajo} disabled={!canEdit} onChange={e => updateField('legajo', e.target.value)} className={inputClass} placeholder="Ej: PEIE-036" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-start-date`} className={labelClass}>Fecha de ingreso</Label>
            <Input id={`${prefix}-start-date`} type="date" value={form.fecha_ingreso} disabled={!canEdit} onChange={e => updateField('fecha_ingreso', e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-specialty`} className={labelClass}>Especialidad / puesto</Label>
            <Input id={`${prefix}-specialty`} value={form.specialty} disabled={!canEditBasic} onChange={e => updateField('specialty', e.target.value)} className={inputClass} placeholder="Ej: Electricista, Ayudante, Oficial" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-contract`} className={labelClass}>Tipo de contratación</Label>
            <Input id={`${prefix}-contract`} value={form.tipo_contrato} disabled={!canEdit} onChange={e => updateField('tipo_contrato', e.target.value)} className={inputClass} placeholder="Ej: Permanente, eventual" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className={labelClass}>Obra asignada</Label>
            <Select
              disabled={!canEditBasic}
              value={form.obra_id || '_none_'}
              onValueChange={(value: string) => {
                const obraId = value === '_none_' ? null : value;
                setForm(prev => ({ ...prev, obra_id: obraId, status: obraId ? 'Trabajando' : 'Libre' }));
              }}
            >
              <SelectTrigger className="rounded-xl border-slate-200 focus:ring-blue-600 font-semibold text-slate-800 bg-white disabled:bg-slate-50">
                <SelectValue placeholder="Sin asignar (Libre)" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 bg-white shadow-md">
                <SelectItem value="_none_" className="font-semibold text-slate-700">Sin asignar (Libre)</SelectItem>
                {obras.map(obra => (
                  <SelectItem key={obra.id} value={obra.id} className="font-semibold text-slate-700">
                    {obra.name} {obra.encargado_name ? `(${obra.encargado_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <div>
          <h3 className="text-sm font-extrabold text-[#031530]">Contacto de emergencia</h3>
          <p className="text-[11px] text-slate-400 font-medium">Persona a contactar ante una urgencia.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${prefix}-emergency-name`} className={labelClass}>Nombre y apellido</Label>
            <Input id={`${prefix}-emergency-name`} value={form.contacto_emergencia_nombre} disabled={!canEdit} onChange={e => updateField('contacto_emergencia_nombre', e.target.value)} className={inputClass} placeholder="Nombre completo" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-emergency-relation`} className={labelClass}>Vínculo</Label>
            <Input id={`${prefix}-emergency-relation`} value={form.contacto_emergencia_parentesco} disabled={!canEdit} onChange={e => updateField('contacto_emergencia_parentesco', e.target.value)} className={inputClass} placeholder="Ej: Madre, pareja" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-emergency-phone`} className={labelClass}>Teléfono</Label>
            <Input id={`${prefix}-emergency-phone`} value={form.contacto_emergencia_telefono} disabled={!canEdit} inputMode="tel" onChange={e => updateField('contacto_emergencia_telefono', e.target.value)} className={inputClass} placeholder="Ej: +54 9 381..." />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <div>
          <h3 className="text-sm font-extrabold text-[#031530]">Indumentaria y observaciones</h3>
          <p className="text-[11px] text-slate-400 font-medium">Talles para EPP y notas internas de trabajo.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-clothing-size`} className={labelClass}>Talle de ropa</Label>
            <Input id={`${prefix}-clothing-size`} value={form.talle_ropa} disabled={!canEdit} onChange={e => updateField('talle_ropa', e.target.value)} className={inputClass} placeholder="Ej: L / 44" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-shoe-size`} className={labelClass}>Talle de calzado</Label>
            <Input id={`${prefix}-shoe-size`} value={form.talle_calzado} disabled={!canEdit} inputMode="numeric" onChange={e => updateField('talle_calzado', e.target.value)} className={inputClass} placeholder="Ej: 42" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${prefix}-notes`} className={labelClass}>Observaciones laborales</Label>
            <Textarea id={`${prefix}-notes`} value={form.observaciones} disabled={!canEdit} onChange={e => updateField('observaciones', e.target.value)} className={`${inputClass} min-h-24 resize-y`} placeholder="Información interna relevante para la gestión del trabajador" />
          </div>
        </div>
      </section>
    </div>
  );
}
