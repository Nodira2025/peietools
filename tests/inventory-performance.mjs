// Run after: npm run build -- --outDir scratch/performance-dist --manifest
// Synthetic inventory only; no production backend requests or writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'inventory-performance', configureServer(server) {
    server.middlewares.use('/__inventory-performance', async (_req, res, next) => {
      try {
        const html = (await readFile('index.html', 'utf8'))
          .replace('/src/main.tsx', '/tests/fixtures/inventory-performance.tsx');
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml('/__inventory-performance', html));
      } catch (error) { next(error); }
    });
  } }],
});
let browser;
let production;
let releasePhotos;
const photoGate = new Promise(resolve => { releasePhotos = resolve; });
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const base = server.resolvedUrls.local[0];
  const photos = [];
  const queries = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const inventory = Array.from({ length: 40 }, (_, index) => ({
    id: `tool-${index}`, code: `AM-${index}`, name: `Amoladora de prueba ${index}`,
    brand: 'Bosch', model: null, category: 'Amoladoras', status: 'Disponible',
    current_obra_id: null, obras: null,
  }));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
    assert.equal(request.method(), 'GET');
    const select = url.searchParams.get('select');
    queries.push(select);
    let data = [];
    if (url.pathname.endsWith('/herramientas')) {
      if (select === 'photo_url') {
        assert.ok(url.searchParams.get('id')?.startsWith('eq.tool-'));
        photos.push(url.searchParams.get('id'));
        await photoGate;
        data = { photo_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' };
      } else if (select === 'category') data = [{ category: 'Amoladoras' }];
      else {
        assert.ok(!select.includes('photo_url'), 'Inventory must not download photos');
        data = inventory;
      }
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(`${base}__inventory-performance`);
  await page.getByText('40 unidades', { exact: true }).waitFor();
  assert.equal(photos.length, 0, 'Category view must not request tool photos');
  await page.getByText('Amoladoras', { exact: true }).click();
  await page.getByRole('heading', { name: 'Amoladora de prueba 0', exact: true }).waitFor();
  await page.waitForRequest(request => new URL(request.url()).searchParams.get('select') === 'photo_url');
  assert.ok(photos.length < 40, 'Offscreen cards must not download their photos');
  // Search works while every visible photo is still waiting for the network.
  await page.getByPlaceholder('Buscar por nombre, código o marca...').fill('Amoladora de prueba 39');
  await page.getByRole('heading', { name: 'Amoladora de prueba 39', exact: true }).waitFor();
  releasePhotos();
  await page.getByRole('img', { name: 'Amoladora de prueba 39', exact: true }).waitFor();
  assert.ok(photos.includes('eq.tool-39'));
  assert.deepEqual(errors, []);
  console.log('PASS: inventory loads without photos; search stays usable; visible photos load separately');
  await page.close();

  production = await preview({ build: { outDir: 'scratch/performance-dist' }, preview: { host: '127.0.0.1', port: 0 } });
  const login = await browser.newPage({ serviceWorkers: 'block' });
  const scripts = [];
  const loginErrors = [];
  login.on('pageerror', error => loginErrors.push(error.message));
  login.on('request', req => { if (req.url().endsWith('.js')) scripts.push(req.url()); });
  await login.goto(production.resolvedUrls.local[0] + 'login');
  await login.locator('input[type="password"]').waitFor();
  assert.ok(!scripts.some(url => /Herramientas-|Personal-|Reportes-|xlsx-|CentroOperaciones-/.test(url)), 'Login must not load unrelated pages');
  assert.deepEqual(loginErrors, []);
  console.log('PASS: production login loads without inventory, payroll, reports, or map modules');
} finally {
  releasePhotos();
  await browser?.close();
  if (production) await new Promise(resolve => production.httpServer.close(resolve));
  await server.close();
}
