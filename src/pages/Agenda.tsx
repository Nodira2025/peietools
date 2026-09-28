import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Cake,
  Bell,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WhatsAppPreviewModal } from "@/components/WhatsAppPreviewModal";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/lib/supabase";
import { APP_URL } from "@/lib/whatsapp";
import {
  agendaRequest,
  getAgendaEvents,
  getAgendaPeople,
  agendaError,
} from "@/lib/agendaService";
import {
  argentinaToday,
  birthdayItems,
  monthCells,
  specialDays,
  displayDate,
  personKey,
  eventMessage,
  KIND_LABELS,
  type AgendaKind,
  type CalendarItem,
  type AgendaEvent,
  type AgendaPerson,
} from "@/lib/agenda";

const colors: Record<AgendaKind, string> = {
  feriado: "bg-rose-50 text-rose-800 border-rose-200",
  no_laborable: "bg-orange-50 text-orange-800 border-orange-200",
  especial: "bg-sky-50 text-sky-800 border-sky-200",
  cumpleanos: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  evento: "bg-emerald-50 text-emerald-800 border-emerald-200",
};
const dots: Record<AgendaKind, string> = {
  feriado: "bg-rose-500",
  no_laborable: "bg-orange-400",
  especial: "bg-sky-500",
  cumpleanos: "bg-fuchsia-500",
  evento: "bg-emerald-500",
};
interface Draft {
  id: string | null;
  requestId: string;
  title: string;
  date: string;
  time: string;
  place: string;
  description: string;
  people: string[];
  notify: boolean;
}
const emptyDraft = (date: string): Draft => ({
  id: null,
  requestId: crypto.randomUUID(),
  title: "",
  date,
  time: "",
  place: "",
  description: "",
  people: [],
  notify: false,
});
export default function Agenda() {
  const { profile } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const today = argentinaToday();
  const [month, setMonth] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(params.get("fecha") || "")
      ? params.get("fecha")!.slice(0, 7)
      : today.slice(0, 7),
  );
  const [day, setDay] = useState<string | null>(null);
  const [kind, setKind] = useState<AgendaKind | "todos">("todos");
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [people, setPeople] = useState<AgendaPerson[]>([]);
  const [holidays, setHolidays] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [holidayNote, setHolidayNote] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [detail, setDetail] = useState<CalendarItem | null>(null);
  const [remove, setRemove] = useState(false);
  const [notice, setNotice] = useState("");
  const [birthOpen, setBirthOpen] = useState(false);
  const [birthPerson, setBirthPerson] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [wa, setWa] = useState<{
    phone: string;
    name: string;
    message: string;
  } | null>(null);
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5)) - 1;
  const manager = ["admin", "logistica"].includes(profile?.role || "");
  const canCreate =
    manager || ["coordinador", "encargado"].includes(profile?.role || "");
  const canEdit = (e: AgendaEvent) =>
    canCreate && (manager || e.creado_por === profile?.id);
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset state for the remote dataset selected by year or retry.
    setLoading(true);
    setReady(false);
    setError("");
    Promise.all([
      getAgendaEvents(`${year}-01-01`, `${year}-12-31`, controller.signal),
      getAgendaPeople(controller.signal),
    ])
      .then(([a, b]) => {
        if (!controller.signal.aborted) {
          setEvents(a);
          setPeople(b);
          setReady(true);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setEvents([]);
          setPeople([]);
          setError(agendaError(e));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [year, refresh, profile?.id]);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Do not show another year's holidays while loading.
    setHolidays([]);
    setHolidayNote("Consultando calendario oficial…");
    async function load() {
      let hasBackup = false;
      try {
        const backup = await fetch(`/data/feriados-${year}.json`, { signal: controller.signal });
        if (backup.ok) {
          const data = await backup.json();
          if (current && Array.isArray(data.events)) {
            hasBackup = true;
            setHolidays(data.events);
            setHolidayNote(`Calendario oficial consultado: ${data.checkedAt}. Copia de respaldo; consultando actualizaciones…`);
          }
        }
      } catch { /* The official endpoint may still be available. */ }
      try {
        const response = await fetch(
          `/.netlify/functions/feriados?year=${year}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!Array.isArray(data.events)) throw Error();
        if (current) {
          setHolidays(data.events);
          setHolidayNote(
            `Calendario oficial consultado: ${data.checkedAt}. Días no laborables y efemérides se distinguen de los feriados.`,
          );
        }
      } catch {
        if (current && hasBackup) setHolidayNote(previous => previous.replace('consultando actualizaciones…', 'no se pudieron consultar novedades.'));
        else if (current)
          setHolidayNote(
            `Los feriados de ${year} no están disponibles. Consultá la fuente oficial o reintentá.`,
          );
      }
    }
    void load();
    const timer = setTimeout(() => controller.abort(), 12000);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [year, refresh]);
  useEffect(() => {
    const id = params.get("evento");
    if (!id || !ready) return;
    const e = events.find((e) => e.id === id);
    if (e) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Open the event requested by an external notification after it loads.
      setMonth(e.fecha.slice(0, 7));
      setDetail({
        id: e.id,
        title: e.titulo,
        date: e.fecha,
        time: e.hora,
        description: e.descripcion,
        kind: "evento",
      });
    }
  }, [params, events, ready]);
  const items = useMemo(
    () =>
      [
        ...holidays,
        ...specialDays(year),
        ...birthdayItems(people, year),
        ...events.map((e) => ({
          id: e.id,
          title: e.titulo,
          date: e.fecha,
          time: e.hora,
          description: e.descripcion,
          kind: "evento" as const,
        })),
      ].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.time || "").localeCompare(b.time || "") ||
          a.title.localeCompare(b.title, "es"),
      ),
    [holidays, people, events, year],
  );
  const visible = items.filter(
    (i) => i.date.startsWith(month) && (kind === "todos" || i.kind === kind),
  );
  const listed = visible.filter((i) => !day || i.date === day);
  const detailedEvent =
    detail?.kind === "evento"
      ? events.find((e) => e.id === detail.id)
      : undefined;
  const linked = detailedEvent
    ? people.filter((p) =>
        detailedEvent.agenda_vinculos.some(
          (v) => personKey(v) === personKey(p),
        ),
      )
    : [];
  const missing = people.filter((p) => !p.mes || !p.dia).length;
  const changeMonth = (delta: number) => {
    const d = new Date(year, monthIndex + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setDay(null);
  };
  const edit = (e?: AgendaEvent) => {
    setActionError("");
    setPersonSearch("");
    setDraft(
      e
        ? {
            id: e.id,
            requestId: e.id,
            title: e.titulo,
            date: e.fecha,
            time: e.hora?.slice(0, 5) || "",
            place: e.lugar,
            description: e.descripcion,
            people: e.agenda_vinculos.map(personKey),
            notify: false,
          }
        : emptyDraft(day || today),
    );
    setDetail(null);
  };
  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setActionError("");
    try {
      const id = await agendaRequest<string>((signal) =>
        supabase
          .rpc("agenda_guardar", {
            p_id: draft.id || draft.requestId,
            p_titulo: draft.title.trim(),
            p_descripcion: draft.description,
            p_fecha: draft.date,
            p_hora: draft.time || null,
            p_lugar: draft.place,
            p_personas: draft.people.map((key) => {
              const [tipo, id] = key.split(":");
              return { tipo, id };
            }),
            p_avisar: draft.notify,
          })
          .abortSignal(signal),
      );
      setMonth(draft.date.slice(0, 7));
      setDay(null);
      setNotice(
        draft.notify && draft.people.length
          ? "Evento guardado. Los usuarios vinculados tienen un aviso en PEIE. Podés abrir el evento para avisar por WhatsApp al personal."
          : "Evento guardado sin enviar avisos.",
      );
      setDraft(null);
      setRefresh((n) => n + 1);
      window.dispatchEvent(new Event("peie:agenda"));
      setParams({ evento: id, fecha: draft.date });
    } catch (e) {
      setActionError(agendaError(e));
    } finally {
      setSaving(false);
    }
  }
  async function removeEvent() {
    if (!detailedEvent || saving) return;
    setSaving(true);
    setActionError("");
    try {
      await agendaRequest((s) =>
        supabase
          .rpc("agenda_quitar", { p_id: detailedEvent.id })
          .abortSignal(s),
      );
      setDetail(null);
      setRemove(false);
      setParams({});
      setRefresh((n) => n + 1);
      setNotice("Evento quitado de la agenda.");
      window.dispatchEvent(new Event("peie:agenda"));
    } catch (e) {
      setActionError(agendaError(e));
    } finally {
      setSaving(false);
    }
  }
  async function saveBirthday(clear = false) {
    if (!birthPerson || saving) return;
    setSaving(true);
    setActionError("");
    const [tipo, id] = birthPerson.split(":");
    try {
      await agendaRequest((s) =>
        supabase
          .rpc("agenda_cumple_guardar", {
            p_tipo: tipo,
            p_id: id,
            p_mes: clear ? null : Number(birthMonth),
            p_dia: clear ? null : Number(birthDay),
          })
          .abortSignal(s),
      );
      setBirthOpen(false);
      setRefresh((n) => n + 1);
      setNotice(
        clear
          ? "Cumpleaños quitado de la agenda."
          : "Cumpleaños guardado. Se repetirá cada año.",
      );
    } catch (e) {
      setActionError(agendaError(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">
      <header className="rounded-3xl bg-gradient-to-br from-[#031530] to-[#103e70] p-5 sm:p-7 text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-200 mb-2">
            PEIE · Nuestro equipo
          </p>
          <h1 className="text-3xl font-black flex gap-3 items-center">
            <CalendarDays />
            Agenda
          </h1>
          <p className="text-sm text-slate-200 mt-2">
            Fechas importantes, encuentros y cumpleaños.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {manager && (
            <Button
              variant="secondary"
              disabled={!ready}
              onClick={() => {
                setActionError("");
                setBirthPerson("");
                setBirthMonth("");
                setBirthDay("");
                setBirthOpen(true);
              }}
            >
              <Cake className="h-4 w-4 mr-2" />
              Cumpleaños
            </Button>
          )}
          {canCreate && (
            <Button
              disabled={!ready}
              onClick={() => edit()}
              className="bg-sky-400 text-slate-950 hover:bg-sky-300"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo evento
            </Button>
          )}
        </div>
      </header>
      {notice && (
        <p
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm"
        >
          {notice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 text-amber-950 border border-amber-200"
        >
          <p>{error}</p>
          <Button
            className="mt-2"
            variant="outline"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Reintentar agenda
          </Button>
        </div>
      )}
      {loading && <p role="status">Cargando eventos y cumpleaños…</p>}
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <div className="flex items-center gap-2">
          <Button
            aria-label="Mes anterior"
            variant="outline"
            size="icon"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft />
          </Button>
          <label className="sr-only" htmlFor="agenda-month">
            Mes de la agenda
          </label>
          <Input
            id="agenda-month"
            type="month"
            min="2000-01"
            max="2099-12"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setDay(null);
              }
            }}
            className="w-44"
          />
          <Button
            aria-label="Mes siguiente"
            variant="outline"
            size="icon"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setMonth(today.slice(0, 7));
            setDay(today);
          }}
        >
          Hoy
        </Button>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar agenda">
        {(
          ["todos", ...Object.keys(KIND_LABELS)] as (AgendaKind | "todos")[]
        ).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`rounded-full px-3 py-2 text-xs font-semibold border ${kind === k ? "bg-peie-blue text-white" : k === "todos" ? "bg-white" : colors[k]}`}
          >
            {k === "todos" ? "Todo" : KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 items-start">
        <section
          className="rounded-2xl border bg-white p-2 sm:p-4"
          aria-label="Calendario mensual"
        >
          <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500 mb-2">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells(year, monthIndex).map((date, index) => {
              const content = visible.filter((i) => i.date === date);
              return date ? (
                <button
                  key={date}
                  aria-label={`${displayDate(date)}, ${content.length} eventos`}
                  aria-pressed={day === date}
                  onClick={() => setDay(day === date ? null : date)}
                  className={`min-w-0 min-h-16 sm:min-h-24 p-1 sm:p-2 text-left rounded-lg border ${day === date ? "ring-2 ring-peie-blue bg-blue-50" : date === today ? "border-sky-500 bg-sky-50" : "border-slate-100 hover:bg-slate-50"}`}
                >
                  <span className="font-bold text-sm">
                    {Number(date.slice(-2))}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[...new Set(content.map((i) => i.kind))].map((k) => (
                      <span
                        key={k}
                        className={`w-1.5 h-1.5 rounded-full ${dots[k]}`}
                      />
                    ))}
                  </div>
                  {content.length > 0 && (
                    <span className="hidden sm:block text-[10px] truncate mt-1">
                      {content[0].title}
                    </span>
                  )}
                </button>
              ) : (
                <span key={"blank-" + index} />
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-4 leading-relaxed">
            {holidayNote}{" "}
            <a
              href="https://www.argentina.gob.ar/feriados"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Fuente oficial
            </a>
          </p>
        </section>
        <section className="space-y-3" aria-label="Eventos de la agenda">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-slate-800">
              {day ? displayDate(day) : "En este mes"}{" "}
              <span className="text-slate-400">({listed.length})</span>
            </h2>
            {day && (
              <button
                className="text-sm text-peie-blue underline shrink-0"
                onClick={() => setDay(null)}
              >
                Ver mes
              </button>
            )}
          </div>
          {!listed.length && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
              No hay fechas con este filtro.
              {canCreate && ready && (
                <Button
                  className="block mx-auto mt-3"
                  variant="outline"
                  onClick={() => edit()}
                >
                  Agregar evento
                </Button>
              )}
            </div>
          )}
          {listed.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setDetail(item);
                setRemove(false);
                setActionError("");
              }}
              className={`w-full text-left rounded-2xl border p-4 ${colors[item.kind]}`}
            >
              <span className="block text-[11px] uppercase tracking-wide font-bold">
                {KIND_LABELS[item.kind]} · {Number(item.date.slice(-2))}/
                {Number(item.date.slice(5, 7))}
                {item.time ? " · " + item.time.slice(0, 5) : ""}
              </span>
              <span className="block font-bold mt-1 break-words">
                {item.title}
              </span>
            </button>
          ))}
        </section>
      </div>
      {ready && (
        <p className="text-xs text-slate-500">
          {people.length - missing} de {people.length} registros de personas
          tienen cumpleaños cargado. Los registros sin fecha no generan
          cumpleaños. Para el 29 de febrero se conserva la fecha en años
          bisiestos.
        </p>
      )}
      <Dialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!open && !saving) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Editar evento" : "Nuevo evento"}
            </DialogTitle>
            <DialogDescription>
              Visible en la agenda compartida. Vincular personas y enviar avisos
              es opcional.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={saveEvent} className="space-y-4">
              <label className="block text-sm font-semibold">
                Título
                <Input
                  required
                  maxLength={160}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-semibold">
                  Fecha
                  <Input
                    required
                    type="date"
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-semibold">
                  Hora (opcional)
                  <Input
                    type="time"
                    value={draft.time}
                    onChange={(e) =>
                      setDraft({ ...draft, time: e.target.value })
                    }
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Horario de Argentina. Sin hora: todo el día.
              </p>
              <label className="block text-sm font-semibold">
                Lugar (opcional)
                <Input
                  maxLength={250}
                  value={draft.place}
                  onChange={(e) =>
                    setDraft({ ...draft, place: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm font-semibold">
                Descripción
                <textarea
                  className="w-full rounded-xl border p-3 font-normal"
                  rows={3}
                  maxLength={4000}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <fieldset className="border rounded-xl p-3 space-y-3">
                <legend className="text-sm font-bold px-1">
                  Personas vinculadas (opcional)
                </legend>
                <Input
                  aria-label="Buscar personas"
                  placeholder="Nombre, especialidad o rol…"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                />
                <p className="text-xs">{draft.people.length} seleccionadas</p>
                <div className="max-h-44 overflow-y-auto space-y-2">
                  {people
                    .filter((p) =>
                      (p.nombre + " " + p.detalle)
                        .toLocaleLowerCase("es")
                        .includes(personSearch.toLocaleLowerCase("es")),
                    )
                    .map((p) => (
                      <label
                        key={personKey(p)}
                        className="flex items-start gap-2 text-sm p-1"
                      >
                        <input
                          type="checkbox"
                          checked={draft.people.includes(personKey(p))}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              people: e.target.checked
                                ? [...draft.people, personKey(p)]
                                : draft.people.filter(
                                    (k) => k !== personKey(p),
                                  ),
                            })
                          }
                        />
                        <span>
                          {p.nombre}
                          <small className="block text-slate-500">
                            {p.persona_tipo === "empleado"
                              ? "Personal"
                              : "Usuario de PEIE"}{" "}
                            · {p.detalle || "Sin detalle"}
                          </small>
                        </span>
                      </label>
                    ))}
                </div>
              </fieldset>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!draft.people.length}
                  checked={draft.notify && !!draft.people.length}
                  onChange={(e) =>
                    setDraft({ ...draft, notify: e.target.checked })
                  }
                />
                <span>
                  Avisar dentro de PEIE a los usuarios vinculados
                  <small className="block text-slate-500">
                    El personal sin cuenta puede recibir el aviso por WhatsApp
                    desde el evento guardado. El mensaje se envía al confirmarlo
                    en WhatsApp.
                  </small>
                </span>
              </label>
              {actionError && (
                <p role="alert" className="text-red-700 text-sm">
                  {actionError}
                </p>
              )}
              <Button
                type="submit"
                disabled={saving || !draft.title.trim()}
                className="w-full"
              >
                {saving ? "Guardando…" : "Guardar evento"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setDetail(null);
            setRemove(false);
            setParams({});
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>
              {detail && displayDate(detail.date)}
              {detail?.time
                ? " · " + detail.time.slice(0, 5) + " h (Argentina)"
                : " · Todo el día"}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap break-words">
            {detail?.description}
          </p>
          {detail?.source && (
            <a
              className="text-sm underline text-peie-blue"
              href={detail.source}
              target="_blank"
              rel="noreferrer"
            >
              Consultar fuente
            </a>
          )}
          {detailedEvent && (
            <>
              <p className="text-sm">
                {detailedEvent.lugar && "Lugar: " + detailedEvent.lugar}
              </p>
              <h3 className="font-bold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Personas vinculadas ({linked.length})
              </h3>
              {linked.map((p) => (
                <div
                  key={personKey(p)}
                  className="border rounded-xl p-3 text-sm flex flex-wrap justify-between gap-2"
                >
                  <span>
                    {p.nombre}
                    <small className="block text-slate-500">
                      {p.persona_tipo === "perfil" ? "Cuenta PEIE" : "Personal"}{" "}
                      · {p.detalle}
                    </small>
                  </span>
                  {canEdit(detailedEvent) &&
                    (p.whatsapp ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setWa({
                            phone: p.whatsapp!,
                            name: p.nombre,
                            message: eventMessage(
                              detailedEvent,
                              p.nombre,
                              `${APP_URL}/agenda?evento=${detailedEvent.id}&fecha=${detailedEvent.fecha}`,
                            ),
                          })
                        }
                      >
                        Avisar por WhatsApp
                      </Button>
                    ) : (
                      <span className="text-amber-700 text-xs">
                        Sin WhatsApp registrado
                      </span>
                    ))}
                </div>
              ))}
              {detailedEvent.agenda_vinculos.some(
                (v) =>
                  v.persona_tipo === "perfil" &&
                  v.persona_id === profile?.id &&
                  v.avisar &&
                  !v.leido_en,
              ) && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await agendaRequest((s) =>
                        supabase
                          .rpc("agenda_leer", { p_id: detailedEvent.id })
                          .abortSignal(s),
                      );
                      setRefresh((n) => n + 1);
                      setNotice("Aviso marcado como leído.");
                      window.dispatchEvent(new Event("peie:agenda"));
                    } catch (e) {
                      setActionError(agendaError(e));
                    }
                  }}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Marcar aviso como leído
                </Button>
              )}
              {canEdit(detailedEvent) && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => edit(detailedEvent)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => setRemove(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Quitar evento
                  </Button>
                </div>
              )}
              {remove && (
                <div className="rounded-xl bg-rose-50 p-3 space-y-2 text-sm">
                  <p>
                    ¿Quitar «{detailedEvent.titulo}» de la agenda compartida?
                  </p>
                  <Button disabled={saving} onClick={() => void removeEvent()}>
                    Confirmar quitar
                  </Button>
                  <Button variant="ghost" onClick={() => setRemove(false)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </>
          )}
          {actionError && (
            <p role="alert" className="text-sm text-red-700">
              {actionError}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={birthOpen}
        onOpenChange={(open) => {
          if (!saving) setBirthOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cumpleaños del equipo</DialogTitle>
            <DialogDescription>
              Completá día y mes para personal y usuarios. No hace falta indicar
              el año de nacimiento.
            </DialogDescription>
          </DialogHeader>
          <label className="text-sm font-semibold">
            Persona
            <select
              aria-label="Persona"
              className="w-full border rounded-lg p-2"
              value={birthPerson}
              onChange={(e) => {
                setBirthPerson(e.target.value);
                const p = people.find((p) => personKey(p) === e.target.value);
                setBirthMonth(p?.mes ? String(p.mes) : "");
                setBirthDay(p?.dia ? String(p.dia) : "");
              }}
            >
              <option value="">Seleccionar persona</option>
              {people.map((p) => (
                <option key={personKey(p)} value={personKey(p)}>
                  {p.nombre} ·{" "}
                  {p.persona_tipo === "empleado"
                    ? "Personal"
                    : p.detalle || "Usuario"}
                  {p.mes ? "" : " · Sin fecha"}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Mes
              <Input
                aria-label="Mes de cumpleaños"
                type="number"
                min={1}
                max={12}
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
              />
            </label>
            <label>
              Día
              <Input
                aria-label="Día de cumpleaños"
                type="number"
                min={1}
                max={31}
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
              />
            </label>
          </div>
          {actionError && (
            <p role="alert" className="text-sm text-red-700">
              {actionError}
            </p>
          )}
          <Button
            disabled={saving || !birthPerson || !birthMonth || !birthDay}
            onClick={() => void saveBirthday()}
          >
            Guardar cumpleaños
          </Button>
          <Button
            variant="outline"
            disabled={saving || !birthPerson}
            onClick={() => void saveBirthday(true)}
          >
            Quitar cumpleaños de la agenda
          </Button>
        </DialogContent>
      </Dialog>
      <WhatsAppPreviewModal
        isOpen={!!wa}
        onClose={() => setWa(null)}
        phone={wa?.phone || ""}
        message={wa?.message || ""}
        recipientName={wa?.name}
      />
    </div>
  );
}
