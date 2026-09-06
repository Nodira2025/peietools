import { supabase } from '../../lib/supabase';
import type { Candidato, CandidatoStatus, ParsedCvResult } from '../../types/entrevistas';
import { calculateHaversineDistance } from '../geo/haversine';
import { KNOWN_TUCUMAN_LOCATIONS, TUCUMAN_CENTER } from '../geo/tucumanGeoRegistry';

const LOCAL_STORAGE_CANDIDATOS_KEY = 'peie_candidatos_entrevistas_cache';

const DEFAULT_CANDIDATOS: Candidato[] = [
  {
    id: 'cand-1',
    full_name: 'Lucas Emanuel Medina',
    dni: '38492014',
    phone: '+54 9 381 582-1940',
    email: 'lucas.medina@gmail.com',
    address: 'Av. Aconquija 2200',
    locality: 'Yerba Buena',
    latitude: -26.8150,
    longitude: -65.3050,
    age: 29,
    specialty_title: 'Oficial Electricista',
    years_experience: 5,
    education_level: 'Secundario Técnico',
    cv_text_summary: 'Especialista en montaje de bandejas portacables, cableado trifásico y armado de tableros de potencia. Experiencia en edificios en altura.',
    status: 'A Contactar',
    rating: 5,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cand-2',
    full_name: 'Gonzalo Javier Roldán',
    dni: '40192841',
    phone: '+54 9 381 490-2381',
    email: 'roldan.electricidad@gmail.com',
    address: 'San Martín 840',
    locality: 'San Miguel de Tucumán',
    latitude: -26.8310,
    longitude: -65.2080,
    age: 26,
    specialty_title: 'Medio Oficial',
    years_experience: 3,
    education_level: 'Técnico Electromecánico',
    cv_text_summary: 'Conocimiento en tendido de cañerías rígidas, conexionado de llaves combinadas e iluminación LED. Manejo de herramientas eléctricas.',
    status: 'Nuevo',
    rating: 4,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cand-3',
    full_name: 'Esteban Darío Peralta',
    dni: '36291039',
    phone: '+54 9 381 601-4472',
    email: 'esteban_peralta_obras@hotmail.com',
    address: 'Ruta 9 km 1285',
    locality: 'Banda del Río Salí',
    latitude: -26.8480,
    longitude: -65.1710,
    age: 32,
    specialty_title: 'Oficial Montador',
    years_experience: 7,
    education_level: 'Secundario Completo',
    cv_text_summary: 'Experiencia en líneas aéreas, conexionado de acometidas industriales y generadores diésel de respaldo.',
    status: 'Entrevista Programada',
    interview_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    rating: 4,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cand-4',
    full_name: 'Matías Nicolás Albarracín',
    dni: '42019482',
    phone: '+54 9 381 319-8802',
    email: 'matias.albarracin@gmail.com',
    address: 'Diagonal Raúl Leccese 1500',
    locality: 'Tafí Viejo',
    latitude: -26.7820,
    longitude: -65.2390,
    age: 23,
    specialty_title: 'Ayudante Electricista',
    years_experience: 1,
    education_level: 'Secundario Técnico en curso',
    cv_text_summary: 'Ganas de aprender y disponibilidad horaria. Realizó canaleteado y picado de losas para cañería corrugada.',
    status: 'Nuevo',
    rating: 3,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export const cvParserService = {
  /**
   * Approximate coordinates for candidate's locality or address in Tucumán
   */
  resolveCandidateCoordinates(locality?: string | null, address?: string | null): { latitude: number; longitude: number } {
    const text = `${locality || ''} ${address || ''}`.toUpperCase().trim();

    if (text.includes('YERBA BUENA') || text.includes('ACONQUIJA') || text.includes('SOLANO VERA')) {
      return { latitude: -26.8150, longitude: -65.3050 };
    }
    if (text.includes('TAFI VIEJO') || text.includes('LECCESE') || text.includes('LOMAS DE TAFI')) {
      return { latitude: -26.7780, longitude: -65.2380 };
    }
    if (text.includes('BANDA DEL RIO SALI') || text.includes('ALDERETES') || text.includes('LASTENIA')) {
      return { latitude: -26.8480, longitude: -65.1710 };
    }
    if (text.includes('SAN PABLO') || text.includes('LULES')) {
      return { latitude: -26.8520, longitude: -65.3180 };
    }
    if (text.includes('BARRIO NORTE') || text.includes('SANTA FE') || text.includes('JUNIN')) {
      return { latitude: -26.8188, longitude: -65.2073 };
    }
    if (text.includes('BARRIO SUR') || text.includes('BOLIVAR') || text.includes('LAVALLE')) {
      return { latitude: -26.8380, longitude: -65.2150 };
    }

    // Default to San Miguel de Tucumán center
    return {
      latitude: TUCUMAN_CENTER.latitude,
      longitude: TUCUMAN_CENTER.longitude
    };
  },

  /**
   * Parse CV document using Gemini 2.5 Flash via OpenRouter
   */
  async parseCvWithAI(file: File): Promise<ParsedCvResult> {
    let apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      apiKey = localStorage.getItem('VITE_OPENROUTER_API_KEY') || '';
    }

    if (!apiKey) {
      console.warn('VITE_OPENROUTER_API_KEY missing, using heuristic extractor');
      return this.heuristicExtractor(file);
    }

    try {
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || 'application/pdf';
      const cleanBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

      const systemPrompt = `Sos un analista senior de Recursos Humanos para una empresa constructora de obras e instalaciones eléctricas de Tucumán, Argentina (PEIE).
Analizá este Currículum Vitae (CV) y extraé los datos estructurados en formato JSON estricto (sin formato Markdown, sin bloques de código tipo \`\`\`json).
El JSON debe tener exactamente esta estructura:
{
  "full_name": "Nombre y apellido del candidato",
  "dni": "DNI o número de documento si figura",
  "phone": "Teléfono o celular de contacto",
  "email": "Correo electrónico",
  "birth_date": "Fecha de nacimiento en formato YYYY-MM-DD si es calculable",
  "age": 28,
  "address": "Dirección o calle declarada",
  "locality": "Localidad o ciudad de Tucumán (ej: San Miguel de Tucumán, Yerba Buena, Banda del Río Salí, Tafí Viejo, San Pablo, Concepción, etc.)",
  "specialty_title": "Oficio o puesto principal (ej: Oficial Electricista, Medio Oficial Electricista, Ayudante Electricista, Técnico Electromecánico, Oficial Montador, etc.)",
  "years_experience": 4,
  "education_level": "Nivel educativo máximo (ej: Secundario Técnico, Terciario, Universitario, Curso Profesional)",
  "skills": ["Habilidad 1", "Habilidad 2", "Habilidad 3"],
  "summary": "Resumen conciso de 2 o 3 líneas destacando experiencia en obras, herramientas dominadas y disponibilidad."
}`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://peietools.com',
          'X-Title': 'PEIE Tools - CV Parser'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: systemPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${cleanBase64}`
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter error HTTP ${response.status}`);
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content || '';
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (err) {
      console.warn('AI Parsing failed, falling back to heuristic:', err);
      return this.heuristicExtractor(file);
    }
  },

  heuristicExtractor(file: File): ParsedCvResult {
    const rawName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    return {
      full_name: rawName.length > 3 ? rawName : 'Candidato Postulado',
      specialty_title: 'Oficial Electricista',
      years_experience: 2,
      education_level: 'Secundario Técnico',
      locality: 'San Miguel de Tucumán',
      summary: `Postulante que adjuntó archivo "${file.name}". Perfil con disponibilidad para incorporación a frentes de obra.`
    };
  },

  /**
   * Fetch all candidates with nearest obra calculation
   */
  async getCandidatos(): Promise<Candidato[]> {
    try {
      // 1. Fetch active obras to calculate distances
      const { data: obrasData } = await supabase
        .from('obras')
        .select('id, name, latitude, longitude')
        .eq('active', true);

      const obrasList = (obrasData || []).filter(o => typeof o.latitude === 'number' && typeof o.longitude === 'number');

      // 2. Fetch candidates from Supabase
      const { data, error } = await supabase
        .from('candidatos_entrevistas')
        .select('*')
        .order('created_at', { ascending: false });

      let list: Candidato[] = [];
      if (!error && data && data.length > 0) {
        list = data as Candidato[];
      } else {
        // Fallback to local storage or defaults
        const stored = localStorage.getItem(LOCAL_STORAGE_CANDIDATOS_KEY);
        list = stored ? JSON.parse(stored) : DEFAULT_CANDIDATOS;
      }

      // 3. Augment each candidate with nearest obra calculation
      return list.map(cand => {
        let nearestName: string | null = null;
        let minDistance: number | null = null;

        const candLat = cand.latitude || TUCUMAN_CENTER.latitude;
        const candLng = cand.longitude || TUCUMAN_CENTER.longitude;

        obrasList.forEach(o => {
          const distKm = calculateHaversineDistance(
            { latitude: candLat, longitude: candLng },
            { latitude: o.latitude!, longitude: o.longitude! }
          );
          if (minDistance === null || distKm < minDistance) {
            minDistance = Math.round(distKm * 10) / 10;
            nearestName = o.name;
          }
        });

        return {
          ...cand,
          nearest_obra_name: nearestName || cand.nearest_obra_name,
          nearest_obra_distance_km: minDistance !== null ? minDistance : cand.nearest_obra_distance_km
        };
      });
    } catch (err) {
      console.error('Error fetching candidatos:', err);
      return DEFAULT_CANDIDATOS;
    }
  },

  /**
   * Save a new candidate submission
   */
  async submitCandidato(payload: Omit<Candidato, 'id' | 'created_at'>): Promise<Candidato> {
    const coords = payload.latitude && payload.longitude 
      ? { latitude: payload.latitude, longitude: payload.longitude }
      : this.resolveCandidateCoordinates(payload.locality, payload.address);

    const newCand: Candidato = {
      ...payload,
      id: `cand-${Date.now()}`,
      latitude: coords.latitude,
      longitude: coords.longitude,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('candidatos_entrevistas')
        .insert({
          full_name: newCand.full_name,
          dni: newCand.dni,
          phone: newCand.phone,
          email: newCand.email,
          address: newCand.address,
          locality: newCand.locality,
          latitude: newCand.latitude,
          longitude: newCand.longitude,
          birth_date: newCand.birth_date,
          age: newCand.age,
          specialty_title: newCand.specialty_title,
          years_experience: newCand.years_experience,
          education_level: newCand.education_level,
          cv_url: newCand.cv_url,
          cv_filename: newCand.cv_filename,
          cv_text_summary: newCand.cv_text_summary,
          photo_url: newCand.photo_url,
          status: newCand.status,
          rating: newCand.rating || 0
        })
        .select()
        .single();

      if (!error && data) {
        newCand.id = data.id;
      }
    } catch (e) {
      console.warn('Supabase insert failed, saving locally:', e);
    }

    // Sync locally
    const current = await this.getCandidatos();
    const updated = [newCand, ...current];
    this.saveLocalCandidatos(updated);

    return newCand;
  },

  /**
   * Update candidate status, notes, or rating
   */
  async updateCandidato(id: string, updates: Partial<Candidato>): Promise<boolean> {
    try {
      await supabase
        .from('candidatos_entrevistas')
        .update(updates)
        .eq('id', id);
    } catch (e) {
      console.warn('Supabase candidate update warning:', e);
    }

    const current = await this.getCandidatos();
    const updated = current.map(c => c.id === id ? { ...c, ...updates } : c);
    this.saveLocalCandidatos(updated);
    return true;
  },

  /**
   * Hire candidate: marks as 'Contratado' and inserts into 'empleados'
   */
  async hireCandidato(candidato: Candidato, targetObraId: string | null): Promise<boolean> {
    try {
      // 1. Insert into empleados table
      const { error: empError } = await supabase.from('empleados').insert({
        full_name: candidato.full_name,
        specialty: candidato.specialty_title,
        photo_url: candidato.photo_url || null,
        whatsapp: candidato.phone,
        status: targetObraId ? 'Trabajando' : 'Libre',
        obra_id: targetObraId || null
      });

      if (empError) {
        console.warn('Insert into empleados table failed:', empError.message);
      }

      // 2. Mark candidate as Contratado
      await this.updateCandidato(candidato.id, {
        status: 'Contratado',
        interview_notes: `${candidato.interview_notes || ''}\n[Contratado e incorporado a la nómina general]`
      });

      return true;
    } catch (e) {
      console.error('Error hiring candidato:', e);
      return false;
    }
  },

  saveLocalCandidatos(list: Candidato[]) {
    try {
      localStorage.setItem(LOCAL_STORAGE_CANDIDATOS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving candidatos to localStorage:', e);
    }
  }
};
