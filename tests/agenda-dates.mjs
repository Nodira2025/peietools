import assert from "node:assert/strict";
import { createServer } from "vite";
import holidayHandler from "../netlify/functions/feriados.mjs";
const server = await createServer({
  cacheDir: "scratch/vite-agenda-dates",
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { birthdayItems, monthCells, specialDays, eventMessage } =
    await server.ssrLoadModule("/src/lib/agenda.ts");
  const person = {
    persona_tipo: "empleado",
    persona_id: "p",
    nombre: "Persona",
    detalle: "Electricista",
    mes: 2,
    dia: 29,
  };
  assert.equal(birthdayItems([person], 2026).length, 0);
  assert.equal(birthdayItems([person], 2028)[0].date, "2028-02-29");
  assert.equal(birthdayItems([{ ...person, mes: null }], 2026).length, 0);
  const feb = monthCells(2028, 1);
  assert.equal(feb.filter(Boolean).length, 29);
  assert.equal(feb.length % 7, 0);
  assert.equal(monthCells(2026, 9)[3], "2026-10-01");
  assert.equal(
    specialDays(2026).find((e) => e.title === "Día de la Madre").date,
    "2026-10-18",
  );
  assert.equal(
    specialDays(2026).find((e) => e.title === "Día del Padre").date,
    "2026-06-21",
  );
  const message = eventMessage(
    {
      titulo: "Encuentro",
      fecha: "2026-01-01",
      hora: "00:00",
      lugar: "Oficina",
      descripcion: "Prueba",
    },
    "Persona",
    "https://example.test/agenda",
  );
  assert.match(message, /1 de enero de 2026/);
  assert.match(message, /00:00/);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        mainEntity: {
          itemListElement: [
            {
              item: {
                name: "Día turístico",
                startDate: "2026-07-10",
                additionalProperty: { value: "turistico" },
              },
            },
          ],
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  try {
    assert.equal(
      (
        await holidayHandler(
          new Request("https://example.test?year=../../../x"),
        )
      ).status,
      400,
    );
    const result = await (
      await holidayHandler(new Request("https://example.test?year=2026"))
    ).json();
    assert.equal(result.events[0].kind, "no_laborable");
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log(
    "PASS dates: leap years, calendar weekdays, annual special dates, Argentina event time, holiday classification and endpoint validation",
  );
} finally {
  await server.close();
}
