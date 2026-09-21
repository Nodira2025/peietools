// Uses the isolated server: node tests/logistics-qa-server.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
await mkdir('scratch/welcome-qa', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('https://dolarapi.com/**', route => route.fulfill({ json: { venta: 1500, fechaActualizacion: new Date().toISOString() } }));
  await context.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: 22, weather_code: 0 } } }));
  await page.goto('http://127.0.0.1:5187/');
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: '¡Bienvenido, Coordinador!' }).waitFor();
  await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/store/auth.ts');
    const state = useAuthStore.getState();
    useAuthStore.setState({ profile: { ...state.profile, full_name: 'Martín Grande', photo_url: '/img/foto_empleado_martin.jpg' }, user: { ...state.user, user_metadata: { peie_location: { latitude: -26.83, longitude: -65.22, accuracy: 20, capturedAt: new Date().toISOString() } } } });
  });
  await page.getByText('22° Despejado', { exact: true }).waitFor();
  await page.locator('.desktop-worksite-photo img').evaluate(image => image.decode());
  await page.screenshot({ path: 'scratch/welcome-qa/desktop-1440.png', fullPage: true });
  assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false);
  assert.ok(await page.locator('aside').isVisible());
  await page.getByRole('button', { name: 'Ayuda para comenzar' }).click();
  await page.getByRole('heading', { name: 'Tu espacio de trabajo' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Mi perfil: reemplazar foto' }).click();
  await page.getByRole('heading', { name: 'Mi perfil' }).waitFor();
  await page.locator('aside').getByRole('link', { name: 'Inicio', exact: true }).click();
  await page.locator('.desktop-welcome').waitFor();
  await page.locator('.desktop-welcome-pillars').getByRole('link', { name: 'Herramientas que impulsan' }).click();
  await page.waitForURL('**/herramientas');
  await page.locator('aside').getByRole('link', { name: 'Inicio', exact: true }).click();
  for (const size of [{width:1280,height:720},{width:1024,height:768},{width:800,height:900}]) {
    await page.setViewportSize(size);
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `scratch/welcome-qa/desktop-${size.width}.png`, fullPage: true });
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:5187/bienvenida');
  await page.getByRole('link', {name:'Iniciar',exact:true}).waitFor();
  assert.equal(await page.locator('.desktop-welcome').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop reference layout, current profile, weather, sidebar and shortcut navigation, help, 1440/1280/1024/800 widths, mobile preserved.');
} finally { await browser.close(); }
