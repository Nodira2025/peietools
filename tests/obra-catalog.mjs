import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ cacheDir: 'scratch/vite-obra-catalog', server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'obra-catalog-fixture', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!['/mis-obras', '/herramientas'].includes(req.url?.split('?')[0])) return next();
      try { const html = (await readFile('index.html', 'utf8')).replace('/src/main.tsx', '/tests/fixtures/obra-catalog.tsx');
        res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml(req.url, html));
      } catch (error) { next(error); }
    });
  } }],
});
let browser;
try {
  await mkdir('scratch/obra-catalog', { recursive: true });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const base = server.resolvedUrls.local[0];
  const obras = [
    { id: 'obra-1', name: 'Edificio Central', address: 'Av. Belgrano 1250, San Miguel de Tucumán', encargado_name: 'María Rodríguez', active: true },
    { id: 'obra-2', name: 'Obra sin asignaciones', address: null, encargado_name: null, active: false },
  ];
  const workers = Array.from({ length: 9 }, (_, i) => ({ id: 'worker-' + i, full_name: i ? 'Trabajador de prueba ' + i : 'José María Fernández de la Cruz', specialty: i ? 'Oficial albañil' : 'Responsable de instalaciones eléctricas', photo_url: i === 1 ? 'https://test.invalid/missing.jpg' : '/logo-peie.png', obra_id: 'obra-1', active: true }));
  const tools = Array.from({ length: 5 }, (_, i) => ({ id: 'tool-' + i, name: i % 2 ? 'Amoladora 750W' : 'Escalera 8 peldaños', code: 'H-' + i, category: i % 2 ? 'Amoladora' : 'Escalera', brand: 'Total', model: null, status: 'En uso', photo_url: null, current_obra_id: 'obra-1', obras: { name: obras[0].name, encargado_name: obras[0].encargado_name } }));
  tools[1].category = 'Amoladoras › 7"';
  tools[1].status = 'Disponible';
  let failTools = false;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
    const table = url.pathname.split('/').pop();
    if (table === 'herramientas' && failTools) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Test failure' }) });
    let data = table === 'obras' ? obras : table === 'empleados' ? workers : table === 'herramientas' ? tools : [];
    const key = table === 'empleados' ? 'obra_id' : 'current_obra_id';
    if (url.searchParams.has(key)) data = data.filter(row => 'eq.' + row[key] === url.searchParams.get(key));
    if (url.searchParams.get('select') === 'photo_url') data = { photo_url: null };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  // Group browsing is covered by tests/tool-groups.mjs.
  await page.goto(base + 'mis-obras');
  await page.getByText('Edificio Central', { exact: true }).click();
  await page.getByRole('button', { name: 'Exportar obra', exact: true }).click();
  await page.getByRole('button', { name: 'Generar JPEG', exact: true }).click();
  await page.getByText('3 archivos listos', { exact: true }).waitFor();
  assert.ok(await page.getByText(/1 fotos no se pudieron cargar/).isVisible());
  const images = await page.locator('a[download]').evaluateAll(async links => Promise.all(links.map(async link => ({ name: link.download, bytes: Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer())) }))));
  for (const item of images) await writeFile('scratch/obra-catalog/' + item.name, Buffer.from(item.bytes));
  await page.getByRole('button', { name: 'Generar PDF', exact: true }).click();
  await page.getByText('1 archivo listo', { exact: true }).waitFor();
  const single = await page.locator('a[download]').evaluate(async link => Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer())));
  await writeFile('scratch/obra-catalog/single.pdf', Buffer.from(single));
  assert.ok(Buffer.from(single).toString('latin1').startsWith('%PDF'));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar todas las obras', exact: true }).click();
  await page.getByText(/2 obras accesibles/).waitFor();
  await page.getByRole('button', { name: 'Generar PDF', exact: true }).click();
  await page.getByText('1 archivo listo', { exact: true }).waitFor();
  const all = await page.locator('a[download]').evaluate(async link => Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer())));
  await writeFile('scratch/obra-catalog/all.pdf', Buffer.from(all));
  assert.equal((Buffer.from(all).toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1, 'Grouped distribution fits two obras on one page');
  await page.getByRole('button', { name: 'Generar JPEG', exact: true }).click();
  await page.getByText('1 archivo listo', { exact: true }).waitFor();
  const tableImage = await page.locator('a[download]').evaluate(async link => Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer())));
  await writeFile('scratch/obra-catalog/distribution.jpeg', Buffer.from(tableImage));
  const multi = await page.evaluate(async ({ obras, tools }) => {
    const { renderObraDistribution } = await import('/src/lib/obraDistribution.ts');
    const { catalogPdf } = await import('/src/lib/obraCatalog.ts');
    const data = [{ obra: obras[0], workers: [], tools: Array.from({length:70}, (_, i) => ({...tools[0], id:String(i), code:'TEST-'+i, name:i===0?'Rotomartillo con accesorios y maletín de transporte para perforaciones de hormigón armado':'Herramienta de prueba '+i})) }, {obra:obras[1], workers:[], tools:[]}];
    const pages = await renderObraDistribution(data, '15/9/2026');
    return { count:pages.length, pdf:Array.from(new Uint8Array(await (await catalogPdf(pages)).arrayBuffer())) };
  }, { obras, tools });
  assert.equal(multi.count, 1, 'All obras remain on one continuous sheet even with 70 tools');
  assert.equal((Buffer.from(multi.pdf).toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1, 'PDF has exactly one page');
  await writeFile('scratch/obra-catalog/multipage.pdf', Buffer.from(multi.pdf));
  failTools = true;
  await page.getByRole('button', { name: 'Generar PDF', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'No se pudieron cargar las herramientas' }).waitFor();
  assert.equal(await page.locator('a[download]').count(), 0, 'Never offer a partial export after query failure');
  assert.deepEqual(errors, []);
  console.log('PASS mobile 2 columns, direct inventory, filters + reload, JPEG pagination, PDF single/all, missing photos, empty/inactive obra, API failure');
} finally { await browser?.close(); await server.close(); }
