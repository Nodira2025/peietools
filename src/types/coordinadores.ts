export const COORDINADORES_VERSION = '1.0.0';

export type FaseStatus = 'Pendiente' | 'En Curso' | 'Completada' | 'Retrasada';

export interface ObraFase {
  id: string;
  obra_id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  progress: number;   // 0 to 100
  status: FaseStatus;
  responsable_name?: string | null;
  order_index: number;
  notes?: string | null;
  color?: string;
  created_at?: string;
}

export interface CoordinadorProfile {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
  whatsapp: string | null;
  phone: string | null;
  address: string | null;
  photo_url: string | null;
  obra_id: string | null;
  obra_name?: string | null;
  active: boolean;
  created_at?: string;
}

export interface ObraWithProgress {
  id: string;
  name: string;
  address: string | null;
  encargado_name: string | null;
  status: string;
  totalPhases: number;
  completedPhases: number;
  overallProgress: number; // 0 to 100
  startDate: string | null;
  endDate: string | null;
}
