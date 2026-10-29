import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ cacheDir: 'scratch/bajas/vite', server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'bajas-fixture', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!['/dados-de-baja', '/herramientas/test-tool', '/personal', '/herramientas'].includes(req.url.split('?')[0])) return next();
      try {
        const html = (await readFile('index.html', 'utf8')).replace('/src/main.tsx', '/tests/fixtures/personal-pages.tsx');
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml(req.url, html));
      } catch (error) { next(error); }
    });
  },
}] });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = server.resolvedUrls.local[0];
  for (const mode of ['success', 'cancel', 'denied', 'empty', 'archive', 'archive-error', 'unauthorized']) {
    const context = await browser.newContext({ viewport: { width: mode === 'archive' ? 390 : 1280, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const writes = [], errors = [];
    const tool = { id: 'test-tool', code: 'T-001', name: 'Taladro de prueba', status: mode === 'archive' ? 'Fuera de servicio' : 'Disponible', category: 'Taladro', current_obra_id: null, obras: null };
    page.on('pageerror', error => errors.push(error.message));
    await context.routeWebSocket('wss://*.supabase.co/**', () => {});
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (!url.hostname.endsWith('.supabase.co')) return route.abort();
      const table = url.pathname.split('/').at(-1);
      if (req.method() !== 'GET') writes.push({ table, method: req.method(), payload: req.postDataJSON() });
      let data = [];
      if (table === 'herramientas') {
        if (req.method() === 'PATCH') {
          if (mode === 'denied') return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'Sin permiso' }) });
          if (mode === 'empty') return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'No se confirmó la actualización' }) });
          Object.assign(tool, req.postDataJSON()); data = tool;
        } else if (url.searchParams.has('id')) data = tool;
        else if (url.searchParams.get('status') === 'eq.Fuera de servicio') data = tool.status === 'Fuera de servicio' ? [tool] : [];
        else if (url.searchParams.get('status') === 'neq.Fuera de servicio') data = tool.status === 'Fuera de servicio' ? [] : [tool];
        else data = [tool];
      }
      if (table === 'empleados' && url.searchParams.get('active') === 'eq.false') {
        if (mode === 'archive-error') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Fallo temporal' }) });
        data = [{ id: 'worker-old', full_name: 'Operario inactivo de prueba', specialty: 'Oficial', obras: { name: 'Obra anterior' } }];
      }
      if (table === 'traslados_personal' && url.searchParams.get('empleado_id') === 'eq.worker-old') data = [{ id: 'move-old', created_at: '2026-09-10T12:00:00Z', status: 'Confirmado', source: { name: 'Obra A' }, target: { name: 'Obra B' } }];
      if (table === 'movimientos' && req.method() === 'GET') data = [{ id: 'old-movement', action: 'Movimiento anterior conservado', created_at: '2026-09-10T12:00:00Z', profiles: { full_name: 'Prueba' } }];
      if (table === 'solicitudes' && url.searchParams.get('herramienta_id') === 'eq.test-tool') data = [{ id: 'old-request', comments: 'Movimiento anterior conservado', status: 'Confirmada', created_at: '2026-09-10T12:00:00Z', source_obra: { name: 'Obra A' }, target_obra: { name: 'Obra B' } }];
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    if (mode === 'archive' || mode === 'archive-error') {
      await page.goto(`${base}dados-de-baja?tipo=personal`);
      if (mode === 'archive-error') {
        await page.getByRole('alert').filter({ hasText: 'No se pudieron cargar' }).waitFor();
        assert.equal(await page.getByText('No se encontraron registros dados de baja.').count(), 0);
      } else {
        await page.getByRole('heading', { name: 'Operario inactivo de prueba' }).waitFor();
        await page.getByRole('button', { name: 'Ver ficha e historial' }).click();
        await page.getByText('Obra A → Obra B').waitFor();
        assert.ok(await page.getByRole('link', { name: 'Consultar legajo' }).isVisible());
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Herramientas', exact: true }).click();
        await page.getByRole('heading', { name: tool.name }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await mkdir('output/bajas', { recursive: true });
        await page.screenshot({ path: 'output/bajas/archivo-mobile.png', fullPage: true });
        await page.getByRole('link', { name: 'Ver ficha e historial' }).click();
        await page.getByText('Movimiento anterior conservado', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Reservar con Fecha (Agendar)' }).isDisabled(), true);
        await page.goto(`${base}herramientas`);
        await page.getByRole('button', { name: 'Dados de baja / Fuera de servicio' }).waitFor();
        assert.equal(await page.getByText(tool.name, { exact: true }).count(), 0);
      }
      assert.equal(writes.length, 0);
    } else {
      await page.goto(`${base}herramientas/test-tool${mode === 'unauthorized' ? '?role=encargado' : ''}`);
      await page.getByText(tool.name, { exact: true }).first().waitFor();
      if (mode === 'unauthorized') assert.equal(await page.getByRole('button', { name: 'Dar de baja', exact: true }).count(), 0);
      else {
        page.once('dialog', dialog => mode === 'cancel' ? dialog.dismiss() : dialog.accept());
        await page.getByRole('button', { name: 'Dar de baja', exact: true }).click();
        if (mode === 'success') {
          await page.getByRole('heading', { name: 'Dados de baja', exact: true }).waitFor();
          await page.getByRole('heading', { name: tool.name }).waitFor();
          assert.deepEqual(writes.find(call => call.table === 'herramientas').payload, { status: 'Fuera de servicio' });
          await page.reload();
          await page.getByRole('heading', { name: tool.name }).waitFor();
        } else if (mode === 'cancel') assert.equal(writes.length, 0);
        else await page.getByText('No se pudo dar de baja', { exact: true }).first().waitFor();
      }
    }
    assert.ok(!writes.some(call => call.method === 'DELETE'));
    assert.deepEqual(errors, []);
    console.log(`PASS: bajas ${mode}`);
    await context.close();
  }
} finally { await browser?.close(); await server.close(); }
