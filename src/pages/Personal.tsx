import { useState, useEffect, useRef, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { HardHat, Search, Clock, Camera, Plus, Trash2, Check, FileImage, FileSpreadsheet, X } from 'lucide-react';

import { useAuthStore } from '../store/auth';
import { compressImage } from '../lib/imageUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';


interface EmployeePrivateData {
  dni: string;
  cuil: string;
  fecha_nacimiento: string;
  nacionalidad: string;
  email: string;
  telefono_alternativo: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  legajo: string;
  fecha_ingreso: string;
  tipo_contrato: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_parentesco: string;
  contacto_emergencia_telefono: string;
  talle_ropa: string;
  talle_calzado: string;
  observaciones: string;
}

interface EmployeeFormState extends EmployeePrivateData {
  full_name: string;
  specialty: string;
  whatsapp: string;
  status: 'Trabajando' | 'Libre';
  photo_url: string | null;
  obra_id: string | null;
}

interface Empleado extends EmployeePrivateData {
  id: string;
  full_name: string;
  obra_id: string | null;
  status: 'Trabajando' | 'Libre';
  specialty: string | null;
  photo_url: string | null;
  whatsapp: string | null;
  obras: { name: string; encargado_name: string | null } | null;
}

const createEmptyPrivateData = (): EmployeePrivateData => ({
  dni: '',
  cuil: '',
  fecha_nacimiento: '',
  nacionalidad: '',
  email: '',
  telefono_alternativo: '',
  domicilio: '',
  localidad: '',
  provincia: '',
  legajo: '',
  fecha_ingreso: '',
  tipo_contrato: '',
  contacto_emergencia_nombre: '',
  contacto_emergencia_parentesco: '',
  contacto_emergencia_telefono: '',
  talle_ropa: '',
  talle_calzado: '',
  observaciones: ''
});

const createEmptyEmployeeForm = (specialty = ''): EmployeeFormState => ({
  full_name: '',
  specialty,
  whatsapp: '',
  status: 'Libre',
  photo_url: null,
  obra_id: null,
  ...createEmptyPrivateData()
});

type PrivateDataRecord = Partial<Record<keyof EmployeePrivateData, string | null>>;

const mapPrivateData = (data?: PrivateDataRecord | null): EmployeePrivateData => ({
  dni: data?.dni || '',
  cuil: data?.cuil || '',
  fecha_nacimiento: data?.fecha_nacimiento || '',
  nacionalidad: data?.nacionalidad || '',
  email: data?.email || '',
  telefono_alternativo: data?.telefono_alternativo || '',
  domicilio: data?.domicilio || '',
  localidad: data?.localidad || '',
  provincia: data?.provincia || '',
  legajo: data?.legajo || '',
  fecha_ingreso: data?.fecha_ingreso || '',
  tipo_contrato: data?.tipo_contrato || '',
  contacto_emergencia_nombre: data?.contacto_emergencia_nombre || '',
  contacto_emergencia_parentesco: data?.contacto_emergencia_parentesco || '',
  contacto_emergencia_telefono: data?.contacto_emergencia_telefono || '',
  talle_ropa: data?.talle_ropa || '',
  talle_calzado: data?.talle_calzado || '',
  observaciones: data?.observaciones || ''
});

const nullableText = (value: string) => value.trim() || null;

const buildPrivateDataPayload = (form: EmployeeFormState) => {
  const dniDigits = form.dni.replace(/\D/g, '');
  const cuilDigits = form.cuil.replace(/\D/g, '');
  const formattedCuil = cuilDigits.length === 11
    ? `${cuilDigits.slice(0, 2)}-${cuilDigits.slice(2, 10)}-${cuilDigits.slice(10)}`
    : form.cuil.trim();

  return {
    dni: dniDigits || null,
    cuil: formattedCuil || null,
    fecha_nacimiento: form.fecha_nacimiento || null,
    nacionalidad: nullableText(form.nacionalidad),
    email: nullableText(form.email)?.toLowerCase() || null,
    telefono_alternativo: nullableText(form.telefono_alternativo),
    domicilio: nullableText(form.domicilio),
    localidad: nullableText(form.localidad),
    provincia: nullableText(form.provincia),
    legajo: nullableText(form.legajo),
    fecha_ingreso: form.fecha_ingreso || null,
    tipo_contrato: nullableText(form.tipo_contrato),
    contacto_emergencia_nombre: nullableText(form.contacto_emergencia_nombre),
    contacto_emergencia_parentesco: nullableText(form.contacto_emergencia_parentesco),
    contacto_emergencia_telefono: nullableText(form.contacto_emergencia_telefono),
    talle_ropa: nullableText(form.talle_ropa),
    talle_calzado: nullableText(form.talle_calzado),
    observaciones: nullableText(form.observaciones)
  };
};

const validateEmployeeForm = (form: EmployeeFormState) => {
  const dniLength = form.dni.replace(/\D/g, '').length;
  if (form.dni.trim() && (dniLength < 7 || dniLength > 8)) {
    return 'El DNI debe tener 7 u 8 números.';
  }

  const cuilLength = form.cuil.replace(/\D/g, '').length;
  if (form.cuil.trim() && cuilLength !== 11) {
    return 'El CUIL debe tener 11 números.';
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Ingresá un correo electrónico válido.';
  }

  return null;
};

interface EmployeeDataFieldsProps {
  form: EmployeeFormState;
  setForm: Dispatch<SetStateAction<EmployeeFormState>>;
  obras: { id: string; name: string; encargado_name?: string | null }[];
  prefix: 'profile' | 'add';
  canEdit: boolean;
}

function EmployeeDataFields({ form, setForm, obras, prefix, canEdit }: EmployeeDataFieldsProps) {
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
            <Input id={`${prefix}-name`} value={form.full_name} disabled={!canEdit} onChange={e => updateField('full_name', e.target.value)} className={inputClass} placeholder="Ej: Pérez, Juan Carlos" />
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
            <Input id={`${prefix}-whatsapp`} value={form.whatsapp} disabled={!canEdit} inputMode="tel" onChange={e => updateField('whatsapp', e.target.value)} className={inputClass} placeholder="Ej: +54 9 381..." />
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
            <Input id={`${prefix}-specialty`} value={form.specialty} disabled={!canEdit} onChange={e => updateField('specialty', e.target.value)} className={inputClass} placeholder="Ej: Electricista, Ayudante, Oficial" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-contract`} className={labelClass}>Tipo de contratación</Label>
            <Input id={`${prefix}-contract`} value={form.tipo_contrato} disabled={!canEdit} onChange={e => updateField('tipo_contrato', e.target.value)} className={inputClass} placeholder="Ej: Permanente, eventual" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className={labelClass}>Obra asignada</Label>
            <Select
              disabled={!canEdit}
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

interface TrasladoPendiente {
  id: string;
  empleados: { full_name: string };
  source_obra: { name: string } | null;
  status: string;
}

export default function Personal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [trasladosPendientes, setTrasladosPendientes] = useState<TrasladoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'staff' | 'history'>(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'history') return 'history';
    return 'staff';
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'history') {
      setActiveTab('history');
    } else {
      setActiveTab('staff');
    }
  }, [location.search]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [filterObra, setFilterObra] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  
  // Filtros de fecha para el historial
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [specificDate, setSpecificDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  // Opciones para filtros
  const [obrasOpciones, setObrasOpciones] = useState<{id: string, name: string}[]>([]);
  const [specialtiesOpciones, setSpecialtiesOpciones] = useState<{value: string, label: string}[]>([]);

  // Camera file upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  // Full-size photo lightbox state
  const [fullSizePhoto, setFullSizePhoto] = useState<{ url: string; name: string; specialty?: string; obra?: string } | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'logistica';


  // Profile modal state
  const [selectedEmpForProfile, setSelectedEmpForProfile] = useState<Empleado | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<EmployeeFormState>(() => createEmptyEmployeeForm());
  const [profileUpdating, setProfileUpdating] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  // Add employee modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<EmployeeFormState>(() => createEmptyEmployeeForm('Electricista'));
  const [addSaving, setAddSaving] = useState(false);

  // Image & Excel export state
  const imageExportRef = useRef<HTMLDivElement>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);

  // Quick Assign Obra Modal state
  const [empToAssign, setEmpToAssign] = useState<Empleado | null>(null);
  const [assignTargetObraId, setAssignTargetObraId] = useState<string>('');
  const [assignSaving, setAssignSaving] = useState(false);



  const handleOpenProfile = (emp: Empleado) => {
    setSelectedEmpForProfile(emp);
    setProfileForm({
      full_name: emp.full_name,
      specialty: emp.specialty || '',
      whatsapp: emp.whatsapp || '',
      status: emp.status === 'Libre' ? 'Libre' : 'Trabajando',
      photo_url: emp.photo_url,
      obra_id: emp.obra_id || null,
      ...mapPrivateData(emp)
    });
    setIsProfileOpen(true);
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setProfileForm(prev => ({ ...prev, photo_url: compressed }));
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedEmpForProfile || !profileForm.full_name.trim() || !profile || !isAdmin) return;
    const validationError = validateEmployeeForm(profileForm);
    if (validationError) {
      toast({ variant: 'destructive', title: 'Revisá los datos', description: validationError });
      return;
    }

    setProfileUpdating(true);
    try {
      const computedStatus = profileForm.obra_id ? 'Trabajando' : 'Libre';

      const { error: employeeError } = await supabase
        .from('empleados')
        .update({
          full_name: profileForm.full_name.trim(),
          specialty: profileForm.specialty.trim() || 'Electricista',
          whatsapp: profileForm.whatsapp.trim() || null,
          status: computedStatus,
          photo_url: profileForm.photo_url,
          obra_id: profileForm.obra_id || null
        })
        .eq('id', selectedEmpForProfile.id);

      if (employeeError) throw employeeError;

      const { error: privateDataError } = await supabase
        .from('empleados_legajos')
        .upsert({
          empleado_id: selectedEmpForProfile.id,
          ...buildPrivateDataPayload(profileForm),
          updated_at: new Date().toISOString()
        }, { onConflict: 'empleado_id' });

      if (privateDataError) throw privateDataError;

      // Log transfer if obra changed
      if (selectedEmpForProfile.obra_id !== profileForm.obra_id && profileForm.obra_id) {
        const { error: transferError } = await supabase
          .from('traslados_personal')
          .insert([{
            empleado_id: selectedEmpForProfile.id,
            source_obra_id: selectedEmpForProfile.obra_id || null,
            target_obra_id: profileForm.obra_id,
            requester_id: profile.id,
            status: 'Confirmado',
            confirmed_by: profile.id,
            confirmed_at: new Date().toISOString()
          }]);
        if (transferError) {
          console.error('Error logging transfer:', transferError);
        }
      }

      toast({ title: 'Legajo actualizado', description: 'Los datos personales y laborales fueron guardados.' });
      setIsProfileOpen(false);
      fetchData();
    } catch (err: any) {
      const isDuplicate = err?.code === '23505';
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: isDuplicate ? 'El DNI, CUIL o número de legajo ya está registrado en otro trabajador.' : (err?.message || 'No se pudo actualizar el legajo.')
      });
    } finally {
      setProfileUpdating(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!addForm.full_name.trim() || !isAdmin) return;
    const validationError = validateEmployeeForm(addForm);
    if (validationError) {
      toast({ variant: 'destructive', title: 'Revisá los datos', description: validationError });
      return;
    }

    setAddSaving(true);
    try {
      const payload = {
        full_name: addForm.full_name.trim(),
        specialty: addForm.specialty.trim() || 'Electricista',
        whatsapp: addForm.whatsapp.trim() || null,
        obra_id: addForm.obra_id || null,
        status: (addForm.obra_id ? 'Trabajando' : 'Libre') as 'Trabajando' | 'Libre',
        active: true
      };

      const { data: createdEmployee, error } = await supabase
        .from('empleados')
        .insert([payload])
        .select('id')
        .single();

      if (error) {
        toast({ variant: 'destructive', title: 'Error al agregar', description: error.message });
      } else {
        const { error: privateDataError } = await supabase
          .from('empleados_legajos')
          .insert({
            empleado_id: createdEmployee.id,
            ...buildPrivateDataPayload(addForm)
          });

        if (privateDataError) {
          await supabase.from('empleados').delete().eq('id', createdEmployee.id);
          throw privateDataError;
        }

        toast({ title: 'Operario agregado', description: `${payload.full_name} fue registrado con éxito.` });
        setIsAddOpen(false);
        setAddForm(createEmptyEmployeeForm('Electricista'));
        fetchData();
      }
    } catch (err: any) {
      const isDuplicate = err?.code === '23505';
      toast({
        variant: 'destructive',
        title: 'No se pudo registrar',
        description: isDuplicate ? 'El DNI, CUIL o número de legajo ya está registrado.' : (err?.message || 'No se pudo registrar al operario.')
      });
    } finally {
      setAddSaving(false);
    }
  };

  const handleConfirmAssign = async () => {
    if (!empToAssign || !assignTargetObraId || !profile) return;
    setAssignSaving(true);
    try {
      const targetObra = obrasOpciones.find(o => o.id === assignTargetObraId);
      const now = new Date().toISOString();

      const { error: empError } = await supabase
        .from('empleados')
        .update({
          obra_id: assignTargetObraId,
          status: 'Trabajando',
          updated_at: now
        })
        .eq('id', empToAssign.id);

      if (empError) throw empError;

      await supabase.from('traslados_personal').insert([{
        empleado_id: empToAssign.id,
        source_obra_id: empToAssign.obra_id || null,
        target_obra_id: assignTargetObraId,
        requester_id: profile.id,
        status: 'Confirmado',
        confirmed_by: profile.id,
        confirmed_at: now
      }]);

      toast({
        title: 'Operario Asignado',
        description: `${empToAssign.full_name} fue asignado a ${targetObra?.name || 'la obra'} con éxito.`
      });

      setEmpToAssign(null);
      setAssignTargetObraId('');
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al asignar', description: err.message });
    } finally {
      setAssignSaving(false);
    }
  };


  const handleDeleteEmployee = async () => {
    if (!selectedEmpForProfile) return;
    const confirmDelete = window.confirm(`¿Estás seguro de que querés eliminar a ${selectedEmpForProfile.full_name}? Esta acción no se puede deshacer.`);
    if (!confirmDelete) return;

    setProfileUpdating(true);
    try {
      const { error } = await supabase
        .from('empleados')
        .delete()
        .eq('id', selectedEmpForProfile.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message });
      } else {
        toast({ title: 'Empleado eliminado', description: 'El operario fue removido del sistema.' });
        setIsProfileOpen(false);
        fetchData();
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar al empleado.' });
    } finally {
      setProfileUpdating(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    
    // Fetch Empleados
    const fullEmployeeResponse = await supabase
      .from('empleados')
      .select(`
        id, full_name, obra_id, status, specialty, photo_url, whatsapp,
        obras:obra_id(name, encargado_name),
        datos_personales:empleados_legajos(
          dni, cuil, fecha_nacimiento, nacionalidad, email, telefono_alternativo,
          domicilio, localidad, provincia, legajo, fecha_ingreso, tipo_contrato,
          contacto_emergencia_nombre, contacto_emergencia_parentesco,
          contacto_emergencia_telefono, talle_ropa, talle_calzado, observaciones
        )
      `)
      .order('full_name');
    let empData = fullEmployeeResponse.data;
    let empError = fullEmployeeResponse.error;

    // Permite desplegar primero la interfaz sin dejar fuera de servicio la nómina
    // mientras la migración de legajos todavía no fue aplicada en Supabase.
    if (empError) {
      console.warn('No se pudo cargar la relación de legajos; reintentando datos básicos:', empError.message);
      const basicEmployeeResponse = await supabase
        .from('empleados')
        .select('id, full_name, obra_id, status, specialty, photo_url, whatsapp, obras:obra_id(name, encargado_name)')
        .order('full_name');
      empData = basicEmployeeResponse.data;
      empError = basicEmployeeResponse.error;
    }
      
    if (empError) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el personal' });
    } else {
      const dataWithDefaults = (empData || []).map((e: any) => {
        const privateData = Array.isArray(e.datos_personales) ? e.datos_personales[0] : e.datos_personales;
        return {
          id: e.id,
          full_name: e.full_name,
          obra_id: e.obra_id,
          status: e.status ? (e.status === 'Disponible' || e.status === 'Libre' ? 'Libre' : 'Trabajando') : (e.obra_id ? 'Trabajando' : 'Libre'),
          specialty: e.specialty || 'Electricista',
          photo_url: e.photo_url,
          whatsapp: e.whatsapp || null,
          obras: Array.isArray(e.obras) ? e.obras[0] : e.obras,
          ...mapPrivateData(privateData)
        };
      });
      setEmpleados(dataWithDefaults as Empleado[]);
      
      const uniqueSpecs = [...new Set(dataWithDefaults.map(e => e.specialty))].sort();
      setSpecialtiesOpciones(uniqueSpecs.map(s => ({ value: s, label: s })));
    }

    // Fetch Traslados Pendientes donde la obra destino es la del usuario
    if (profile.obra_id) {
      const { data: trasData } = await supabase
        .from('traslados_personal')
        .select('id, status, empleados(full_name), source_obra:obras!traslados_personal_source_obra_id_fkey(name)')
        .eq('target_obra_id', profile.obra_id)
        .eq('status', 'Pendiente');
      
      const mappedTrasData = (trasData || []).map((t: any) => ({
        id: t.id,
        status: t.status,
        empleados: Array.isArray(t.empleados) ? t.empleados[0] : t.empleados,
        source_obra: Array.isArray(t.source_obra) ? t.source_obra[0] : t.source_obra
      }));
      setTrasladosPendientes(mappedTrasData as TrasladoPendiente[]);
    }

    // Fetch Historial de movimientos
    let query = supabase
      .from('traslados_personal')
      .select(`
        id, status, created_at,
        empleados(full_name),
        source_obra:obras!traslados_personal_source_obra_id_fkey(name),
        target_obra:obras!traslados_personal_target_obra_id_fkey(name)
      `)
      .order('created_at', { ascending: false });
      
    if (!isAdmin && profile.obra_id) {
      query = query.or(`source_obra_id.eq.${profile.obra_id},target_obra_id.eq.${profile.obra_id}`);
    }
    const { data: histData } = await query;
    if (histData) {
      const mappedHistData = histData.map((h: any) => ({
        id: h.id,
        status: h.status,
        created_at: h.created_at,
        empleados: Array.isArray(h.empleados) ? h.empleados[0] : h.empleados,
        source_obra: Array.isArray(h.source_obra) ? h.source_obra[0] : h.source_obra,
        target_obra: Array.isArray(h.target_obra) ? h.target_obra[0] : h.target_obra
      }));
      setHistorial(mappedHistData);
    }

    // Fetch Filter Options
    const { data: obrasData } = await supabase.from('obras').select('id, name, encargado_name').eq('active', true);
    if (obrasData) {
      setObrasOpciones(obrasData.map(o => ({ id: o.id, name: o.name })));
    }

    setLoading(false);

    // Auto-open profile if empId is present in URL query params
    const searchParams = new URLSearchParams(window.location.search);
    const empIdParam = searchParams.get('empId');
    if (empIdParam && empData) {
      const emp = empData.find((e: any) => e.id === empIdParam);
      if (emp) {
        const empMapped = {
          id: emp.id,
          full_name: emp.full_name,
          obra_id: emp.obra_id,
          status: emp.status ? (emp.status === 'Disponible' || emp.status === 'Libre' ? 'Libre' : 'Trabajando') : (emp.obra_id ? 'Trabajando' : 'Libre'),
          specialty: emp.specialty || 'Electricista',
          photo_url: emp.photo_url,
          whatsapp: emp.whatsapp || null,
          obras: Array.isArray(emp.obras) ? emp.obras[0] : emp.obras,
          ...mapPrivateData(Array.isArray(emp.datos_personales) ? emp.datos_personales[0] : emp.datos_personales)
        };
        handleOpenProfile(empMapped as Empleado);
      }
    }
  };

  // const handleRelease = async (id: string) => {
  //   if (!window.confirm('¿Liberar a este empleado? Quedará sin obra asignada.')) return;
  //   const { error } = await supabase
  //     .from('empleados')
  //     .update({ 
  //       obra_id: null,
  //       status: 'Disponible'
  //     })
  //     .eq('id', id);
  // 
  //   if (error) {
  //     toast({ variant: 'destructive', title: 'Error', description: error.message });
  //   } else {
  //     toast({ title: 'Empleado Liberado', description: 'Ahora se encuentra en estado Disponible.' });
  //     fetchData();
  //   }
  // };

  const filteredEmpleados = empleados.filter(e => {
    const normalizedSearch = search.toLowerCase().trim();
    const matchesSearch = !search || 
      e.full_name.toLowerCase().includes(normalizedSearch) ||
      (e.obras?.name || '').toLowerCase().includes(normalizedSearch) ||
      (e.specialty || '').toLowerCase().includes(normalizedSearch) ||
      e.dni.toLowerCase().includes(normalizedSearch) ||
      e.cuil.toLowerCase().includes(normalizedSearch) ||
      e.legajo.toLowerCase().includes(normalizedSearch) ||
      e.email.toLowerCase().includes(normalizedSearch) ||
      e.localidad.toLowerCase().includes(normalizedSearch);
    
    const matchesObra = !filterObra || e.obra_id === filterObra;
    const matchesSpecialty = !filterSpecialty || e.specialty === filterSpecialty;
    
    let matchesStatus = true;
    if (filterType === 'free') {
      matchesStatus = e.status === 'Libre' || !e.obra_id;
    } else if (filterType === 'busy') {
      matchesStatus = e.status === 'Trabajando' || !!e.obra_id;
    }
    
    return matchesSearch && matchesObra && matchesSpecialty && matchesStatus;
  });

  // Tema de colores para las distintas obras (basado en la planilla del cliente)
  const getObraTheme = (name: string) => {
    const cleanName = name.toLowerCase();
    if (cleanName.includes('libre') || cleanName.includes('disponible') || cleanName.includes('sin asignar')) {
      return {
        border: 'border-l-green-500 border-l-4',
        bg: 'bg-green-50/50 border-green-100',
        badge: 'bg-green-100 text-green-800 border-green-200'
      };
    }
    if (cleanName.includes('#300') || cleanName.includes('link')) {
      return {
        border: 'border-l-amber-500 border-l-4',
        bg: 'bg-amber-50/30 border-amber-100',
        badge: 'bg-amber-100 text-amber-800 border-amber-200'
      };
    }
    if (cleanName.includes('aeropuerto')) {
      return {
        border: 'border-l-fuchsia-500 border-l-4',
        bg: 'bg-fuchsia-50/30 border-fuchsia-100',
        badge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
      };
    }
    if (cleanName.includes('bamboo') || cleanName.includes('anzorena')) {
      return {
        border: 'border-l-emerald-500 border-l-4',
        bg: 'bg-emerald-50/30 border-emerald-100',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      };
    }
    if (cleanName.includes('ausente') || cleanName.includes('lic. medica') || cleanName.includes('médica')) {
      return {
        border: 'border-l-orange-500 border-l-4',
        bg: 'bg-orange-50/30 border-orange-100',
        badge: 'bg-orange-100 text-orange-800 border-orange-200'
      };
    }
    if (cleanName.includes('cantares')) {
      return {
        border: 'border-l-pink-500 border-l-4',
        bg: 'bg-pink-50/30 border-pink-100',
        badge: 'bg-pink-100 text-pink-800 border-pink-200'
      };
    }
    if (cleanName.includes('clínica') || cleanName.includes('clinica') || cleanName.includes('mayo')) {
      return {
        border: 'border-l-yellow-500 border-l-4',
        bg: 'bg-yellow-50/30 border-yellow-100',
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      };
    }
    if (cleanName.includes('domus')) {
      return {
        border: 'border-l-sky-500 border-l-4',
        bg: 'bg-sky-50/30 border-sky-100',
        badge: 'bg-sky-100 text-sky-800 border-sky-200'
      };
    }
    if (cleanName.includes('duo') || cleanName.includes('dúo')) {
      return {
        border: 'border-l-indigo-500 border-l-4',
        bg: 'bg-indigo-50/30 border-indigo-100',
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-200'
      };
    }
    if (cleanName.includes('losa')) {
      return {
        border: 'border-l-rose-500 border-l-4',
        bg: 'bg-rose-50/30 border-rose-100',
        badge: 'bg-rose-100 text-rose-800 border-rose-200'
      };
    }
    if (cleanName.includes('oasis')) {
      return {
        border: 'border-l-teal-500 border-l-4',
        bg: 'bg-teal-50/30 border-teal-100',
        badge: 'bg-teal-100 text-teal-800 border-teal-200'
      };
    }
    // Default fallback
    return {
      border: 'border-l-slate-400 border-l-4',
      bg: 'bg-slate-50/30 border-slate-100',
      badge: 'bg-slate-100 text-slate-800 border-slate-200'
    };
  };

  // Agrupamiento por Obra
  const groupedByObra: Record<string, { name: string; encargado_name?: string | null; id?: string; list: Empleado[] }> = {};

  filteredEmpleados.forEach((emp) => {
    const isLibre = emp.status === 'Libre' || !emp.obra_id;
    const obraKey = isLibre ? 'Sin Asignar' : (emp.obra_id || 'Sin Asignar');

    if (!groupedByObra[obraKey]) {
      groupedByObra[obraKey] = {
        id: isLibre ? undefined : emp.obra_id || undefined,
        name: isLibre ? 'Operarios Libres' : (emp.obras?.name || 'Obra Desconocida'),
        encargado_name: isLibre ? null : (emp.obras?.encargado_name || null),
        list: []
      };
    }
    groupedByObra[obraKey].list.push(emp);
  });

  const sortedObraKeys = Object.keys(groupedByObra).sort((a, b) => {
    if (a === 'Sin Asignar') return -1;
    if (b === 'Sin Asignar') return 1;
    return groupedByObra[a].name.localeCompare(groupedByObra[b].name);
  });

  // Dividir obras con y sin personal
  const { obrasConPersonal, obrasSinPersonal } = useMemo(() => {
    const con = obrasOpciones.filter(o => empleados.some(e => e.obra_id === o.id));
    const sin = obrasOpciones.filter(o => !empleados.some(e => e.obra_id === o.id));
    return { obrasConPersonal: con, obrasSinPersonal: sin };
  }, [obrasOpciones, empleados]);

  // Filtrado de historial por rangos de fecha
  const filteredHistorial = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Inicio de la semana (Lunes)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    
    // Inicio del mes
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return historial.filter(h => {
      const createdDate = new Date(h.created_at);
      
      switch (dateFilter) {
        case 'today':
          return createdDate >= startOfToday;
        case 'week':
          return createdDate >= startOfWeek;
        case 'month':
          return createdDate >= startOfMonth;
        case 'custom':
          if (!specificDate) return true;
          const targetDate = new Date(specificDate + 'T00:00:00'); // Evita desfases de huso horario
          return (
            createdDate.getFullYear() === targetDate.getFullYear() &&
            createdDate.getMonth() === targetDate.getMonth() &&
            createdDate.getDate() === targetDate.getDate()
          );
        case 'all':
        default:
          return true;
      }
    });
  }, [historial, dateFilter, specificDate]);

  const exportToExcel = () => {
    if (filteredEmpleados.length === 0) {
      toast({ variant: 'destructive', title: 'Sin datos', description: 'No hay personal filtrado para exportar.' });
      return;
    }

    // Agrupar por Obra Asignada
    const groupedMap = new Map<string, Empleado[]>();
    filteredEmpleados.forEach((emp) => {
      const obraName = emp.obras?.name || (emp.status === 'Trabajando' ? 'Obra Sin Nombre' : 'AUSENTES / LIC. MEDICA');
      if (!groupedMap.has(obraName)) {
        groupedMap.set(obraName, []);
      }
      groupedMap.get(obraName)!.push(emp);
    });

    const sortedObraNames = Array.from(groupedMap.keys()).sort((a, b) => a.localeCompare(b));

    const excelRows: any[] = [];
    const merges: any[] = [];
    let currentIndex = 1;
    let currentExcelRow = 1; // Fila 1 es el primer registro (Fila 0 es el encabezado)

    sortedObraNames.forEach((obraName) => {
      const empList = groupedMap.get(obraName)!;
      empList.sort((a, b) => a.full_name.localeCompare(b.full_name));

      const startRowIndex = currentExcelRow;
      const count = empList.length;

      empList.forEach((emp, empIdx) => {
        excelRows.push({
          '#': currentIndex,
          'Nombre Completo': emp.full_name,
          'Obra Asignada': empIdx === 0 ? obraName : '',
          'Cantidad': empIdx === 0 ? count : ''
        });
        currentIndex++;
        currentExcelRow++;
      });

      if (count >= 1) {
        // Combinar celda de Obra Asignada (Columna 2 / índice C)
        merges.push({ s: { r: startRowIndex, c: 2 }, e: { r: startRowIndex + count - 1, c: 2 } });
        // Combinar celda de Cantidad (Columna 3 / índice D)
        merges.push({ s: { r: startRowIndex, c: 3 }, e: { r: startRowIndex + count - 1, c: 3 } });
      }
    });

    // Fila final de TOTAL PERSONAL
    const totalRowIndex = currentExcelRow;
    excelRows.push({
      '#': '',
      'Nombre Completo': 'TOTAL PERSONAL EN OBRAS',
      'Obra Asignada': '',
      'Cantidad': filteredEmpleados.length
    });
    // Combinar celdas de título del Total (#, Nombre Completo, Obra Asignada)
    merges.push({ s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 2 } });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    worksheet['!merges'] = merges;
    worksheet['!cols'] = [{ wch: 8 }, { wch: 42 }, { wch: 34 }, { wch: 18 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Matriz Personal");

    if (isAdmin) {
      const legajoRows = filteredEmpleados
        .slice()
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(emp => ({
          'Nombre completo': emp.full_name,
          'DNI': emp.dni,
          'CUIL': emp.cuil,
          'Nacimiento': emp.fecha_nacimiento,
          'Nacionalidad': emp.nacionalidad,
          'N.º legajo': emp.legajo,
          'Fecha de ingreso': emp.fecha_ingreso,
          'Especialidad / puesto': emp.specialty || '',
          'Tipo de contratación': emp.tipo_contrato,
          'Obra asignada': emp.obras?.name || 'Sin asignar',
          'WhatsApp / teléfono': emp.whatsapp || '',
          'Teléfono alternativo': emp.telefono_alternativo,
          'Correo electrónico': emp.email,
          'Domicilio': emp.domicilio,
          'Localidad': emp.localidad,
          'Provincia': emp.provincia,
          'Contacto de emergencia': emp.contacto_emergencia_nombre,
          'Vínculo': emp.contacto_emergencia_parentesco,
          'Teléfono de emergencia': emp.contacto_emergencia_telefono,
          'Talle de ropa': emp.talle_ropa,
          'Talle de calzado': emp.talle_calzado,
          'Observaciones laborales': emp.observaciones
        }));
      const legajosWorksheet = XLSX.utils.json_to_sheet(legajoRows);
      legajosWorksheet['!cols'] = Object.keys(legajoRows[0] || {}).map(key => ({
        wch: Math.min(Math.max(key.length + 2, 16), 36)
      }));
      XLSX.utils.book_append_sheet(workbook, legajosWorksheet, 'Legajos');
    }

    XLSX.writeFile(workbook, `Reporte_Personal_Matriz_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: '¡Excel generado!', description: isAdmin ? 'Incluye la matriz por obra y una hoja con los legajos.' : 'Listado de personal exportado por obras.' });
  };


  const exportToImage = async () => {
    if (!imageExportRef.current) return;
    if (filteredEmpleados.length === 0) {
      toast({ variant: 'destructive', title: 'Sin datos', description: 'No hay personal filtrado para exportar.' });
      return;
    }

    setIsExportingImage(true);
    try {
      const canvas = await html2canvas(imageExportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector('[data-export-container="personal-matrix"]');
          if (el) {
            (el as HTMLElement).style.position = 'static';
            (el as HTMLElement).style.top = '0';
            (el as HTMLElement).style.left = '0';
            (el as HTMLElement).style.overflow = 'visible';
            (el as HTMLElement).style.width = 'auto';
            (el as HTMLElement).style.height = 'auto';
          }
        }
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Distribucion_Personal_Por_Obra_${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      toast({ title: '¡Imagen Generada!', description: 'Se descargó la distribución de personal con celdas de obra perfectamente unificadas.' });
    } catch (e: any) {
      console.error('Error al exportar imagen:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar la imagen.' });
    } finally {
      setIsExportingImage(false);
    }
  };



  return (
    <div className="space-y-5 pb-safe">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Personal</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión y traslado de electricistas</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <Button 
            variant={activeTab === 'staff' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('staff')}
            className={`rounded-lg text-xs h-8 ${activeTab === 'staff' ? 'bg-white shadow-sm text-peie-blue' : 'text-slate-500'}`}
          >
            Equipo
          </Button>
          <Button 
            variant={activeTab === 'history' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('history')}
            className={`rounded-lg text-xs h-8 ${activeTab === 'history' ? 'bg-white shadow-sm text-peie-blue' : 'text-slate-500'}`}
          >
            Movimientos
          </Button>
        </div>
      </div>

      {/* Alerta de traslados pendientes */}
      {trasladosPendientes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-orange-700 font-bold">
            <Clock className="h-5 w-5" />
            <h3>Traslados Entrantes Pendientes ({trasladosPendientes.length})</h3>
          </div>
          <div className="space-y-2">
            {trasladosPendientes.map(t => (
              <div key={t.id} className="bg-white rounded-lg p-3 flex justify-between items-center shadow-sm border border-orange-100">
                <div>
                  <p className="text-sm font-bold text-slate-800">{t.empleados?.full_name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    Desde: {t.source_obra?.name || 'Desconocida'}
                  </p>
                </div>
                <Button 
                  onClick={() => navigate(`/personal/traslados/${t.id}`, { state: { from: '/personal' } })}
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Confirmar Recepción
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-peie-blue" />
          <Input
            placeholder="Buscar por nombre, DNI, legajo u obra..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl border-slate-200 shadow-sm"
          />
        </div>

        {/* Control de Segmentos */}
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
          {[
            { value: 'all', label: `Todos ${empleados.length}` },
            { value: 'free', label: `Libres ${empleados.filter(e => e.status === 'Libre' || !e.obra_id).length}` },
            { value: 'busy', label: `En Obra ${empleados.filter(e => e.status === 'Trabajando' || e.obra_id).length}` }
          ].map(opt => (
            <Button 
              key={opt.value}
              variant={filterType === opt.value ? 'default' : 'ghost'} 
              onClick={() => setFilterType(opt.value)}
              className={`flex-1 min-w-[70px] rounded-lg text-xs h-9 ${
                filterType === opt.value 
                  ? 'bg-blue-600 shadow-sm text-white hover:bg-blue-700' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Filtros Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <select 
              value={filterObra}
              onChange={e => setFilterObra(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none"
            >
              <option value="">Obra: Todas</option>
              {obrasConPersonal.length > 0 && (
                <optgroup label="Con Personal">
                  {obrasConPersonal.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              )}
              {obrasSinPersonal.length > 0 && (
                <optgroup label="Sin Personal (Futuras)">
                  {obrasSinPersonal.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              )}
            </select>

            <select 
              value={filterSpecialty}
              onChange={e => setFilterSpecialty(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none"
            >
              <option value="">Especialidad: Todas</option>
              {specialtiesOpciones.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {(filterObra || filterSpecialty || search || filterType !== 'all') && (
              <button 
                onClick={() => { setFilterObra(''); setFilterSpecialty(''); setSearch(''); setFilterType('all'); }}
                className="text-xs text-rose-500 font-black hover:underline px-2"
              >
                × Limpiar
              </button>
            )}
          </div>

          {activeTab === 'staff' && (
            <div className="flex items-center gap-2 ml-auto sm:ml-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                className="h-9 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold shadow-sm flex items-center gap-1.5"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Exportar Excel</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportToImage}
                disabled={isExportingImage}
                className="h-9 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 font-bold shadow-sm flex items-center gap-1.5"
              >
                <FileImage className="h-4 w-4 text-blue-600" />
                <span>{isExportingImage ? 'Generando...' : 'Exportar Imagen'}</span>
              </Button>

              {isAdmin && (

                <Button
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-9 rounded-xl font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nuevo Operario</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando personal...</div>
      ) : activeTab === 'staff' ? (
        <div className="space-y-6">
          {filteredEmpleados.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <HardHat className="mx-auto h-12 w-12 text-slate-350 mb-2" />
              <p className="text-sm font-bold text-slate-500">No encontramos personal</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Prueba cambiando los filtros de obra o especialidad.
              </p>
            </div>
          ) : filterType === 'busy' ? (
            /* AGRUPADOS POR OBRA */
            sortedObraKeys.map(obraKey => {
              const group = groupedByObra[obraKey];
              const theme = getObraTheme(group.name);
              
              return (
                <div 
                  key={obraKey} 
                  className={`p-4 rounded-2xl border shadow-sm space-y-3 ${theme.border} ${theme.bg}`}
                >
                  {/* Cabecera del Grupo (Obra) */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200/50">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-peie-blue text-sm md:text-base tracking-tight">{group.name}</h3>
                        {group.id && (
                          <button
                            onClick={() => navigate('/mis-obras', { state: { selectedObraId: group.id } })}
                            className="text-[10px] font-bold text-blue-600 hover:underline shrink-0"
                          >
                            (Ver Obra)
                          </button>
                        )}
                      </div>
                      {group.encargado_name && (
                        <p className="text-[10px] md:text-xs text-slate-500 font-semibold mt-0.5">
                          Coordinador: <span className="text-peie-blue font-bold">{group.encargado_name}</span>
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] md:text-xs font-bold px-3 py-1 rounded-full border shadow-sm ${theme.badge}`}>
                      {group.list.length} {group.list.length === 1 ? 'operario' : 'operarios'}
                    </span>
                  </div>

                  {/* Grilla de Operarios en la Obra */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.list.map(emp => {
                      const isLibre = emp.status === 'Libre' || !emp.obra_id;
                      const badgeStyle = isLibre 
                        ? 'bg-green-50 text-green-600 border-green-150' 
                        : 'bg-blue-50 text-blue-600 border-blue-150';

                      return (
                        <Card key={emp.id} className="overflow-hidden rounded-xl border-slate-100 hover:shadow-md transition-all duration-200 bg-white">
                          <CardContent className="p-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Avatar */}
                              <div className="relative shrink-0">
                                <div 
                                  onClick={() => emp.photo_url && setFullSizePhoto({ url: emp.photo_url, name: emp.full_name, specialty: emp.specialty || undefined, obra: emp.obras?.name || undefined })}
                                  className={`w-10 h-10 rounded-full overflow-hidden bg-blue-50 border border-slate-150 flex items-center justify-center ${emp.photo_url ? 'cursor-pointer hover:ring-2 hover:ring-blue-500 hover:scale-105 transition-all shadow-sm group' : ''}`}
                                  title={emp.photo_url ? "Ver foto a tamaño completo" : undefined}
                                >
                                  {emp.photo_url ? (
                                    <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <HardHat className="h-5 w-5 text-blue-300" />
                                  )}
                                </div>
                                {isAdmin && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedEmpId(emp.id); fileInputRef.current?.click(); }}
                                    className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow hover:bg-blue-700 border border-white z-10"
                                    title="Cambiar Foto"
                                  >
                                    <Camera className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>

                              {/* Detalles */}
                              <div className="min-w-0 space-y-0.5">
                                <p 
                                  className="font-extrabold text-xs text-[#031530] truncate cursor-pointer hover:underline hover:text-blue-600 transition-colors"
                                  onClick={() => handleOpenProfile(emp)}
                                  title="Ver y editar perfil"
                                >
                                  {emp.full_name}
                                </p>
                                <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wide">
                                  {emp.specialty || 'Electricista'}
                                </p>
                                
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}>
                                    {isLibre ? 'Libre' : 'En Obra'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Botón de acción */}
                            <div className="shrink-0">
                              {isLibre ? (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50/50 h-8 px-3 text-[11px] font-black rounded-lg"
                                  onClick={() => {
                                    setEmpToAssign(emp);
                                    setAssignTargetObraId(obrasOpciones[0]?.id || '');
                                  }}
                                >
                                  Asignar
                                </Button>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-100 h-8 px-3 text-[11px] font-bold rounded-lg"
                                  onClick={() => handleOpenProfile(emp)}
                                >
                                  Ver
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            /* NOMINA COMPLETA / LISTA PLANA (ALFABETICO) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEmpleados.map(emp => {
                const isLibre = emp.status === 'Libre' || !emp.obra_id;
                const badgeStyle = isLibre 
                  ? 'bg-green-50 text-green-600 border-green-150' 
                  : 'bg-blue-50 text-blue-600 border-blue-150';

                return (
                  <Card key={emp.id} className="overflow-hidden rounded-xl border-slate-100 hover:shadow-md transition-all duration-200 bg-white">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div 
                            onClick={() => emp.photo_url && setFullSizePhoto({ url: emp.photo_url, name: emp.full_name, specialty: emp.specialty || undefined, obra: emp.obras?.name || undefined })}
                            className={`w-10 h-10 rounded-full overflow-hidden bg-blue-50 border border-slate-150 flex items-center justify-center ${emp.photo_url ? 'cursor-pointer hover:ring-2 hover:ring-blue-500 hover:scale-105 transition-all shadow-sm group' : ''}`}
                            title={emp.photo_url ? "Ver foto a tamaño completo" : undefined}
                          >
                            {emp.photo_url ? (
                              <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <HardHat className="h-5 w-5 text-blue-300" />
                            )}
                          </div>
                          {isAdmin && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSelectedEmpId(emp.id); fileInputRef.current?.click(); }}
                              className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow hover:bg-blue-700 border border-white z-10"
                              title="Cambiar Foto"
                            >
                              <Camera className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>

                        {/* Detalles */}
                        <div className="min-w-0 space-y-0.5">

                          <p 
                            className="font-extrabold text-xs text-[#031530] truncate cursor-pointer hover:underline hover:text-blue-600 transition-colors"
                            onClick={() => handleOpenProfile(emp)}
                            title="Ver y editar perfil"
                          >
                            {emp.full_name}
                          </p>
                          <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wide">
                            {emp.specialty || 'Electricista'}
                          </p>
                          {isAdmin && emp.dni && (
                            <p className="text-[9px] text-slate-500 font-semibold">DNI {emp.dni}</p>
                          )}
                          
                          <div className="flex items-center gap-1.5 mt-1 min-w-0">
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}>
                              {isLibre ? 'Libre' : 'En Obra'}
                            </span>
                            {!isLibre && emp.obras?.name && (
                              <span className="text-[9px] font-bold text-slate-500 truncate" title={emp.obras.name}>
                                • {emp.obras.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botón de acción */}
                      <div className="shrink-0">
                        {isLibre ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50/50 h-8 px-3 text-[11px] font-black rounded-lg"
                            onClick={() => {
                              setEmpToAssign(emp);
                              setAssignTargetObraId(obrasOpciones[0]?.id || '');
                            }}
                          >
                            Asignar
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-100 h-8 px-3 text-[11px] font-bold rounded-lg"
                            onClick={() => handleOpenProfile(emp)}
                          >
                            Ver
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selector de Rango de Fecha */}
          <div className="flex flex-col gap-2.5 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtrar Historial por Fecha</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'today', label: 'Hoy' },
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mes' },
                { value: 'custom', label: 'Fecha específica' },
                { value: 'all', label: 'Todos' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDateFilter(opt.value as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    dateFilter === opt.value
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-150'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            
            {/* Input de Fecha Especifica */}
            {dateFilter === 'custom' && (
              <div className="pt-1.5 flex items-center gap-2">
                <input
                  type="date"
                  value={specificDate}
                  onChange={e => setSpecificDate(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            )}
          </div>

          {/* Listado de Movimientos Filtrados */}
          <div className="space-y-3">
            {filteredHistorial.map(h => (
              <Card key={h.id} className="rounded-xl border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200" onClick={() => navigate(`/personal/traslados/${h.id}`, { state: { from: '/personal?tab=history' } })}>
                <CardContent className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-slate-800">{h.empleados?.full_name}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                      {h.source_obra?.name || 'Origen'} → {h.target_obra?.name || 'Destino'}
                    </p>
                    <p className="text-[9px] text-slate-300 font-medium">Solicitado: {new Date(h.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                    h.status === 'Pendiente' ? 'bg-orange-50 text-orange-600 border-orange-150' : 
                    h.status === 'Confirmado' ? 'bg-green-50 text-green-600 border-green-150' : 
                    'bg-slate-50 text-slate-600 border-slate-150'
                  }`}>
                    {h.status}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredHistorial.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                <Clock className="mx-auto h-12 w-12 text-slate-350 mb-2 animate-pulse" />
                <p className="text-sm font-bold text-slate-500">No hay movimientos registrados</p>
                <p className="text-xs text-slate-400 mt-1">
                  {dateFilter === 'today' ? 'No se registraron traslados hoy.' :
                   dateFilter === 'week' ? 'No hay traslados esta semana.' :
                   dateFilter === 'month' ? 'No hay traslados este mes.' :
                   dateFilter === 'custom' ? `No hay traslados para la fecha ${new Date(specificDate + 'T00:00:00').toLocaleDateString()}.` :
                   'No hay movimientos en el sistema.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Input for Avatar Uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        className="hidden" 
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !selectedEmpId) return;
          try {
            const compressed = await compressImage(file);
            const { error } = await supabase
              .from('empleados')
              .update({ photo_url: compressed })
              .eq('id', selectedEmpId);
            if (error) {
              toast({ variant: 'destructive', title: 'Error', description: error.message });
            } else {
              toast({ title: '¡Foto Actualizada!', description: 'La imagen del empleado fue guardada correctamente.' });
              fetchData();
            }
          } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
          }
          e.target.value = '';
        }}
      />

      {/* Modal de Perfil de Empleado (Ver y Editar) */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="rounded-3xl w-[95%] max-w-3xl max-h-[92vh] bg-white border-slate-100 shadow-xl overflow-hidden p-0 gap-0 grid grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="bg-gradient-to-r from-[#031530] to-[#042454] text-white p-5 pb-6 relative">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-extrabold tracking-tight">Ficha del Operario</DialogTitle>
              <p className="text-slate-350 text-xs font-semibold">Legajo personal, laboral y contacto de emergencia</p>
            </DialogHeader>

            {/* Avatar en cabecera */}
            <div className="absolute -bottom-10 right-6">
              <div className="relative group">
                <div 
                  onClick={() => profileForm.photo_url && setFullSizePhoto({ url: profileForm.photo_url, name: profileForm.full_name, specialty: profileForm.specialty })}
                  className={`w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 border-4 border-white shadow-md flex items-center justify-center ${profileForm.photo_url ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 hover:scale-105 transition-all' : ''}`}
                  title={profileForm.photo_url ? "Ver foto a tamaño completo" : undefined}
                >
                  {profileForm.photo_url ? (
                    <img src={profileForm.photo_url} alt={profileForm.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <HardHat className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => profilePhotoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-lg p-1.5 shadow-md hover:bg-blue-700 border-2 border-white transition-all duration-200"
                    title="Cambiar Foto"
                  >
                    <Camera className="h-3 w-3" />
                  </button>
                )}

                <input
                  type="file"
                  ref={profilePhotoInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePhotoChange}
                />
              </div>
            </div>
          </div>

          <div className="overflow-y-auto p-6 pt-12">
            {!isAdmin && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                El legajo es de solo lectura. Administración o Logística pueden modificarlo.
              </div>
            )}
            <EmployeeDataFields
              form={profileForm}
              setForm={setProfileForm}
              obras={obrasOpciones}
              prefix="profile"
              canEdit={isAdmin}
            />
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 gap-2 sm:gap-0 rounded-b-3xl flex flex-row items-center justify-between">
            {isAdmin && (
              <Button
                variant="ghost"
                onClick={handleDeleteEmployee}
                disabled={profileUpdating}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl font-extrabold text-xs px-3 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Eliminar</span>
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <DialogClose asChild>
                <Button 
                  variant="ghost" 
                  className="rounded-xl hover:bg-slate-200 text-slate-600 font-bold text-xs"
                >
                  {isAdmin ? 'Cancelar' : 'Cerrar'}
                </Button>
              </DialogClose>
              {isAdmin && (
                <Button
                  onClick={handleSaveProfile}
                  disabled={profileUpdating || !profileForm.full_name.trim()}
                  className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-extrabold text-xs px-5 shadow-md shadow-blue-600/10 flex items-center gap-1.5"
                >
                  {profileUpdating ? 'Guardando...' : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Guardar cambios
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Agregar Operario (Solo Admin) */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-3xl w-[95%] max-w-3xl max-h-[92vh] bg-white border-slate-100 shadow-xl overflow-hidden p-0 gap-0 grid grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="bg-gradient-to-r from-[#031530] to-[#042454] text-white p-5 pb-6">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-extrabold tracking-tight">Nuevo Operario</DialogTitle>
              <p className="text-slate-300 text-xs font-semibold">Registrar la ficha y el legajo del trabajador</p>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto p-6">
            <EmployeeDataFields
              form={addForm}
              setForm={setAddForm}
              obras={obrasOpciones}
              prefix="add"
              canEdit
            />
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 gap-2 sm:gap-0 rounded-b-3xl">
            <DialogClose asChild>
              <Button 
                variant="ghost" 
                className="rounded-xl hover:bg-slate-200 text-slate-600 font-bold text-xs"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={handleAddEmployee}
              disabled={addSaving || !addForm.full_name.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-extrabold text-xs px-5 shadow-md shadow-blue-600/10 flex items-center gap-1.5"
            >
              {addSaving ? 'Guardando...' : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Agregar Operario
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Rápido para Asignar Operario a Obra */}
      <Dialog open={Boolean(empToAssign)} onOpenChange={(open) => !open && setEmpToAssign(null)}>
        <DialogContent className="rounded-3xl w-[95%] max-w-md bg-white border-slate-100 shadow-xl overflow-hidden p-0">
          <div className="bg-gradient-to-r from-[#031530] to-[#042454] text-white p-5 pb-6">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-extrabold tracking-tight">Asignar a Obra</DialogTitle>
              <p className="text-slate-300 text-xs font-semibold">
                Seleccioná el destino para {empToAssign?.full_name}
              </p>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black shrink-0">
                {empToAssign?.photo_url ? (
                  <img src={empToAssign.photo_url} alt={empToAssign.full_name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <HardHat className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-sm text-slate-900 truncate">{empToAssign?.full_name}</p>
                <p className="text-xs text-slate-500 font-semibold">{empToAssign?.specialty || 'Electricista'}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Obra de Destino</Label>
              <Select
                value={assignTargetObraId}
                onValueChange={setAssignTargetObraId}
              >
                <SelectTrigger className="rounded-xl border-slate-200 focus:ring-blue-600 font-semibold text-slate-800 bg-white h-11">
                  <SelectValue placeholder="Seleccionar obra..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 bg-white shadow-md max-h-60">
                  {obrasOpciones.map(o => (
                    <SelectItem key={o.id} value={o.id} className="font-semibold text-slate-700">
                      {o.name} {o.encargado_name ? `(${o.encargado_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 gap-2 sm:gap-0 rounded-b-3xl flex flex-row items-center justify-end">
            <Button 
              variant="ghost" 
              onClick={() => setEmpToAssign(null)}
              className="rounded-xl hover:bg-slate-200 text-slate-600 font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmAssign}
              disabled={assignSaving || !assignTargetObraId}
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-extrabold text-xs px-5 shadow-md shadow-blue-600/10 flex items-center gap-1.5"
            >
              {assignSaving ? 'Asignando...' : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Confirmar Asignación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Contenedor de captura para Exportar a Imagen - Estilo Matriz Unificado Exacto */}
      <div 
        data-export-container="personal-matrix"
        className="overflow-hidden h-0 w-0 pointer-events-none fixed top-[-9999px] left-[-9999px]"
      >
        <div 
          ref={imageExportRef} 
          className="p-8 bg-white w-[850px] font-sans text-slate-900 border-2 border-slate-900"
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
        >
          {/* Encabezado */}
          <div className="mb-5 text-center border-b-2 border-slate-900 pb-3">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wider">Distribución de Personal por Obra</h2>
            <p className="text-xs text-slate-700 font-extrabold mt-1">PEIE Tools • {new Date().toLocaleDateString('es-AR')}</p>
          </div>

          {/* Matriz con bordes definidos */}
          <div className="border-2 border-slate-900 text-xs">
            {/* Header de la Tabla */}
            <div className="flex bg-[#0f172a] text-white font-black text-center border-b-2 border-slate-900">
              <div className="w-12 py-2.5 px-2 border-r-2 border-slate-900 text-center font-black">#</div>
              <div className="flex-1 py-2.5 px-4 border-r-2 border-slate-900 text-left font-black">Nombre Completo</div>
              <div className="w-64 py-2.5 px-3 border-r-2 border-slate-900 text-center font-black">Obra Asignada</div>
              <div className="w-24 py-2.5 px-2 text-center font-black">Cantidad</div>
            </div>

            {/* Listado agrupado por Obra */}
            {(() => {
              const groupedMap = new Map<string, Empleado[]>();
              filteredEmpleados.forEach((emp) => {
                const obraName = emp.obras?.name || (emp.status === 'Trabajando' ? 'Obra Sin Nombre' : 'AUSENTES / LIC. MEDICA');
                if (!groupedMap.has(obraName)) groupedMap.set(obraName, []);
                groupedMap.get(obraName)!.push(emp);
              });
              const sortedObraNames = Array.from(groupedMap.keys()).sort((a, b) => a.localeCompare(b));
              let globalIdx = 1;

              return sortedObraNames.map((obraName, groupIdx) => {
                const empList = groupedMap.get(obraName)!;
                empList.sort((a, b) => a.full_name.localeCompare(b.full_name));
                const isLastGroup = groupIdx === sortedObraNames.length - 1;

                return (
                  <div key={obraName} className={`flex ${!isLastGroup ? 'border-b-2 border-slate-900' : ''}`}>
                    {/* Lista de Empleados (Columnas # y Nombre Completo) */}
                    <div className="flex-1 flex flex-col border-r-2 border-slate-900">
                      {empList.map((emp, empIdx) => {
                        const isLastEmp = empIdx === empList.length - 1;
                        const rowNumber = globalIdx++;
                        return (
                          <div key={emp.id} className={`flex items-center min-h-[34px] ${!isLastEmp ? 'border-b border-slate-900' : ''}`}>
                            <div className="w-12 py-1.5 px-2 text-center font-bold border-r-2 border-slate-900 text-slate-800 shrink-0">
                              {rowNumber}
                            </div>
                            <div className="flex-1 py-1.5 px-4 text-left font-extrabold text-slate-950">
                              {emp.full_name}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Columna Obra Asignada: Unificada verticalmente en un solo bloque para toda la obra */}
                    <div className="w-64 py-2 px-3 text-center font-black uppercase bg-slate-50 text-slate-900 flex items-center justify-center border-r-2 border-slate-900 text-xs tracking-tight">
                      {obraName}
                    </div>

                    {/* Columna Cantidad: Unificada verticalmente en un solo bloque */}
                    <div className="w-24 py-2 px-2 text-center font-black bg-slate-50 text-slate-950 flex items-center justify-center text-sm">
                      {empList.length}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Fila de Totales */}
            <div className="flex bg-slate-100 border-t-2 border-slate-900 font-black text-xs">
              <div className="flex-1 py-2.5 px-4 text-right border-r-2 border-slate-900 uppercase tracking-wide text-slate-900">
                Total Personal en Obras:
              </div>
              <div className="w-24 py-2.5 px-2 text-center font-black text-sm text-slate-950 bg-slate-200">
                {filteredEmpleados.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox / Modal de Foto a Tamaño Completo */}
      {fullSizePhoto && (
        <div 
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFullSizePhoto(null)}
        >
          <button
            type="button"
            onClick={() => setFullSizePhoto(null)}
            className="absolute top-4 right-4 z-[130] bg-white/15 hover:bg-white/30 active:scale-95 text-white rounded-full p-2.5 backdrop-blur-sm transition-all border border-white/20"
            title="Cerrar (Esc)"
          >
            <X size={24} />
          </button>

          <div 
            className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/15 shadow-2xl relative bg-slate-950 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={fullSizePhoto.url} 
              alt={fullSizePhoto.name} 
              className="max-h-[75vh] w-auto max-w-full object-contain mx-auto"
            />
            <div className="w-full bg-gradient-to-t from-black via-black/80 to-transparent p-4 text-white text-center">
              <p className="text-base font-extrabold text-white">{fullSizePhoto.name}</p>
              {fullSizePhoto.specialty && (
                <p className="text-xs text-blue-300 font-bold uppercase tracking-wider mt-0.5">{fullSizePhoto.specialty}</p>
              )}
              {fullSizePhoto.obra && (
                <p className="text-[11px] text-slate-300 font-medium mt-0.5">Obra: {fullSizePhoto.obra}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


