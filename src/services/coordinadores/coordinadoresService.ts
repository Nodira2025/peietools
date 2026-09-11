import { supabase } from '../../lib/supabase';
import type { ObraFase, CoordinadorProfile, ObraWithProgress, ObraEstadoFinal, EstadoFinalObra } from '../../types/coordinadores';

const LOCAL_STORAGE_FASES_KEY = 'peie_obra_fases_cache';
const LOCAL_STORAGE_PROFILES_KEY = 'peie_coordinadores_profiles_cache';
const LOCAL_STORAGE_OBRA_ESTADOS_KEY = 'peie_coordinadores_obra_estado_final_cache';

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const addDays = (d: Date, days: number): string => {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

function getDefaultEstadoFinal(index: number, obraId: string, obraName: string): ObraEstadoFinal {
  const today = new Date();
  const progresoSamples = [12, 28, 46, 65, 81, 100];
  const avanceFinal = progresoSamples[index % progresoSamples.length];
  const etapasTotales = 8;
  const etapasCompletadas = Math.min(etapasTotales, Math.round((avanceFinal / 100) * etapasTotales));
  const fechaEstimadaCierre = addDays(today, 25 + index * 5);

  const etapaPorcentaje: Array<{ max: number; label: EstadoFinalObra }> = [
    { max: 15, label: 'No iniciada' },
    { max: 50, label: 'En ejecución' },
    { max: 79, label: 'Pruebas y control' },
    { max: 99, label: 'Listo para entrega' },
    { max: 100, label: 'Finalizada' }
  ];
  const etapaFinal = etapaPorcentaje.find(item => avanceFinal <= item.max)?.label || 'No iniciada';

  return {
    obraId,
    obraName,
    etapaFinal,
    avanceFinal,
    etapasCompletadas,
    etapasTotales,
    fechaEstimadaCierre,
    notas: `Estado de muestra para visualizar el anillo de estadio final de ${obraName}.`,
    actualizadoEn: new Date().toISOString(),
    esMuestra: true
  };
}

function getStoredObraEstados(): Record<string, ObraEstadoFinal> | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OBRA_ESTADOS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (error) {
    console.warn('No se pudo leer estados de obra:', error);
  }
  return null;
}

function saveStoredObraEstados(value: Record<string, ObraEstadoFinal>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_OBRA_ESTADOS_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn('No se pudo guardar estados de obra:', error);
  }
}

function buildObraEstadoStateMapFromObras(obras: { id: string; name: string }[]): Record<string, ObraEstadoFinal> {
  return obras.reduce((acc: Record<string, ObraEstadoFinal>, obra, idx) => {
    acc[obra.id] = getDefaultEstadoFinal(idx, obra.id, obra.name);
    return acc;
  }, {});
}

/**
 * Standard phases for electrical installations in construction worksites
 */
export function getDefaultPhases(obraId: string, encargadoName?: string | null): ObraFase[] {
  const today = new Date();
  
  const addDays = (d: Date, days: number): string => {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    return res.toISOString().split('T')[0];
  };

  return [
    {
      id: `${obraId}-f1`,
      obra_id: obraId,
      name: 'Replanteo, Puntos de Iluminación y Canalizaciones',
      start_date: addDays(today, -15),
      end_date: addDays(today, 10),
      progress: 80,
      status: 'En Curso',
      responsable_name: encargadoName || 'Coordinador Asignado',
      order_index: 1,
      notes: 'Replanteo general según planos eléctricos ejecutivos.'
    },
    {
      id: `${obraId}-f2`,
      obra_id: obraId,
      name: 'Tendido de Cañerías, Cajas y Bandejas Portacables',
      start_date: addDays(today, -5),
      end_date: addDays(today, 25),
      progress: 45,
      status: 'En Curso',
      responsable_name: encargadoName || 'Coordinador Asignado',
      order_index: 2,
      notes: 'Montaje de bandejas en cielorrasos y bajadas a tableros.'
    },
    {
      id: `${obraId}-f3`,
      obra_id: obraId,
      name: 'Cableado de Potencia, Tomas y Comandos',
      start_date: addDays(today, 15),
      end_date: addDays(today, 45),
      progress: 10,
      status: 'Pendiente',
      responsable_name: encargadoName || 'Coordinador Asignado',
      order_index: 3,
      notes: 'Pasaje de cables antillama normalizados y rotulación.'
    },
    {
      id: `${obraId}-f4`,
      obra_id: obraId,
      name: 'Montaje de Tableros Principales y Seccionales',
      start_date: addDays(today, 35),
      end_date: addDays(today, 60),
      progress: 0,
      status: 'Pendiente',
      responsable_name: encargadoName || 'Coordinador Asignado',
      order_index: 4,
      notes: 'Disyuntores, térmicas y protecciones diferenciales.'
    },
    {
      id: `${obraId}-f5`,
      obra_id: obraId,
      name: 'Conexión de Artefactos, Iluminación y Pruebas',
      start_date: addDays(today, 55),
      end_date: addDays(today, 80),
      progress: 0,
      status: 'Pendiente',
      responsable_name: encargadoName || 'Coordinador Asignado',
      order_index: 5,
      notes: 'Medición de puesta a tierra (jabalinas) y certificación.'
    }
  ];
}

export const coordinadoresService = {
  /**
   * Fetch all administrative / coordinator profiles with assigned worksites
   */
  async getCoordinadores(): Promise<CoordinadorProfile[]> {
    try {
      const [profilesRes, obrasRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('obras').select('id, name, encargado_name')
      ]);

      const obrasList = obrasRes.data || [];
      const obrasMap = new Map(obrasList.map(o => [o.id, o.name]));
      
      // Also map obras by encargado_name for fallback association
      const encargadoObrasMap = new Map<string, string[]>();
      obrasList.forEach(o => {
        if (o.encargado_name) {
          const key = o.encargado_name.trim().toLowerCase();
          const list = encargadoObrasMap.get(key) || [];
          list.push(o.name);
          encargadoObrasMap.set(key, list);
        }
      });

      // Load any local overrides for address or photo
      let localCache: Record<string, Partial<CoordinadorProfile>> = {};
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
        if (stored) localCache = JSON.parse(stored);
      } catch {}

      const profiles = (profilesRes.data || []).map((p: any) => {
        const cached = localCache[p.id] || {};
        const fullName = p.full_name || 'Sin Nombre';
        const normName = fullName.trim().toLowerCase();
        
        // Determine assigned obra name
        let assignedObra = p.obra_id ? obrasMap.get(p.obra_id) || null : null;
        if (!assignedObra) {
          const match = encargadoObrasMap.get(normName);
          if (match && match.length > 0) {
            assignedObra = match.join(', ');
          }
        }

        return {
          id: p.id,
          full_name: fullName,
          username: p.username || null,
          role: p.role || 'coordinador',
          whatsapp: cached.whatsapp || p.whatsapp || null,
          phone: cached.phone || p.phone || null,
          address: cached.address || p.address || null,
          photo_url: cached.photo_url || p.photo_url || null,
          obra_id: p.obra_id || null,
          obra_name: assignedObra,
          active: p.active ?? true,
          created_at: p.created_at
        };
      });

      return profiles;
    } catch (e) {
      console.error('Error fetching coordinadores:', e);
      return [];
    }
  },

  /**
   * Update coordinator / administrative profile
   */
  async updateCoordinador(id: string, updates: Partial<CoordinadorProfile>): Promise<boolean> {
    try {
      // 1. Update local cache immediately
      let localCache: Record<string, any> = {};
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
        if (stored) localCache = JSON.parse(stored);
      } catch {}
      localCache[id] = { ...(localCache[id] || {}), ...updates };
      localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(localCache));

      // 2. Attempt Supabase update
      const dbPayload: any = {};
      if (updates.full_name !== undefined) dbPayload.full_name = updates.full_name;
      if (updates.whatsapp !== undefined) dbPayload.whatsapp = updates.whatsapp;
      if (updates.phone !== undefined) dbPayload.phone = updates.phone;
      if (updates.address !== undefined) dbPayload.address = updates.address;
      if (updates.photo_url !== undefined) dbPayload.photo_url = updates.photo_url;
      if (updates.obra_id !== undefined) dbPayload.obra_id = updates.obra_id;

      const { error } = await supabase.from('profiles').update(dbPayload).eq('id', id);
      if (error) {
        console.warn('Supabase profile update warning (using local sync):', error.message);
      }
      return true;
    } catch (err) {
      console.error('Error updating coordinador:', err);
      return false;
    }
  },

  /**
   * Fetch phases for a given worksite with fallback template
   */
  async getFases(obraId: string, encargadoName?: string | null): Promise<ObraFase[]> {
    try {
      // Check Supabase first
      const { data, error } = await supabase
        .from('obra_fases')
        .select('*')
        .eq('obra_id', obraId)
        .order('order_index');

      if (!error && data && data.length > 0) {
        return data as ObraFase[];
      }

      // Check local cache
      const stored = localStorage.getItem(LOCAL_STORAGE_FASES_KEY);
      if (stored) {
        const cache: Record<string, ObraFase[]> = JSON.parse(stored);
        if (cache[obraId] && cache[obraId].length > 0) {
          return cache[obraId];
        }
      }

      // Fallback: Default electrical construction phases template
      const defaults = getDefaultPhases(obraId, encargadoName);
      this.saveFasesLocally(obraId, defaults);
      return defaults;
    } catch (e) {
      console.warn('Fases table unavailable, using local default phases:', e);
      return getDefaultPhases(obraId, encargadoName);
    }
  },

  /**
   * Save or update a single phase
   */
  async saveFase(fase: ObraFase): Promise<boolean> {
    try {
      // Try Supabase insert/upsert
      const { error } = await supabase
        .from('obra_fases')
        .upsert({
          id: fase.id.includes('-f') ? undefined : fase.id, // Avoid passing synthetic template IDs
          obra_id: fase.obra_id,
          name: fase.name,
          start_date: fase.start_date,
          end_date: fase.end_date,
          progress: fase.progress,
          status: fase.status,
          responsable_name: fase.responsable_name,
          order_index: fase.order_index,
          notes: fase.notes
        });

      if (error) {
        console.warn('Upsert to obra_fases failed (using local sync):', error.message);
      }

      // Sync to local storage
      const current = await this.getFases(fase.obra_id);
      const index = current.findIndex(f => f.id === fase.id);
      let updated: ObraFase[];
      if (index >= 0) {
        updated = [...current];
        updated[index] = fase;
      } else {
        updated = [...current, fase];
      }
      this.saveFasesLocally(fase.obra_id, updated);
      return true;
    } catch (err) {
      console.error('Error saving fase:', err);
      return false;
    }
  },

  /**
   * Delete a phase
   */
  async deleteFase(obraId: string, faseId: string): Promise<boolean> {
    try {
      await supabase.from('obra_fases').delete().eq('id', faseId);
      const current = await this.getFases(obraId);
      const filtered = current.filter(f => f.id !== faseId);
      this.saveFasesLocally(obraId, filtered);
      return true;
    } catch (err) {
      console.error('Error deleting fase:', err);
      return false;
    }
  },

  saveFasesLocally(obraId: string, fases: ObraFase[]) {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_FASES_KEY);
      const cache: Record<string, ObraFase[]> = stored ? JSON.parse(stored) : {};
      cache[obraId] = fases;
      localStorage.setItem(LOCAL_STORAGE_FASES_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error('Error saving fases to localStorage:', e);
    }
  },

  /**
   * Calculate overall metrics for an obra from its phases
   */
  calculateMetrics(fases: ObraFase[]): {
    overallProgress: number;
    completedCount: number;
    inProgressCount: number;
    delayedCount: number;
    startDate: string | null;
    endDate: string | null;
    daysRemaining: number;
  } {
    if (fases.length === 0) {
      return {
        overallProgress: 0,
        completedCount: 0,
        inProgressCount: 0,
        delayedCount: 0,
        startDate: null,
        endDate: null,
        daysRemaining: 0,
      };
    }

    let totalWeight = 0;
    let weightedProgress = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let delayedCount = 0;
    let minStart: Date | null = null;
    let maxEnd: Date | null = null;

    const today = new Date();

    fases.forEach(f => {
      const start = new Date(f.start_date);
      const end = new Date(f.end_date);
      const durationDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      
      totalWeight += durationDays;
      weightedProgress += f.progress * durationDays;

      if (f.status === 'Completada' || f.progress === 100) completedCount++;
      else if (f.status === 'En Curso') inProgressCount++;
      
      // Auto-detect delayed if end date is in the past and progress < 100
      if (end < today && f.progress < 100) {
        delayedCount++;
      } else if (f.status === 'Retrasada') {
        delayedCount++;
      }

      if (!minStart || start < minStart) minStart = start;
      if (!maxEnd || end > maxEnd) maxEnd = end;
    });

    const overallProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
    const daysRemaining = maxEnd ? Math.max(0, Math.ceil(((maxEnd as Date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    return {
      overallProgress,
      completedCount,
      inProgressCount,
      delayedCount,
      startDate: minStart ? (minStart as Date).toISOString().split('T')[0] : null,
      endDate: maxEnd ? (maxEnd as Date).toISOString().split('T')[0] : null,
      daysRemaining
    };
  },

  /**
   * Load progress states for obra list.
   * On first visit, synthetic sample data is injected to show donut charts in UI.
   */
  getObrasEstado(obras: { id: string; name: string }[]): Record<string, ObraEstadoFinal> {
    const stored = getStoredObraEstados();
    if (stored === null) {
      const seeded = buildObraEstadoStateMapFromObras(obras);
      saveStoredObraEstados(seeded);
      return seeded;
    }

    return stored;
  },

  /**
   * Save or update a manual obra status.
   * Always overrides sample states and marks record as user-managed.
   */
  saveObraEstado(estado: ObraEstadoFinal): boolean {
    try {
      const safeAvance = Number.isFinite(estado.avanceFinal) ? Math.round(estado.avanceFinal) : 0;
      const safeTotal = Number.isFinite(estado.etapasTotales) ? Math.max(1, Math.round(estado.etapasTotales)) : 1;
      const safeCompletadas = Number.isFinite(estado.etapasCompletadas) ? Math.round(estado.etapasCompletadas) : 0;
      const stored = getStoredObraEstados() || {};
      const normalizado: ObraEstadoFinal = {
        ...estado,
        avanceFinal: clampNumber(safeAvance, 0, 100),
        etapasTotales: safeTotal,
        etapasCompletadas: clampNumber(safeCompletadas, 0, safeTotal),
        fechaEstimadaCierre: estado.fechaEstimadaCierre || null,
        notas: estado.notas?.trim() || null,
        actualizadoEn: new Date().toISOString(),
        esMuestra: false
      };

      stored[normalizado.obraId] = normalizado;
      saveStoredObraEstados(stored);
      return true;
    } catch (error) {
      console.error('Error al guardar estado de obra:', error);
      return false;
    }
  },

  /**
   * Remove one obra state (sample or manual).
   */
  deleteObraEstado(obraId: string): boolean {
    try {
      const stored = getStoredObraEstados() || {};
      if (!stored[obraId]) return true;
      delete stored[obraId];
      saveStoredObraEstados(stored);
      return true;
    } catch (error) {
      console.error('Error al eliminar estado de obra:', error);
      return false;
    }
  },

  /**
   * Remove only synthetic sample states (keeps user-managed statuses).
   */
  deleteAllSampleObraEstados(): boolean {
    try {
      const stored = getStoredObraEstados() || {};
      const filtered = Object.entries(stored).reduce<Record<string, ObraEstadoFinal>>((acc, [obraId, estado]) => {
        if (!estado.esMuestra) {
          acc[obraId] = estado;
        }
        return acc;
      }, {});
      saveStoredObraEstados(filtered);
      return true;
    } catch (error) {
      console.error('Error al eliminar estados de muestra:', error);
      return false;
    }
  }
};
