export const ENTREVISTAS_VERSION = '1.0.0';

export type CandidatoStatus = 
  | 'Nuevo' 
  | 'A Contactar' 
  | 'Entrevista Programada' 
  | 'Aprobado' 
  | 'Contratado' 
  | 'Descartado';

export interface Candidato {
  id: string;
  full_name: string;
  dni?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  locality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  birth_date?: string | null;
  age?: number | null;
  specialty_title: string;
  years_experience?: number | null;
  education_level?: string | null;
  cv_url?: string | null;
  cv_filename?: string | null;
  cv_text_summary?: string | null;
  photo_url?: string | null;
  status: CandidatoStatus;
  interview_date?: string | null;
  interview_notes?: string | null;
  nearest_obra_name?: string | null;
  nearest_obra_distance_km?: number | null;
  rating?: number | null; // 1 to 5
  created_at: string;
}

export interface ParsedCvResult {
  full_name?: string;
  dni?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  age?: number;
  address?: string;
  locality?: string;
  specialty_title?: string;
  years_experience?: number;
  education_level?: string;
  skills?: string[];
  summary?: string;
}

export interface EntrevistasFilterState {
  search: string;
  status: string;
  specialty: string;
  maxDistanceKm: number;
  targetObraId: string;
  minAge: number;
  maxAge: number;
  minExperience: number;
}
