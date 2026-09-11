// Run with node tests/select-dom-regression.mjs (Playwright + Chrome required).
// Uses synthetic data and never connects to the production backend.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{
    name: 'select-regression-fixture',
    configureServer(server) {
      server.middlewares.use('/__select-regression', async (_req, res, next) => {
        try {
          const html = (await readFile('index.html', 'utf8'))
            .replace('/src/main.tsx', '/tests/fixtures/select-regression.tsx');
          res.setHeader('Content-Type', 'text/html');
          res.end(await server.transformIndexHtml('/__select-regression', html));
        } catch (error) { next(error); }
      });
    },
  }],
});
let browser;
let failures = 0;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const url = `${server.resolvedUrls.local[0]}__select-regression`;

  async function test(name, run) {
    const page = await browser.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(url);
      await page.getByRole('button', { name: 'Abrir ficha' }).waitFor();
      await run(page);
      assert.equal(await page.getByText('Algo salió mal', { exact: true }).count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS: ${name}`);
    } catch (error) {
      failures++;
      console.error(`FAIL: ${name}: ${error.message}`);
      if (errors.length) console.error(errors);
    } finally { await page.close(); }
  }

  // Emulates Translate replacing text with <font> nodes, even if auto-translation
  // is disabled. React must still be able to unmount the selected item portal.
  async function replaceTextLikeTranslator(locator) {
    await locator.evaluate(element => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (!node.textContent.trim()) continue;
        const font = document.createElement('font');
        font.textContent = node.textContent;
        node.replaceWith(font);
      }
    });
  }

  await test('changing a translated selected value', async page => {
    await replaceTextLikeTranslator(page.getByRole('combobox'));
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'DOMUS', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('output')?.textContent === 'domus');
    assert.match(await page.getByRole('combobox').innerText(), /DOMUS/);
  });

  await test('translated placeholder and keyboard selection', async page => {
    await page.getByRole('button', { name: 'Vaciar selección' }).click();
    await replaceTextLikeTranslator(page.getByRole('combobox'));
    await page.getByRole('combobox').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'option');
    await page.keyboard.press('End');
    await page.waitForFunction(() => document.activeElement?.textContent === 'DOMUS');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('output')?.textContent === 'domus');
  });

  await test('translated select inside a dialog can close and reopen', async page => {
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Abrir ficha' }).click();
      const dialog = page.getByRole('dialog');
      await replaceTextLikeTranslator(dialog.getByRole('combobox'));
      await dialog.getByRole('combobox').click();
      await replaceTextLikeTranslator(page.getByRole('option', { name: 'DOMUS', exact: true }));
      await page.getByRole('option', { name: 'DOMUS', exact: true }).click();
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
  });

  await test('global errors never replace a mounted React tree', async page => {
    const sameRootChildren = await page.evaluate(() => {
      const root = document.getElementById('root');
      const child = root.firstChild;
      window.dispatchEvent(new ErrorEvent('error', { message: 'Synthetic network error' }));
      window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.resolve(), reason: new Error('Synthetic rejection'),
      }));
      return root.firstChild === child;
    });
    assert.equal(sameRootChildren, true);
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'DOMUS', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('output')?.textContent === 'domus');
  });
} finally {
  await browser?.close();
  await server.close();
}
process.exitCode = failures ? 1 : 0;
