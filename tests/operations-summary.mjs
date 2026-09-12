import assert from 'node:assert/strict';
import { readFile, mkdir, realpath } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ cacheDir: 'scratch/vite-operations-test', server: { host: '127.0.0.1', port: 0, fs: { allow: [process.cwd(), await realpath('node_modules')] } }, optimizeDeps: { exclude: ['maplibre-gl'] }, plugins: [{ name: 'operations-test', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    if (!req.url.startsWith('/__operations')) return next();
    const html = (await readFile('index.html', 'utf8')).replace('/src/main.tsx', '/tests/fixtures/operations-summary.tsx');
    res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml('/__operations', html));
  });
} }] });
let browser;
try {
  const { laborMetrics, progressFor } = await server.ssrLoadModule('/src/services/operations/worksiteMetrics.ts');
  const employee = { id: 'e1', full_name: 'Ana', obra_id: 'b', valor_hora: 1000 };
  const records = [{ obra_id: 'a', empleado_id: 'e1', horas_trabajadas: 8 }, { obra_id: 'b', empleado_id: 'e1', horas_trabajadas: 4 }, { empleado_id: 'e1', horas_trabajadas: 10 }];
  assert.equal(laborMetrics({ id: 'a', name: 'A' }, records, [employee], {}).totalLaborCost, 8000);
  assert.equal(laborMetrics({ id: 'b', name: 'B' }, records, [employee], {}).totalLaborHours, 4);
  assert.equal(progressFor('a', { a: { avanceFinal: 100, esMuestra: true } }).progressPercent, null);
  assert.equal(progressFor('a', { a: { avanceFinal: 0, esMuestra: false } }).progressPercent, 0);
  assert.equal(progressFor('a', { a: { avanceFinal: 100 } }).progressPercent, 100);
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const base = server.resolvedUrls.local[0];
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const tile = Buffer.from(await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; const context = canvas.getContext('2d'); context.fillStyle = '#eaf0f5'; context.fillRect(0, 0, 256, 256); return canvas.toDataURL().split(',')[1]; }), 'base64');
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('peie_coordinadores_obra_estado_final_cache', JSON.stringify({ a: { avanceFinal: 65, esMuestra: false }, b: { avanceFinal: 100, esMuestra: false }, c: { avanceFinal: 25, esMuestra: true } }));
      localStorage.setItem('peie_herramientas_custom_prices', JSON.stringify({ t1: { price: 200000 } }));
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (url.hostname === 'tile.openstreetmap.org') return route.fulfill({ contentType: 'image/png', body: tile });
      if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
      assert.equal(route.request().method(), 'GET', 'Never write real or test operational data');
      const table = url.pathname.split('/').at(-1);
      const all = {
        obras: ['a', 'b', 'c'].map((id, i) => ({ id, name: `Obra ${id.toUpperCase()}`, active: true, latitude: -26.824 + i * .02, longitude: -65.222 + i * .02 })),
        empleados: [{ ...employee, status: 'Trabajando', specialty: 'oficial' }],
        herramientas: [{ id: 't1', name: 'Taladro', code: 'T1', current_obra_id: 'a', status: 'En uso' }],
        novedades_diarias: [...records, ...Array.from({ length: 505 }, () => ({ obra_id: 'a', empleado_id: 'e1', horas_trabajadas: 1 }))],
      }[table] || [];
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 500);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(all.slice(offset, offset + limit)) });
    });
    await page.goto(`${base}__operations`);
    const bubble = page.getByRole('button', { name: 'Obra A. Avance: 65%. Ver resumen de obra', exact: true });
    await bubble.waitFor();
    assert.equal(await page.locator('[data-progress-ring="100"]').getAttribute('stroke-dashoffset'), '0');
    await page.getByRole('button', { name: 'Obra C. Avance: Sin datos. Ver resumen de obra', exact: true }).waitFor();
    await bubble.hover();
    const popup = page.locator('.maplibregl-popup');
    await popup.getByText('513 h', { exact: true }).waitFor();
    await popup.getByText(/513.000/).waitFor();
    await popup.getByText('65% de 100%', { exact: true }).waitFor();
    await page.getByText('Valor total de herramientas', { exact: true }).waitFor();
    await mkdir('scratch/operations-qa', { recursive: true });
    await page.screenshot({ path: `scratch/operations-qa/hover-${width}.png` });
    await bubble.click();
    await page.getByText('Valor de herramientas en obra', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    await page.screenshot({ path: `scratch/operations-qa/detail-${width}.png`, fullPage: true });
    await page.close(); console.log(`PASS ${width}px: progress 65/100/unknown, hover, touch/click, totals, pagination, labor assignment`);
  }
} finally { await browser?.close(); await server.close(); }
