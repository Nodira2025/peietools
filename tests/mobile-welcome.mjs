// Run the isolated backend first: node tests/logistics-qa-server.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
await mkdir('scratch/welcome-qa', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: -26.83, longitude: -65.22 }, permissions: ['geolocation'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('https://dolarapi.com/**', r => r.fulfill({ json: { venta: 1500, fechaActualizacion: new Date().toISOString() } }));
  await context.route('https://api.open-meteo.com/**', r => r.fulfill({ json: { current: { temperature_2m: 22, weather_code: 0 } } }));
  await page.goto('http://127.0.0.1:5187/bienvenida');
  await page.getByRole('link', { name: 'Iniciar', exact: true }).waitFor();
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'scratch/welcome-qa/mobile-before.png', fullPage: true });
  // Persisted account GPS uses authenticated account update. Stub only this local API.
  await page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabase.ts');
    supabase.auth.updateUser = async ({ data }) => ({ data: { user: { id: 'test-user', user_metadata: data } }, error: null });
  });
  await page.getByRole('button', { name: 'Registrar ubicación GPS' }).click();
  await page.getByText('22°', { exact: true }).waitFor();
  await page.screenshot({ path: 'scratch/welcome-qa/mobile-gps.png', fullPage: true });
  await page.getByRole('link', { name: 'Iniciar', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await page.waitForURL('**/bienvenida');
  await page.getByRole('link', { name: 'Mi perfil: reemplazar foto' }).click();
  await page.getByRole('heading', { name: 'Mi perfil' }).waitFor();
  await page.getByLabel('Seleccionar foto de perfil').setInputFiles('public/img/foto_empleado_franco.jpg');
  await page.getByRole('button', { name: 'Guardar foto' }).click();
  await page.getByText('Tu foto se actualizó correctamente.').waitFor();
  const state = await (await page.request.get('http://127.0.0.1:5187/__qa/state')).json();
  assert.ok(state.db.profiles.find(p => p.id === 'test-user').photo_url.startsWith('data:image/jpeg;base64,'));
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await page.locator('.welcome-portrait img').waitFor();
  await page.screenshot({ path: 'scratch/welcome-qa/mobile-photo.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 568 });
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'scratch/welcome-qa/mobile-small.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForURL('**/dashboard');
  assert.equal(await page.locator('.peie-welcome').count(), 0);
  await context.close();
  const denied = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const offline = await denied.newPage();
  await denied.route('https://**/*', r => r.abort());
  await offline.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_success, failure) => failure({ code: 1 }) } });
  });
  await offline.goto('http://127.0.0.1:5187/bienvenida');
  await offline.getByRole('button', { name: 'Registrar ubicación GPS' }).click();
  await offline.getByRole('status').filter({ hasText: 'Permiso denegado' }).waitFor();
  await offline.getByRole('link', { name: 'Iniciar', exact: true }).click();
  await offline.waitForURL('**/dashboard');
  assert.deepEqual(errors, []);
  console.log('PASS: mobile welcome, GPS, real panel navigation, photo replacement, 320px layout, desktop redirect, permission denial and offline entry.');
} finally { await browser.close(); }
