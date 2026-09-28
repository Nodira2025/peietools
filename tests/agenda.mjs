import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";
const server = await createServer({
  cacheDir: "scratch/vite-agenda",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "agenda-fixture",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!["/agenda", "/avisos"].includes(req.url?.split("?")[0]))
            return next();
          const html = (await readFile("index.html", "utf8")).replace(
            "/src/main.tsx",
            "/tests/fixtures/agenda.tsx",
          );
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml(req.url, html));
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const base = server.resolvedUrls.local[0];
  await mkdir("scratch/agenda", { recursive: true });
  const people = [
    {
      persona_tipo: "empleado",
      persona_id: "electricista",
      nombre: "Electricista de prueba",
      detalle: "Electricista",
      whatsapp: "5493810000000",
      mes: 10,
      dia: 4,
    },
    {
      persona_tipo: "perfil",
      persona_id: "admin",
      nombre: "Administración de prueba",
      detalle: "admin",
      whatsapp: "5493810000001",
      mes: null,
      dia: null,
    },
  ];
  for (const width of [390, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      serviceWorkers: "block",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let events = [];
    let unavailable = false;
    let failSave = false;
    let lastPayload;
    await page.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      const fulfill = (data) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (u.pathname === "/.netlify/functions/feriados")
        return route.fulfill({ status: 503, body: "offline" });
      if (!u.pathname.startsWith("/rest/v1/"))
        return u.origin === new URL(base).origin
          ? route.continue()
          : route.abort();
      const name = u.pathname.split("/").pop();
      if (unavailable)
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ code: "PGRST202", message: "not found" }),
        });
      const body = route.request().postDataJSON();
      if (name === "agenda_personas") return fulfill(people);
      if (name === "agenda_guardar") {
        lastPayload = body;
        if (failSave)
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "No se pudo guardar. Reintentá." }),
          });
        const event = {
          id: body.p_id || "event-1",
          titulo: body.p_titulo,
          descripcion: body.p_descripcion,
          fecha: body.p_fecha,
          hora: body.p_hora,
          lugar: body.p_lugar,
          creado_por: "admin",
          agenda_vinculos: body.p_personas.map((p) => ({
            persona_tipo: p.tipo,
            persona_id: p.id,
            avisar: body.p_avisar,
            leido_en: null,
          })),
        };
        events = [event];
        return fulfill(event.id);
      }
      if (name === "agenda_quitar") {
        events = [];
        return fulfill(null);
      }
      if (name === "agenda_cumple_guardar") {
        const p = people.find((p) => p.persona_id === body.p_id);
        p.mes = body.p_mes;
        p.dia = body.p_dia;
        return fulfill(null);
      }
      if (name === "agenda_vinculos")
        return fulfill(
          events
            .filter((e) =>
              e.agenda_vinculos.some(
                (v) => v.persona_id === "admin" && v.avisar,
              ),
            )
            .map((e) => ({ evento_id: e.id, agenda_eventos: e })),
        );
      if (name === "agenda_eventos") return fulfill(events);
      return fulfill(null);
    });
    await page.goto(base + "agenda");
    await page
      .getByRole("button", { name: "Nuevo evento", exact: true })
      .waitFor();
    await page.getByLabel("Mes de la agenda").fill("2026-10");
    await page
      .getByRole("button", { name: /Feriado nacional · 12\/10/ })
      .waitFor();
    await page
      .getByRole("button", { name: /Cumpleaños de Electricista/ })
      .waitFor();
    await page
      .getByRole("button", { name: "Nuevo evento", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Título", { exact: true })
      .fill("Capacitación de seguridad");
    await dialog.getByLabel("Fecha", { exact: true }).fill("2026-10-06");
    await dialog.getByLabel("Hora (opcional)").fill("09:00");
    await dialog.getByLabel(/Electricista de prueba/).check();
    await dialog.getByLabel(/Administración de prueba/).check();
    await dialog.getByLabel(/Avisar dentro de PEIE/).check();
    failSave = true;
    await dialog.getByRole("button", { name: "Guardar evento" }).click();
    await dialog.getByRole("alert").waitFor();
    assert.equal(
      await dialog.getByLabel("Título", { exact: true }).inputValue(),
      "Capacitación de seguridad",
    );
    failSave = false;
    await dialog.getByRole("button", { name: "Guardar evento" }).click();
    await page
      .getByRole("dialog")
      .getByRole("heading", { name: "Capacitación de seguridad", exact: true })
      .waitFor();
    assert.equal(lastPayload.p_personas.length, 2);
    assert.equal(lastPayload.p_avisar, true);
    await page
      .getByRole("button", { name: "Avisar por WhatsApp" })
      .first()
      .click();
    const preview = page
      .getByRole("dialog")
      .filter({ hasText: "Notificación de WhatsApp" });
    assert.equal(
      await preview.locator("#preview-phone").inputValue(),
      "5493810000000",
    );
    assert.match(
      await preview.locator("#preview-msg").inputValue(),
      /Capacitación de seguridad/,
    );
    await preview.getByRole("button", { name: "Omitir" }).click();
    await page.goto(base + "avisos");
    await page
      .getByRole("link", { name: /Capacitación de seguridad/ })
      .waitFor();
    await page.goto(
      base + "agenda?evento=" + events[0].id + "&fecha=2026-10-06",
    );
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Título", { exact: true })
      .fill("Capacitación actualizada");
    await dialog.getByRole("button", { name: "Guardar evento" }).click();
    await page
      .getByRole("dialog")
      .getByRole("heading", { name: "Capacitación actualizada" })
      .waitFor();
    assert.equal(
      lastPayload.p_avisar,
      false,
      "Editing does not notify without opting in",
    );
    await page
      .getByRole("button", { name: "Quitar evento", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirmar quitar" }).click();
    await page
      .getByText("Evento quitado de la agenda.", { exact: true })
      .waitFor();
    assert.equal(events.length, 0);
    await page
      .getByRole("button", { name: "Cumpleaños", exact: true })
      .first()
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Persona", { exact: true })
      .selectOption("perfil:admin");
    await dialog.getByLabel("Mes de cumpleaños").fill("10");
    await dialog.getByLabel("Día de cumpleaños").fill("7");
    await dialog.getByRole("button", { name: "Guardar cumpleaños" }).click();
    await page
      .getByRole("button", { name: /Cumpleaños de Administración/ })
      .waitFor();
    await page.screenshot({
      path: `scratch/agenda/${width}.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "No horizontal overflow",
    );
    unavailable = true;
    await page.reload();
    await page.getByLabel("Mes de la agenda").fill("2026-10");
    await page
      .getByRole("alert")
      .filter({ hasText: "todavía no está habilitada" })
      .waitFor();
    assert.ok(
      await page
        .getByRole("button", { name: "Nuevo evento", exact: true })
        .isDisabled(),
    );
    await page
      .getByRole("button", { name: /Feriado nacional · 12\/10/ })
      .waitFor();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS ${width}px: calendar, holidays fallback, birthdays, atomic save payload, failure/retry, multi recipients, WhatsApp draft, notification, edit, delete, backend missing`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
