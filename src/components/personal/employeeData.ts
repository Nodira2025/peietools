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

export interface EmployeeFormState extends EmployeePrivateData {
  full_name: string;
  specialty: string;
  whatsapp: string;
  status: 'Trabajando' | 'Libre';
  photo_url: string | null;
  obra_id: string | null;
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

export const createEmptyEmployeeForm = (specialty = ''): EmployeeFormState => ({
  full_name: '',
  specialty,
  whatsapp: '',
  status: 'Libre',
  photo_url: null,
  obra_id: null,
  ...createEmptyPrivateData()
});

export type PrivateDataRecord = Partial<Record<keyof EmployeePrivateData, string | null>>;

export const mapPrivateData = (data?: PrivateDataRecord | null): EmployeePrivateData => ({
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

export const buildPrivateDataPayload = (form: EmployeeFormState) => {
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

export const validateEmployeeForm = (form: EmployeeFormState) => {
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
