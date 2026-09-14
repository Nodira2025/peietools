import assert from 'node:assert/strict';
import { readFile, mkdir, realpath } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const obra = '00000000-0000-4000-8000-000000000001';
const employee = { id: 'e1', full_name: 'José Pérez', specialty: 'Oficial electricista', obra_id: obra, valor_hora: 2000, empleados_legajos: { dni: '30.123.456' }, photo_url: null };
const payroll = { id: 'p1', empleado_id: 'e1', fecha_desde: '2026-09-01', fecha_hasta: '2026-09-15', horas_trabajadas: 10, sueldo_bruto: 25000, bono_presentismo: 5000, estado: 'APROBADO' };
const server = await createServer({ cacheDir: 'scratch/vite-costos-test', server: { host: '127.0.0.1', port: 0, fs: { allow: [process.cwd(), await realpath('node_modules')] } }, plugins: [{ name: 'costos-test', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    if (!req.url.startsWith('/__costos')) return next();
    const html = (await readFile('index.html', 'utf8')).replace('/src/main.tsx', '/tests/fixtures/obra-costos.tsx');
    res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml('/__costos', html));
  });
} }] });
let browser;
try {
  const { costoTotal, tarifaLiquidacion, coincideElectricista, validarTarea } = await server.ssrLoadModule('/src/services/coordinadores/costosCalculator.ts');
  assert.equal(tarifaLiquidacion(payroll), 3000);
  assert.equal(tarifaLiquidacion({ ...payroll, horas_trabajadas: 0 }), null);
  assert.equal(tarifaLiquidacion({ ...payroll, estado: 'BORRADOR' }), null);
  assert.ok(coincideElectricista({ ...employee, dni: '30.123.456' }, '30123'));
  assert.ok(coincideElectricista(employee, 'jose perez'));
  const task = { name: 'Tendido', fase_id: 'f1', progress: 0, mano_obra: [{ horas: 2, valor_hora: 3000 }], herramientas: [{ cantidad: 2, costo_unitario: 500, concepto: 'Alquiler' }] };
  assert.deepEqual(costoTotal([task, task]), { horas: 4, laboral: 12000, herramientas: 2000, total: 14000 });
  assert.throws(() => validarTarea({ ...task, progress: -1 }));
  assert.throws(() => validarTarea({ ...task, mano_obra: [{ horas: NaN, valor_hora: 2 }] }));
  await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  await mkdir('scratch/costos-qa', { recursive: true });
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let tasks = []; let rejectSave = false;
    await page.route('**/rest/v1/**', async route => {
      const req = route.request(); const url = new URL(req.url()); const table = url.pathname.split('/').at(-1);
      let body;
      if (table === 'guardar_obra_tarea') {
        if (rejectSave) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Horas excedidas' }) });
        const tarea = req.postDataJSON().tarea; tasks = [...tasks.filter(t => t.id !== tarea.id), tarea]; body = tarea.id;
      } else if (table === 'obra_tareas' && req.method() === 'DELETE') { tasks = []; body = []; }
      else body = { empleados: [employee], herramientas: [{ id: 'h1', name: 'Taladro', code: 'H001', current_obra_id: obra }], liquidaciones_sueldos: [payroll], obra_tareas: tasks }[table] || [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`${server.resolvedUrls.local[0]}__costos`);
    await page.getByRole('button', { name: 'Nueva tarea' }).click();
    await page.getByLabel('Nombre de la tarea').fill('Tendido de cables');
    await page.getByLabel('Buscar electricista por nombre o DNI').fill('30123456');
    await page.getByRole('button', { name: /José Pérez/ }).click();
    await page.getByLabel('Origen de tarifa').selectOption('p1');
    await page.getByLabel('Horas imputadas', { exact: true }).fill('2');
    assert.equal(await page.getByLabel('Costo por hora (ARS)').inputValue(), '3000');
    await page.getByLabel('Buscar herramienta', { exact: true }).fill('H001');
    await page.getByRole('button', { name: /H001 · Taladro/ }).click();
    await page.getByLabel('Cantidad de unidades').fill('2');
    await page.getByLabel('Costo por unidad (ARS)').fill('500');
    await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
    await page.getByRole('button', { name: 'Editar Tendido de cables' }).waitFor();
    assert.equal(costoTotal(tasks).total, 7000);
    await page.reload();
    await page.getByRole('button', { name: 'Editar Tendido de cables' }).click();
    assert.equal(await page.getByLabel('Horas imputadas', { exact: true }).inputValue(), '2');
    rejectSave = true;
    await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Horas excedidas' }).waitFor();
    assert.ok(await page.getByRole('dialog').isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sin desborde horizontal');
    await page.screenshot({ path: `scratch/costos-qa/editor-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.screenshot({ path: `scratch/costos-qa/resumen-${width}.png`, fullPage: true });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Eliminar Tendido de cables' }).click();
    await page.getByText('Creá la primera tarea', { exact: false }).waitFor();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${width}px: DNI, asignación, liquidación, herramientas, totales, recarga, error y eliminación`);
  }
} finally { await browser?.close(); await server.close(); }
