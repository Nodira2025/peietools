// Exercises the real editing page with an isolated browser and mocked API.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'tool-edit-fixture', configureServer(server) {
    server.middlewares.use('/__tool-edit', async (_req, res, next) => {
      try {
        const html = (await readFile('index.html', 'utf8'))
          .replace('/src/main.tsx', '/tests/fixtures/tool-edit-regression.tsx');
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml('/__tool-edit', html));
      } catch (error) { next(error); }
    });
  } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = server.resolvedUrls.local[0];
  for (const mode of ['success', 'denied', 'network']) {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    const errors = [];
    const writes = [];
    page.on('pageerror', error => errors.push(error.message));
    let tool = { id: 'test-tool', code: 'RTD01', qr_code: 'RTD01',
      name: 'Rotomartillo demoledor', brand: 'Barovo', model: null,
      category: 'Rotomartillo demoledor', status: 'Disponible',
      current_obra_id: null, obras: null, notes: null, description: null,
    };
    // No request can reach the real backend.
    await page.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
      let body = [];
      if (url.pathname.endsWith('/herramientas')) {
        if (req.method() === 'PATCH') {
          writes.push(req.postDataJSON());
          if (mode === 'network') return route.abort('failed');
          if (mode === 'denied') return route.fulfill({ status: 406,
            contentType: 'application/json', body: JSON.stringify({
              code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned',
            }) });
          await new Promise(resolve => setTimeout(resolve, 200));
          tool = { ...tool, ...req.postDataJSON() };
          body = tool;
        } else body = url.searchParams.has('id') ? tool : [{ category: tool.category }];
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`${base}__tool-edit`);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Marca', { exact: true }).fill('Bosch');
    await page.getByLabel('Categoría', { exact: false }).click();
    assert.equal(await page.getByRole('option', { name: 'Rotuladora', exact: true }).count(), 1);
    await page.getByRole('option', { name: 'Rotomartillo demoledor', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    if (mode === 'success') {
      await page.getByRole('button', { name: 'Editar', exact: true }).waitFor();
      assert.equal(await page.getByText('Bosch', { exact: true }).count(), 1);
      // The confirmed update survives reloading the page.
      await page.reload();
      await page.getByRole('button', { name: 'Editar', exact: true }).click();
      assert.equal(await page.getByLabel('Marca', { exact: true }).inputValue(), 'Bosch');
    } else {
      await page.getByText('Error al actualizar', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Marca', { exact: true }).inputValue(), 'Bosch');
      assert.equal(await page.getByRole('button', { name: 'Guardar', exact: true }).isEnabled(), true);
      assert.equal(await page.getByText('Información de la herramienta actualizada.', { exact: true }).count(), 0);
    }
    assert.equal(writes.length, 1);
    assert.equal(writes[0].brand, 'Bosch');
    assert.equal(writes[0].category, 'Rotomartillo demoledor');
    assert.deepEqual(errors, []);
    console.log(`PASS: tool editing ${mode}, Rotuladora available`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
