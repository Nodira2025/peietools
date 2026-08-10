import { supabase } from './supabase';
import { showNativeNotification } from './pushNotifications';

export interface ReservaHerramienta {
  id: string;
  herramienta_id: string;
  solicitante_id: string;
  poseedor_actual_id: string | null;
  obra_id: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'pendiente' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada';
  notas: string | null;
  notificado_24h: boolean;
  created_at: string;
  herramientas?: {
    id: string;
    name: string;
    code: string;
    status: string;
    current_obra_id?: string | null;
  } | null;
  solicitante?: {
    id: string;
    full_name: string;
    username: string;
    whatsapp?: string | null;
  } | null;
  poseedor_actual?: {
    id: string;
    full_name: string;
    username: string;
    whatsapp?: string | null;
  } | null;
  obra?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Verifica si hay conflictos de disponibilidad para una herramienta en un rango de fechas.
 */
export async function verificarDisponibilidadHerramienta(
  herramientaId: string,
  fechaInicio: string,
  fechaFin: string,
  reservaIdExcluir?: string
): Promise<boolean> {
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('verificar_disponibilidad_herramienta', {
      p_herramienta_id: herramientaId,
      p_fecha_inicio: fechaInicio,
      p_fecha_fin: fechaFin,
      p_reserva_id: reservaIdExcluir || null,
    });

    if (!rpcError && typeof rpcResult === 'boolean') {
      return rpcResult;
    }
  } catch (e) {
    console.warn('RPC no disponible, realizando verificación por fallback en cliente:', e);
  }

  // Fallback consulta JS
  const { data, error } = await supabase
    .from('reservas_herramientas')
    .select('id, fecha_inicio, fecha_fin')
    .eq('herramienta_id', herramientaId)
    .in('estado', ['confirmada', 'en_curso', 'pendiente']);

  if (error) {
    console.error('Error consultando disponibilidad:', error);
    return false; // Ante una falla no se confirma una reserva que podría superponerse.
  }

  if (!data || data.length === 0) return true;

  const inicioMs = new Date(fechaInicio).getTime();
  const finMs = new Date(fechaFin).getTime();

  const conflicto = data.some((r) => {
    if (reservaIdExcluir && r.id === reservaIdExcluir) return false;
    const rInicio = new Date(r.fecha_inicio).getTime();
    const rFin = new Date(r.fecha_fin).getTime();
    // Superposición de rangos: max(start1, start2) < min(end1, end2)
    return Math.max(inicioMs, rInicio) < Math.min(finMs, rFin);
  });

  return !conflicto;
}

/**
 * Crea una nueva reserva de herramienta.
 */
export async function crearReservaHerramienta(reserva: {
  herramienta_id: string;
  solicitante_id: string;
  poseedor_actual_id?: string | null;
  obra_id?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  notas?: string | null;
}): Promise<{ success: boolean; data?: ReservaHerramienta; message?: string }> {
  // 1. Verificar disponibilidad
  const disponible = await verificarDisponibilidadHerramienta(
    reserva.herramienta_id,
    reserva.fecha_inicio,
    reserva.fecha_fin
  );

  if (!disponible) {
    return {
      success: false,
      message: 'La herramienta ya se encuentra reservada en el rango de fechas seleccionado.',
    };
  }

  // 2. Insertar reserva
  const { data, error } = await supabase
    .from('reservas_herramientas')
    .insert([
      {
        herramienta_id: reserva.herramienta_id,
        solicitante_id: reserva.solicitante_id,
        poseedor_actual_id: reserva.poseedor_actual_id || null,
        obra_id: reserva.obra_id || null,
        fecha_inicio: reserva.fecha_inicio,
        fecha_fin: reserva.fecha_fin,
        estado: 'confirmada',
        notas: reserva.notas || null,
      },
    ])
    .select(
      `
      *,
      herramientas(id, name, code, status),
      solicitante:profiles!solicitante_id(id, full_name, username, whatsapp),
      poseedor_actual:profiles!poseedor_actual_id(id, full_name, username, whatsapp),
      obra:obras!obra_id(id, name)
    `
    )
    .single();

  if (error) {
    console.error('Error creando reserva:', error);
    return { success: false, message: error.message };
  }

  // Emitir notificación nativa local inmediata
  showNativeNotification('Reserva Confirmada', {
    body: `Reserva agendada para el ${new Date(reserva.fecha_inicio).toLocaleDateString()}`,
  });

  return { success: true, data: data as ReservaHerramienta };
}

/**
 * Cancela una reserva de herramienta.
 */
export async function cancelarReservaHerramienta(reservaId: string): Promise<boolean> {
  const { error } = await supabase
    .from('reservas_herramientas')
    .update({ estado: 'cancelada' })
    .eq('id', reservaId);

  if (error) {
    console.error('Error cancelando reserva:', error);
    return false;
  }
  return true;
}

/**
 * Obtiene las reservas de una herramienta específica.
 */
export async function obtenerReservasPorHerramienta(herramientaId: string): Promise<ReservaHerramienta[]> {
  const { data, error } = await supabase
    .from('reservas_herramientas')
    .select(
      `
      *,
      herramientas(id, name, code, status),
      solicitante:profiles!solicitante_id(id, full_name, username, whatsapp),
      poseedor_actual:profiles!poseedor_actual_id(id, full_name, username, whatsapp),
      obra:obras!obra_id(id, name)
    `
    )
    .eq('herramienta_id', herramientaId)
    .order('fecha_inicio', { ascending: true });

  if (error) {
    console.error('Error obteniendo reservas por herramienta:', error);
    return [];
  }
  return (data as ReservaHerramienta[]) || [];
}

/**
 * Obtiene todas las reservas (para panel general y notificaciones).
 */
export async function obtenerTodasLasReservas(): Promise<ReservaHerramienta[]> {
  const { data, error } = await supabase
    .from('reservas_herramientas')
    .select(
      `
      *,
      herramientas(id, name, code, status),
      solicitante:profiles!solicitante_id(id, full_name, username, whatsapp),
      poseedor_actual:profiles!poseedor_actual_id(id, full_name, username, whatsapp),
      obra:obras!obra_id(id, name)
    `
    )
    .order('fecha_inicio', { ascending: true });

  if (error) {
    console.error('Error obteniendo reservas:', error);
    return [];
  }
  return (data as ReservaHerramienta[]) || [];
}
