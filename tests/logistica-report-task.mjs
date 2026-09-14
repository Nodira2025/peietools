import assert from 'node:assert/strict';
import { readFile, realpath, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ cacheDir: 'scratch/vite-logistica-test', server: { host: '127.0.0.1', port: 0, fs: { allow: [process.cwd(), await realpath('node_modules')] } }, plugins: [{ name: 'logistica-test', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    if (!req.url.startsWith('/__logistica')) return next();
    const html = (await readFile('index.html', 'utf8')).replace('/src/main.tsx', '/tests/fixtures/logistica-report-task.tsx');
    res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml('/__logistica', html));
  });
} }] });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = server.resolvedUrls.local[0];
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
      assert.ok(['GET', 'HEAD'].includes(route.request().method()), 'No reports or messages may be sent');
      const rows = {
        profiles: [{ id: 'office-user', full_name: 'Persona Oficina', role: 'admin', whatsapp: null }],
        empleados: [{ id: 'employee-user', full_name: 'Persona Obra', specialty: 'Electricista', obra_id: null }],
      }[url.pathname.split('/').at(-1)] || [];
      await route.fulfill({ contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: JSON.stringify(rows) });
    });
    await page.goto(base + '__logistica?nuevaCompra=true');
    await page.getByRole('heading', { name: 'Panel de Logística' }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0, 'Legacy purchase URL must not open hidden form');
    assert.equal(await page.getByRole('button', { name: /Reportar Compra/ }).count(), 0);
    await page.getByRole('button', { name: 'Registro de Compras', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reportar Tarea', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: 'Reportar Tarea', exact: true }).waitFor();
    await dialog.getByRole('button', { name: /Personal en Obra \(1\)/ }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: /Abrir WhatsApp/ }).isDisabled(), true);
    await dialog.locator('select').nth(1).selectOption('employee-user');
    assert.equal(await dialog.getByRole('button', { name: /Abrir WhatsApp/ }).isEnabled(), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    await mkdir('scratch/logistica-qa', { recursive: true });
    await page.screenshot({ path: 'scratch/logistica-qa/report-task-' + width + '.png' });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    if (width === 390) {
      await page.goto(base + '__logistica?view=dashboard');
      await page.getByText('Reportar Tarea', { exact: true }).click();
      await page.getByRole('dialog').getByRole('heading', { name: 'Reportar Tarea' }).waitFor();
      assert.equal(await page.getByText('Reportar Compra', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log('PASS ' + width + 'px: purchase hidden, legacy URL blocked, shared task form opens, no submissions');
  }
} finally { await browser?.close(); await server.close(); }
