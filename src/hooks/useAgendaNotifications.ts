import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { agendaRequest } from "@/lib/agendaService";
interface Notice {
  evento_id: string;
  agenda_eventos: {
    id: string;
    titulo: string;
    fecha: string;
    hora: string | null;
  };
}
export function useAgendaNotifications() {
  const profileId = useAuthStore((state) => state.profile?.id);
  const [items, setItems] = useState<Notice[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!profileId) return;
    let active = true;
    let busy = false;
    const controller = new AbortController();
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const rows = await agendaRequest<Notice[]>(
          (s) =>
            supabase
              .from("agenda_vinculos")
              .select("evento_id,agenda_eventos!inner(id,titulo,fecha,hora)")
              .eq("persona_tipo", "perfil")
              .eq("persona_id", profileId)
              .eq("avisar", true)
              .is("leido_en", null)
              .eq("agenda_eventos.eliminado", false)
              .order("evento_id")
              .limit(100)
              .abortSignal(s)
              .returns<Notice[]>(),
          controller.signal,
        );
        if (active) {
          setItems(rows);
          setError(false);
        }
      } catch {
        if (active) {
          setItems([]);
          setError(true);
        }
      } finally {
        busy = false;
      }
    };
    void load();
    const refresh = () => void load();
    window.addEventListener("peie:agenda", refresh);
    const timer = setInterval(() => void load(), 30000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("peie:agenda", refresh);
    };
  }, [profileId]);
  return { items, error };
}
