export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface OperationalEmployee {
  id: string;
  full_name: string;
  specialty: string | null;
  status: 'Trabajando' | 'Libre' | 'En traslado' | string;
  photo_url: string | null;
  obra_id: string | null;
  role: string | null;
  whatsapp?: string | null;
  lastKnownLocation?: GeoCoordinates | null;
  lastLocationUpdate?: string | null;
}

export interface OperationalTool {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  status: 'Disponible' | 'En uso' | 'En mantenimiento' | 'En traslado' | 'Fuera de servicio' | string;
  current_obra_id: string | null;
  photo_url: string | null;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_location_at?: string | null;
}

export interface OperationalWorksite {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  encargado_name: string | null;
  status: string | null;
  active: boolean;
  latitude: number;
  longitude: number;
  isSimulatedLocation: boolean;
  photo_url: string | null;
  workersCount: number;
  toolsCount: number;
  assignedWorkers: OperationalEmployee[];
  assignedTools: OperationalTool[];
  magnitudeIndex: number;
  bubbleRadiusPx: number;
}

export interface MagnitudeWeights {
  workerWeight: number;    // default 0.40
  toolWeight: number;      // default 0.30
  priorityWeight: number;  // default 0.20
  costWeight: number;      // default 0.10
}

export interface OperationsKPIs {
  totalActiveWorksites: number;
  totalFieldWorkers: number;
  totalAvailableWorkers: number;
  totalInUseTools: number;
  totalAvailableTools: number;
  alertsCount: number;
  suggestionsCount: number;
}

export interface OperationsFilterState {
  searchQuery: string;
  showWorksites: boolean;
  showStaff: boolean;
  showTools: boolean;
  selectedStatus: string;
  selectedSpecialty: string;
  selectedCategory: string;
  selectedEncargado: string;
}

export const OPERATIONS_VERSION = '1.0.0';
