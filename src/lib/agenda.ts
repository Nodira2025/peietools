export type AgendaKind =
  "feriado" | "no_laborable" | "especial" | "cumpleanos" | "evento";
export interface CalendarItem {
  id: string;
  title: string;
  date: string;
  kind: AgendaKind;
  description?: string;
  source?: string;
  time?: string | null;
}
export interface AgendaPerson {
  persona_tipo: "empleado" | "perfil";
  persona_id: string;
  nombre: string;
  detalle: string | null;
  whatsapp: string | null;
  mes: number | null;
  dia: number | null;
}
export interface AgendaLink {
  persona_tipo: "empleado" | "perfil";
  persona_id: string;
  avisar: boolean;
  leido_en: string | null;
}
export interface AgendaEvent {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  hora: string | null;
  lugar: string;
  creado_por: string;
  agenda_vinculos: AgendaLink[];
}
export const KIND_LABELS: Record<AgendaKind, string> = {
  feriado: "Feriado nacional",
  no_laborable: "Día no laborable",
  especial: "Fecha especial",
  cumpleanos: "Cumpleaños",
  evento: "Evento",
};
export const personKey = (
  p: Pick<AgendaPerson, "persona_tipo" | "persona_id">,
) => `${p.persona_tipo}:${p.persona_id}`;
export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const argentinaToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const displayDate = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
export function birthdayItems(
  people: AgendaPerson[],
  year: number,
): CalendarItem[] {
  return people.flatMap((p) => {
    if (!p.mes || !p.dia) return [];
    const date = new Date(year, p.mes - 1, p.dia);
    if (date.getMonth() !== p.mes - 1) return []; // Feb. 29 stays on Feb. 29 in leap years.
    return [
      {
        id: "birthday-" + personKey(p),
        title: `Cumpleaños de ${p.nombre}`,
        date: dateKey(date),
        kind: "cumpleanos" as const,
        description:
          p.persona_tipo === "empleado"
            ? "Personal · " + (p.detalle || "Sin especialidad")
            : "Usuario PEIE · " + (p.detalle || "Usuario"),
      },
    ];
  });
}
export function monthCells(year: number, month: number): (string | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= days; day++)
    cells.push(dateKey(new Date(year, month, day)));
  while (cells.length % 7) cells.push(null);
  return cells;
}
export function specialDays(year: number): CalendarItem[] {
  const sunday = (month: number) => {
    const first = new Date(year, month - 1, 1);
    return String(1 + ((7 - first.getDay()) % 7) + 14).padStart(2, "0");
  };
  return [
    [
      "04-22",
      "Día del Trabajador de la Construcción",
      "https://www.uocra.org/pdf/ee025d_Conv_HA.pdf",
    ],
    [
      "06-" + sunday(6),
      "Día del Padre",
      "https://www4.hcdn.gob.ar/dependencias/dsecretaria/Periodo2024/PDF2024/TP2024/4334-D-2024.pdf",
    ],
    [
      "07-20",
      "Día del Amigo",
      "https://sde.gob.ar/2024/07/20/cada-20-de-julio-se-celebra-el-dia-del-amigo-en-argentina/",
    ],
    [
      "09-11",
      "Día del Maestro",
      "https://www.argentina.gob.ar/noticias/11-septiembre-dia-del-maestro",
    ],
    [
      "10-" + sunday(10),
      "Día de la Madre",
      "https://buenosaires.gob.ar/areas/cultura/cpphc/boletines/boletin_octubre07.pdf",
    ],
    ["06-15", "Día del Libro", "https://www.argentina.gob.ar/node/504153"],
    [
      "07-13",
      "Día del Trabajador de la Energía Eléctrica",
      "https://servicios.infoleg.gob.ar/infolegInternet/anexos/155000-159999/158631/norma.htm",
    ],
    [
      "09-21",
      "Día de la Primavera",
      "https://www.argentina.gob.ar/noticias/festejo-del-dia-de-la-primavera-en-el-hospital",
    ],
    [
      "10-21",
      "Día Mundial del Ahorro de Energía",
      "https://www.argentina.gob.ar/node/446287",
    ],
    [
      "11-10",
      "Día de la Tradición",
      "https://www.argentina.gob.ar/noticias/10-de-noviembre-dia-de-la-tradicion",
    ],
  ].map(([md, title, source]) => ({
    id: "special-" + md,
    title,
    date: `${year}-${md}`,
    kind: "especial",
    description:
      "Efeméride. No implica feriado nacional; las condiciones laborales pueden depender del convenio.",
    source,
  }));
}
export function eventMessage(event: AgendaEvent, name: string, url: string) {
  return [
    `Hola ${name}, te vinculamos a un evento de PEIE.`,
    "",
    `*${event.titulo}*`,
    displayDate(event.fecha) +
      (event.hora
        ? " · " + event.hora.slice(0, 5) + " h (Argentina)"
        : " · Todo el día"),
    event.lugar ? "Lugar: " + event.lugar : "",
    event.descripcion,
    "",
    url,
  ]
    .filter(Boolean)
    .join("\n");
}
