import { Link } from "react-router-dom";
import { Bell, CalendarDays } from "lucide-react";
import { useAgendaNotifications } from "@/hooks/useAgendaNotifications";
import { displayDate } from "@/lib/agenda";
export default function AgendaNotifications() {
  const { items, error } = useAgendaNotifications();
  return (
    <section className="rounded-2xl border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-peie-blue" />
          Avisos de la agenda
        </h2>
        <Link className="text-sm underline text-peie-blue" to="/agenda">
          Abrir agenda
        </Link>
      </div>
      {error ? (
        <p className="text-sm text-amber-700">
          No se pudieron consultar los avisos de agenda.
        </p>
      ) : !items.length ? (
        <p className="text-sm text-slate-500">
          No tenés avisos de eventos pendientes.
        </p>
      ) : (
        items.map(({ agenda_eventos: e }) => (
          <Link
            key={e.id}
            to={`/agenda?evento=${e.id}&fecha=${e.fecha}`}
            className="flex gap-3 p-3 rounded-xl bg-blue-50"
          >
            <Bell className="h-4 w-4 shrink-0 mt-1" />
            <span className="text-sm">
              <strong>{e.titulo}</strong>
              <span className="block text-xs">
                {displayDate(e.fecha)} {e.hora?.slice(0, 5)}
              </span>
            </span>
          </Link>
        ))
      )}
    </section>
  );
}
