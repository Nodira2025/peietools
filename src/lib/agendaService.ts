import { supabase } from "./supabase";
import type { AgendaEvent, AgendaPerson } from "./agenda";
export async function agendaRequest<T>(
  run: (signal: AbortSignal) => PromiseLike<{ data: T | null; error: unknown }>,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const stopped = new Promise<never>((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(new Error("Consulta cancelada."));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    timer = setTimeout(() => {
      reject(new Error("La conexión demoró demasiado. Volvé a intentar."));
      controller.abort();
    }, 15000);
  });
  try {
    const result = await Promise.race([
      stopped,
      Promise.resolve().then(() => run(controller.signal)),
    ]);
    if (result.error) throw result.error;
    return result.data as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
export async function getAgendaPeople(
  signal?: AbortSignal,
): Promise<AgendaPerson[]> {
  const result: AgendaPerson[] = [];
  for (let offset = 0; ; offset += 500) {
    const rows = await agendaRequest<AgendaPerson[]>(
      (s) =>
        supabase
          .rpc("agenda_personas")
          .order("persona_tipo")
          .order("persona_id")
          .range(offset, offset + 499)
          .abortSignal(s),
      signal,
    );
    result.push(...rows);
    if (rows.length < 500) return result;
  }
}
export async function getAgendaEvents(
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<AgendaEvent[]> {
  const result: AgendaEvent[] = [];
  for (let offset = 0; ; offset += 500) {
    const rows = await agendaRequest<AgendaEvent[]>(
      (s) =>
        supabase
          .from("agenda_eventos")
          .select(
            "id,titulo,descripcion,fecha,hora,lugar,creado_por,agenda_vinculos(persona_tipo,persona_id,avisar,leido_en)",
          )
          .eq("eliminado", false)
          .gte("fecha", start)
          .lte("fecha", end)
          .order("fecha")
          .order("id")
          .range(offset, offset + 499)
          .abortSignal(s),
      signal,
    );
    result.push(...rows);
    if (rows.length < 500) return result;
  }
}
export function agendaError(error: unknown): string {
  const value = error as { code?: string; message?: string };
  if (["23514", "22008", "22007"].includes(value?.code || ""))
    return "La fecha o los datos no son válidos. Revisá el día y el mes antes de guardar.";
  if (["PGRST202", "PGRST205", "42P01"].includes(value?.code || ""))
    return "La agenda compartida todavía no está habilitada en el servidor. Los feriados siguen disponibles. Administración debe activar el módulo.";
  return (
    value?.message ||
    "No se pudo cargar la agenda. Revisá tu conexión y reintentá."
  );
}
