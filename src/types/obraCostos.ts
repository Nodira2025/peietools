export interface Electricista {
  id: string;
  full_name: string;
  specialty: string | null;
  photo_url: string | null;
  obra_id: string | null;
  valor_hora: number | null;
  dni: string | null;
}
export interface RecursoHerramienta {
  id: string;
  name: string;
  code: string;
  current_obra_id: string | null;
}
export interface LiquidacionCosto {
  id: string;
  empleado_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  horas_trabajadas: number;
  sueldo_bruto: number;
  bono_presentismo: number;
  estado: string;
}
export interface ManoObra {
  empleado_id: string;
  categoria: string;
  horas: number;
  valor_hora: number;
  liquidacion_id: string | null;
}
export interface CostoHerramienta {
  herramienta_id: string;
  concepto: string;
  cantidad: number;
  costo_unitario: number;
}
export interface ObraTarea {
  id: string;
  obra_id: string;
  fase_id: string;
  name: string;
  progress: number;
  mano_obra: ManoObra[];
  herramientas: CostoHerramienta[];
}
