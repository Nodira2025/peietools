// Run with node tests/personal-pages-regression.mjs (Playwright + Chrome required).
// All backend requests are intercepted; no real employee data is read or written.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'personal-fixture', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!['/personal', '/personal-datos'].includes(req.url.split('?')[0])) return next();
      try {
        const html = (await readFile('index.html', 'utf8')).replace('/src/main.tsx', '/tests/fixtures/personal-pages.tsx');
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml(req.url, html));
      } catch (error) { next(error); }
    });
  } }],
});
let browser;
let failures = 0;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const origin = server.resolvedUrls.local[0];
  async function test(name, run, options = {}) {
    const context = await browser.newContext({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const calls = [];
    const errors = [];
    let saved = { empleado_id: 'worker-1', dni: '30123456', domicilio: 'Domicilio de prueba', legajo: 'P-1' };
    page.on('pageerror', error => errors.push(error.message));
    await context.routeWebSocket('wss://*.supabase.co/**', () => {});
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(origin).origin) return route.continue();
      if (!url.hostname.endsWith('.supabase.co')) return route.abort();
      const table = url.pathname.split('/').at(-1);
      const method = route.request().method();
      calls.push({ table, method, payload: route.request().postDataJSON() });
      let data = [];
      if (table === 'empleados') data = [{ id: 'worker-1', full_name: 'Trabajador de prueba', specialty: 'Oficial', whatsapp: '3810000000', obra_id: 'work-1', photo_url: null, status: 'Trabajando', obras: { name: 'Obra de prueba', encargado_name: null } }];
      if (table === 'obras') data = [{ id: 'work-1', name: 'Obra de prueba', active: true }];
      if (table === 'empleados_legajos') {
        if (options.unavailable) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: 'Missing table' }) });
        if (method === 'POST') { saved = route.request().postDataJSON(); data = { empleado_id: saved.empleado_id }; }
        else data = [saved];
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    try {
      await run(page, calls);
      assert.equal(errors.length, 0, [...new Set(errors)].join('\n'));
      assert.equal(await page.getByText('Algo salió mal', { exact: true }).count(), 0);
      console.log(`PASS: ${name}`);
    } catch (error) { failures++; console.error(`FAIL: ${name}: ${error.message}`); }
    finally { await context.close(); }
  }

  await test('Personal retains the basic profile and never requests private records', async (page, calls) => {
    await page.goto(`${origin}personal`);
    await page.getByRole('button', { name: 'Ver', exact: true }).click();
    const dialog = page.getByRole('dialog');
    assert.equal(await dialog.getByRole('textbox').count(), 3);
    assert.equal(await dialog.getByLabel('DNI', { exact: true }).count(), 0);
    await dialog.getByLabel('Nombre Completo').fill('Trabajador actualizado');
    await dialog.getByRole('button', { name: 'Guardar Cambios' }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(calls.some(call => call.table === 'empleados' && call.method === 'PATCH'));
    assert.ok(!calls.some(call => call.table === 'empleados_legajos'));
    await page.getByRole('button', { name: 'Nuevo Operario', exact: true }).click();
    assert.equal(await page.getByRole('dialog').getByRole('textbox').count(), 3);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('link', { name: 'Personal Datos', exact: true }).click();
    await page.getByRole('heading', { name: 'Personal Datos', exact: true }).waitFor();
  });
  await test('Personal Datos reads and saves the existing private record only', async (page, calls) => {
    await page.goto(`${origin}personal-datos`);
    await page.getByRole('button', { name: /Trabajador de prueba/ }).click();
    assert.equal(await page.getByLabel('DNI', { exact: true }).inputValue(), '30123456');
    await page.getByLabel('Domicilio', { exact: true }).fill('Nuevo domicilio de prueba');
    await page.getByRole('button', { name: 'Guardar datos', exact: true }).click();
    await page.getByText('Datos guardados', { exact: true }).waitFor();
    assert.ok(calls.some(call => call.table === 'empleados_legajos' && call.method === 'POST' && call.payload.domicilio === 'Nuevo domicilio de prueba'));
    assert.ok(!calls.some(call => call.table === 'empleados' && call.method !== 'GET'));
    await page.reload();
    await page.getByLabel('Domicilio', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Domicilio', { exact: true }).inputValue(), 'Nuevo domicilio de prueba');
  });
  await test('unavailable legajos cannot be overwritten or exported', async page => {
    await page.goto(`${origin}personal-datos`);
    await page.getByRole('button', { name: /Trabajador de prueba/ }).click();
    assert.equal(await page.getByRole('button', { name: 'Guardar datos' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Exportar datos' }).isDisabled(), true);
    assert.equal(await page.getByLabel('DNI', { exact: true }).isDisabled(), true);
  }, { unavailable: true });
  await test('unauthorized roles never fetch private data', async (page, calls) => {
    await page.goto(`${origin}personal-datos?role=encargado`);
    await page.getByText('Los legajos están disponibles para Administración y Logística.').waitFor();
    assert.ok(!calls.some(call => call.table === 'empleados_legajos'));
  });
  await test('mobile personal data editor fits the viewport', async page => {
    await page.goto(`${origin}personal-datos?empleado=worker-1`);
    await page.getByLabel('DNI', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  }, { mobile: true });
} finally { await browser?.close(); await server.close(); }
process.exitCode = failures ? 1 : 0;
