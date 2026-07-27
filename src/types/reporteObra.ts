export interface ReporteNovedadObra {
  id: string;
  created_at: string;
  created_by?: string | null;
  creator_role?: string | null;
  obra_id: string;
  coordinador_id?: string | null;
  item_description: string;
  tipo_accion: 'reparacion_carga' | 'mantenimiento' | 'ingreso' | 'entrega' | 'otro';
  estado: 'Pendiente' | 'En Proceso' | 'Completado' | 'Cancelado';
  observaciones?: string | null;
  attachment_url?: string | null;
  obras?: {
    id: string;
    name: string;
  } | null;
  coordinador?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  creador?: {
    id: string;
    full_name: string | null;
    email: string | null;
    role?: string | null;
  } | null;
}
