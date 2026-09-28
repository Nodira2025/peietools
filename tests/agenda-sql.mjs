import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111",
  coord = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  worker = "44444444-4444-4444-8444-444444444444";
try {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to public; create table profiles(id uuid primary key,role text,active boolean,full_name text,whatsapp text);create table empleados(id uuid primary key,active boolean,full_name text,specialty text,whatsapp text);create table empleados_legajos(empleado_id uuid,fecha_nacimiento date);insert into profiles values('${admin}','admin',true,'Administración',null),('${coord}','coordinador',true,'Coordinador',null),('${other}','solicitante',true,'Usuario',null);insert into empleados values('${worker}',true,'Electricista','Electricista',null);insert into empleados_legajos values('${worker}','1980-02-29');`,
  );
  await db.exec(await readFile("migracion_agenda.sql", "utf8"));
  const asUser = async (id) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  await asUser(admin);
  const people = (await db.query("select * from agenda_personas()")).rows;
  assert.equal(people.length, 4);
  assert.equal(people.find((p) => p.persona_id === worker).dia, 29);
  assert.ok(!Object.keys(people[0]).includes("fecha_nacimiento"));
  const save = async (id, persons, notify = true) =>
    (
      await db.query(
        "select agenda_guardar($1,'Capacitación','Seguridad','2026-10-02','09:00','Oficina',$2::jsonb,$3) as id",
        [id, JSON.stringify(persons), notify],
      )
    ).rows[0].id;
  const id = await save(null, [
    { tipo: "perfil", id: other },
    { tipo: "empleado", id: worker },
  ]);
  assert.equal(
    (await db.query("select * from agenda_vinculos")).rows.length,
    2,
  );
  await asUser(other);
  await assert.rejects(() => save(id, []));
  await assert.rejects(() => db.query("select agenda_quitar($1)", [id]));
  await assert.rejects(() =>
    db.query("update agenda_eventos set titulo='Mal' where id=$1", [id]),
  );
  await db.query("select agenda_leer($1)", [id]);
  assert.ok(
    (
      await db.query(
        "select leido_en from agenda_vinculos where persona_id=$1",
        [other],
      )
    ).rows[0].leido_en,
  );
  await asUser(coord);
  await assert.rejects(() => save(id, []));
  const own = await save(null, [], false);
  await db.query("select agenda_quitar($1)", [own]);
  assert.equal(
    (await db.query("select * from agenda_eventos where id=$1", [own])).rows
      .length,
    0,
  );
  await asUser(admin);
  const retryId = "55555555-5555-4555-8555-555555555555";
  await save(retryId, [], false);
  await save(retryId, [], false);
  assert.equal(
    (await db.query("select * from agenda_eventos where id=$1", [retryId])).rows.length,
    1,
    "Retrying with the draft UUID must not create a duplicate event",
  );
  await assert.rejects(() => save(id, [{ tipo: "perfil", id: worker }]));
  assert.equal(
    (await db.query("select * from agenda_vinculos where evento_id=$1", [id]))
      .rows.length,
    2,
    "Failed recipient validation rolls back changes",
  );
  await save(id, [{ tipo: "perfil", id: other }], false);
  assert.equal(
    (
      await db.query("select avisar from agenda_vinculos where evento_id=$1", [
        id,
      ])
    ).rows[0].avisar,
    false,
  );
  await assert.rejects(() =>
    db.query("select agenda_cumple_guardar('empleado',$1,2,30)", [worker]),
  );
  await db.query("select agenda_cumple_guardar('perfil',$1,10,5)", [admin]);
  await db.query("select agenda_cumple_guardar('perfil',$1,null,null)", [
    admin,
  ]);
  await asUser(other);
  await assert.rejects(() =>
    db.query("select agenda_cumple_guardar('empleado',$1,2,28)", [worker]),
  );
  await db.exec("reset role;set role anon");
  await assert.rejects(() => db.query("select * from agenda_personas()"));
  await assert.rejects(() => db.query("select * from agenda_eventos"));
  console.log(
    "PASS SQL: migration, shared persistence, RLS, creator permissions, atomic recipients, birthdays, read receipts, soft delete, anonymous denial",
  );
} finally {
  await db.close();
}
