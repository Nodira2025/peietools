// Preparación: npm install --prefix scratch/sql-qa --no-audit --no-fund @electric-sql/pglite
import { PGlite } from '../scratch/sql-qa/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(99)}'::uuid $$;
    CREATE TABLE obras(id uuid PRIMARY KEY);
    CREATE TABLE empleados(id uuid PRIMARY KEY);
    CREATE TABLE herramientas(id uuid PRIMARY KEY);
    CREATE TABLE obra_fases(id uuid PRIMARY KEY, obra_id uuid REFERENCES obras);
    CREATE TABLE liquidaciones_sueldos(id uuid PRIMARY KEY, empleado_id uuid, estado text, horas_trabajadas numeric, sueldo_bruto numeric, bono_presentismo numeric);
    INSERT INTO obras VALUES('${id(1)}'),('${id(2)}');
    INSERT INTO obra_fases VALUES('${id(3)}','${id(1)}'),('${id(4)}','${id(2)}');
    INSERT INTO empleados VALUES('${id(5)}'),('${id(6)}');
    INSERT INTO herramientas VALUES('${id(7)}');
    INSERT INTO liquidaciones_sueldos VALUES('${id(8)}','${id(5)}','APROBADO',10,25000,5000);`);
  const migration = await readFile('migracion_tareas_costos_obra.sql', 'utf8');
  await db.exec(migration); await db.exec(migration);
  const task = { id: id(9), obra_id: id(1), fase_id: id(3), name: 'Cableado', progress: 20, mano_obra: [{ empleado_id: id(5), categoria: 'Oficial', horas: 6, valor_hora: 1, liquidacion_id: id(8) }], herramientas: [{ herramienta_id: id(7), concepto: 'Alquiler', cantidad: 2, costo_unitario: 500 }] };
  const save = t => db.query('SELECT guardar_obra_tarea($1::jsonb)', [JSON.stringify(t)]);
  await save(task);
  assert.equal(Number((await db.query('SELECT valor_hora FROM obra_tarea_personal')).rows[0].valor_hora), 3000, 'Tarifa calculada en servidor');
  await assert.rejects(save({ ...task, id: id(10), obra_id: id(2), fase_id: id(4), mano_obra: [{ ...task.mano_obra[0], horas: 5 }] }), /superan/);
  assert.equal((await db.query('SELECT * FROM obra_tareas')).rows.length, 1, 'Reversión atómica');
  await save({ ...task, id: id(10), obra_id: id(2), fase_id: id(4), mano_obra: [{ ...task.mano_obra[0], horas: 4 }] });
  await assert.rejects(save({ ...task, mano_obra: [{ ...task.mano_obra[0], empleado_id: id(6) }] }), /pertenecer/);
  await assert.rejects(save({ ...task, fase_id: id(4) }), /foreign key/);
  await assert.rejects(save({ ...task, herramientas: [{ ...task.herramientas[0], costo_unitario: -1 }] }), /check constraint/);
  await assert.rejects(db.query('DELETE FROM obra_fases WHERE id=$1', [id(3)]), /foreign key/);
  await db.query('DELETE FROM obra_tareas WHERE id=$1', [id(10)]);
  await save({ ...task, mano_obra: [{ ...task.mano_obra[0], horas: 10 }] });
  assert.equal((await db.query('SELECT * FROM obra_tarea_personal')).rows.length, 1);
  console.log('PASS SQL: migración idempotente, tarifa, límite entre obras, rollback, pertenencia, costos negativos y protección de fases');
} finally { await db.close(); }

// Reproduce el caso reportado: existen las tablas base, pero no fases ni liquidaciones.
const fresh = new PGlite();
try {
  await fresh.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(99)}'::uuid $$;
    CREATE TABLE obras(id uuid PRIMARY KEY);
    CREATE TABLE empleados(id uuid PRIMARY KEY);
    CREATE TABLE herramientas(id uuid PRIMARY KEY);`);
  const migration = await readFile('migracion_tareas_costos_obra.sql', 'utf8');
  await fresh.exec(migration);
  assert.equal((await fresh.query('SELECT * FROM obra_fases')).rows.length, 0, 'Sin avances inventados');
  assert.equal((await fresh.query('SELECT * FROM liquidaciones_sueldos')).rows.length, 0, 'Sin sueldos inventados');
  await fresh.exec(`INSERT INTO obras VALUES('${id(1)}');
    INSERT INTO obra_fases(id, obra_id, name, start_date, end_date)
    VALUES('${id(3)}', '${id(1)}', 'Fase real', '2026-09-01', '2026-09-30');
    CREATE POLICY conservar_politica_existente ON obra_fases FOR SELECT TO authenticated USING (true);`);
  await fresh.exec(migration);
  assert.equal((await fresh.query('SELECT name FROM obra_fases')).rows[0].name, 'Fase real');
  assert.equal((await fresh.query("SELECT * FROM pg_policies WHERE policyname = 'conservar_politica_existente'")).rows.length, 1);
  await fresh.exec(`SET ROLE authenticated;
    INSERT INTO obra_tareas(obra_id, fase_id, name) VALUES('${id(1)}', '${id(3)}', 'Tarea real');`);
  assert.equal((await fresh.query('SELECT * FROM obra_tareas')).rows.length, 1);
  console.log('PASS SQL sin dependencias: crea fases y liquidaciones, permite tareas y conserva datos y políticas al repetir');
} finally { await fresh.close(); }

const phasesOnly = new PGlite();
try {
  await phasesOnly.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(99)}'::uuid $$;
    CREATE TABLE obras(id uuid PRIMARY KEY);
    CREATE TABLE empleados(id uuid PRIMARY KEY);
    CREATE TABLE herramientas(id uuid PRIMARY KEY);
    CREATE TABLE obra_fases(id uuid PRIMARY KEY, obra_id uuid REFERENCES obras);`);
  await phasesOnly.exec(await readFile('migracion_tareas_costos_obra.sql', 'utf8'));
  const result = await phasesOnly.query("SELECT to_regclass('public.liquidaciones_sueldos') AS tabla");
  assert.equal(result.rows[0].tabla, 'liquidaciones_sueldos');
  console.log('PASS SQL: fases existentes y liquidaciones ausentes');
} finally { await phasesOnly.close(); }
