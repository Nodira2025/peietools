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
  const { hasStoredCoordinates } = await server.ssrLoadModule('/src/components/operations/operationsFeatures.ts');
  assert.equal(hasStoredCoordinates({ latitude: -26.82, longitude: -65.22 }), true);
  for (const value of [{}, { latitude: 0, longitude: 0 }, { latitude: 100, longitude: -65 }, { latitude: -26, longitude: 181 }, { latitude: Infinity, longitude: -65 }]) assert.equal(hasStoredCoordinates(value), false);
  const { buildCoordinatorDirectory } = await server.ssrLoadModule('/src/services/operations/coordinatorDirectory.ts');
  const directory = buildCoordinatorDirectory(['Carlos Grande', 'CARLOS GRANDE', 'Carlos', 'Carlos ', 'Martin Grande', 'Martín', null, '  ']);
  assert.deepEqual(directory.options.map(o => o.value), ['carlos grande', 'martin grande']);
  assert.equal(directory.resolve(' Carlos  '), 'carlos grande');
  assert.equal(directory.resolve('MARTÍN'), 'martin grande');
  const ambiguous = buildCoordinatorDirectory(['Carlos Grande', 'Carlos Perez', 'Carlos']);
  assert.equal(ambiguous.options.length, 3);
  assert.equal(ambiguous.resolve('Carlos'), 'carlos');
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
    let updatedWorksite = false;
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('peie_coordinadores_obra_estado_final_cache', JSON.stringify({ a: { avanceFinal: 65, esMuestra: false }, b: { avanceFinal: 100, esMuestra: false }, c: { avanceFinal: 25, esMuestra: true } }));
      localStorage.setItem('peie_herramientas_custom_prices', JSON.stringify({ t1: { price: 200000 } }));
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (url.hostname === 'tile.openstreetmap.org') return process.env.OPERATIONS_REAL_TILES === '1' ? route.continue() : route.fulfill({ contentType: 'image/png', body: tile });
      if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
      assert.equal(route.request().method(), 'GET', 'Never write real or test operational data');
      const table = url.pathname.split('/').at(-1);
      assert.notEqual(table, 'novedades_diarias', 'Resource view must not request labor records');
      const all = {
        obras: [...['a', 'b', 'c'].map((id, i) => ({ id, name: updatedWorksite && id === 'a' ? 'Obra A actualizada' : `Obra ${id.toUpperCase()}`, address: updatedWorksite && id === 'a' ? 'Dirección guardada en Obras' : `Calle ${i + 1}, Tucumán`, encargado_name: ['Carlos Grande', 'CARLOS GRANDE', 'Carlos '][i], active: true, latitude: updatedWorksite && id === 'a' ? -26.9 : -26.824 + i * .02, longitude: updatedWorksite && id === 'a' ? -65.3 : -65.222 + i * .02 })), { id: 'unknown', name: 'Sin coordenadas', encargado_name: 'Martin Grande', active: true }],
        empleados: [{ ...employee, status: 'Trabajando', specialty: 'oficial' }],
        herramientas: [{ id: 't1', name: 'Taladro', code: 'T1', current_obra_id: 'a', status: 'En uso' }],
        novedades_diarias: [...records, ...Array.from({ length: 505 }, () => ({ obra_id: 'a', empleado_id: 'e1', horas_trabajadas: 1 }))],
      }[table] || [];
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 500);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(all.slice(offset, offset + limit)) });
    });
    await page.goto(`${base}__operations`);
    const bubble = page.getByRole('button', { name: 'Obra A. Personal: 0. Herramientas: 1. Ver obra', exact: true });
    await bubble.waitFor();
    assert.equal(await page.locator('[data-progress-ring]').count(), 0);
    assert.equal(await page.locator('.peie-operation-bubble-marker').count(), 3);
    assert.equal(await page.getByRole('button', { name: /Sin coordenadas.*Ver obra/ }).count(), 0);
    await page.getByText('1 obra(s) sin coordenadas válidas. Disponibles en el listado.').waitFor();
    await page.getByText('Personal en obras', { exact: true }).waitFor();
    assert.equal(await page.getByText(/Costo por horas|Valor total de herramientas|Finalización de obra|Sugerencias/).count(), 0);
    await bubble.hover();
    const popup = page.locator('.maplibregl-popup');
    await popup.getByText('Calle 1, Tucumán', { exact: true }).waitFor();
    await popup.getByText('Herramientas en obra: 1', { exact: true }).waitFor();
    await mkdir('scratch/operations-qa', { recursive: true });
    await page.screenshot({ path: 'scratch/operations-qa/hover-' + width + '.png' });
    await bubble.click();
    await page.getByText('GPS: -26.824, -65.222', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Herramientas (1)' }).click();
    await page.getByText('Taladro', { exact: true }).waitFor();
    assert.equal(await page.getByText(/Costo por horas|Valor de herramientas en obra|Finalización de obra|Índice de Carga/).count(), 0);
    await page.getByRole('button', { name: 'Cerrar ficha' }).click();
    await page.getByText('Sin coordenadas', { exact: true }).click();
    await page.getByText('Ubicación pendiente de confirmar', { exact: true }).waitFor();
    const coordinatorFilter = page.getByRole('combobox', { name: 'Filtrar por encargado de obra' });
    assert.deepEqual(await coordinatorFilter.locator('option').allTextContents(), ['Todos los coordinadores', 'Carlos Grande', 'Martin Grande']);
    await coordinatorFilter.selectOption('carlos grande');
    await page.getByText('Personal y herramientas por obra', { exact: true }).waitFor();
    assert.equal(await page.locator('.peie-operation-bubble-marker').count(), 3);
    await coordinatorFilter.selectOption('martin grande');
    await page.waitForFunction(() => document.querySelectorAll('.peie-operation-bubble-marker').length === 0);
    await page.getByText('Sin coordenadas', { exact: true }).waitFor();
    await coordinatorFilter.selectOption('');
    await bubble.waitFor();
    updatedWorksite = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const updatedBubble = page.getByRole('button', { name: 'Obra A actualizada. Personal: 0. Herramientas: 1. Ver obra', exact: true });
    await updatedBubble.click();
    await page.locator('#panel-operativo').getByText('Dirección guardada en Obras', { exact: true }).waitFor();
    await page.getByText('GPS: -26.9, -65.3', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    await page.screenshot({ path: 'scratch/operations-qa/detail-' + width + '.png', fullPage: true });
    await page.close(); console.log(`PASS ${width}px: resources only, stored coordinates, hover address, touch/click, no financial requests`);
  }
} finally { await browser?.close(); await server.close(); }
