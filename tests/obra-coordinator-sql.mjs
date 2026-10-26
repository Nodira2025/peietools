import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
try {
  await db.exec(`create table profiles(id uuid primary key, full_name text, username text, role text, active boolean);
    create table obras(id serial primary key, name text, encargado_name text);
    insert into obras(name, encargado_name) values ('Historica', 'Nombre abreviado');`);
  const migration = await readFile('migracion_obras_coordinador.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  assert.deepEqual((await db.query('select encargado_name, coordinador_id from obras')).rows,
    [{ encargado_name: 'Nombre abreviado', coordinador_id: null }]);
  for (const [index, role] of ['admin', 'coordinador', 'encargado', 'solicitante', 'logistica'].entries()) {
    await db.query('insert into profiles values ($1,$2,$3,$4,true)', [id(index), `Persona ${index}`, `usuario${index}`, role]);
    const insert = () => db.query("insert into obras(name,encargado_name,coordinador_id) values ('Nueva','Texto incorrecto',$1) returning encargado_name", [id(index)]);
    if (role === 'logistica') await assert.rejects(insert, /activo/);
    else assert.equal((await insert()).rows[0].encargado_name, `Persona ${index}`);
  }
  await db.exec('update profiles set active = false');
  await assert.rejects(() => db.query("insert into obras(name,coordinador_id) values ('Inactiva',$1)", [id(0)]), /activo/);
  await db.exec("update obras set name='Renombrada' where coordinador_id is not null");
  assert.equal((await db.query('select count(*)::int as n from obras')).rows[0].n, 5);
  await assert.rejects(() => db.query("update obras set coordinador_id=$1 where id=1", [id(99)]), /activo/);
  await db.exec('update obras set coordinador_id=null, encargado_name=null where id=2');
  assert.equal((await db.query('select coordinador_id from obras where id=2')).rows[0].coordinador_id, null);
  console.log('PASS: migracion repetible, nombres historicos, cuatro roles, nombre canonico, rechazo de inactivos/rol ajeno/ID inexistente, edicion y desasignacion.');
} finally { await db.close(); }
