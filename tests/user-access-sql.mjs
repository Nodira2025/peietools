import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Base aislada: no usa credenciales ni datos remotos.
const db = new PGlite({ extensions: { pgcrypto } });
const admin = '11111111-1111-4111-8111-111111111111';
const patricio = '389a69d0-f06e-4ccf-99e5-af9cd5f1828f';
const other = '33333333-3333-4333-8333-333333333333';
const migration = await readFile('fix_acceso_patricio_y_altas.sql', 'utf8');
const tokenFields = [
  'confirmation_token', 'recovery_token', 'email_change_token_new',
  'email_change', 'email_change_token_current', 'phone_change',
  'phone_change_token', 'reauthentication_token',
];

try {
  await db.exec(`
    CREATE EXTENSION pgcrypto;
    CREATE SCHEMA auth;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY, instance_id uuid, aud text, role text, email text,
      encrypted_password text, email_confirmed_at timestamptz,
      raw_app_meta_data jsonb, raw_user_meta_data jsonb,
      created_at timestamptz, updated_at timestamptz,
      ${tokenFields.map(field => `${field} text`).join(',')},
      is_sso_user boolean
    );
    CREATE UNIQUE INDEX users_email_unique ON auth.users(lower(email));
    CREATE TABLE auth.identities (
      id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users,
      provider_id text, identity_data jsonb, provider text,
      last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
      UNIQUE(provider_id, provider)
    );
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users, full_name text,
      username text UNIQUE, role text, whatsapp text, active boolean DEFAULT true
    );
    CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO public.profiles(id, full_name, username, role, whatsapp)
      VALUES (new.id, new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1),
        new.raw_user_meta_data->>'role', new.raw_user_meta_data->>'whatsapp');
      RETURN new;
    END;
    $$;
    CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    INSERT INTO auth.users(id, email, encrypted_password, raw_user_meta_data,
      recovery_token, created_at, updated_at)
    VALUES
      ('${admin}', 'fixture-admin@peie.com', 'fixture-admin-hash',
        '{"full_name":"Administrador de prueba","role":"admin"}', '', now(), now()),
      ('${patricio}', 'Patricio@peie.com', 'fixture-existing-hash',
        '{"full_name":"Patricio Porcelo Zakelj","role":"solicitante"}',
        'fixture-existing-recovery-token', now(), now()),
      ('${other}', 'fixture-other@peie.com', 'fixture-other-hash',
        '{"full_name":"Otro usuario de prueba","role":"solicitante"}', '', now(), now());
    INSERT INTO auth.identities(id, user_id, provider_id, identity_data, provider)
    VALUES (gen_random_uuid(), '${patricio}', '${patricio}',
      '{"sub":"${patricio}","email":"Patricio@peie.com"}', 'email');
  `);

  const rows = async table => (await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
  const originalUsers = await rows('auth.users');
  const originalProfiles = await rows('public.profiles');
  const originalIdentities = await rows('auth.identities');

  // Un UUID coincidente con otra identidad no autoriza la reparacion.
  await db.query('UPDATE profiles SET full_name=$1 WHERE id=$2', ['Otra persona', patricio]);
  await assert.rejects(db.exec(migration), /No coincide la cuenta de Patricio/);
  await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT email_change FROM auth.users WHERE id=$1', [patricio])).rows[0].email_change, null);
  assert.equal((await db.query("SELECT to_regprocedure('public.admin_create_user(text,text,text,text,text)') AS fn")).rows[0].fn, null);
  await db.query('UPDATE profiles SET full_name=$1 WHERE id=$2', ['Patricio Porcelo Zakelj', patricio]);

  await db.exec(migration);
  const repairedUsers = await rows('auth.users');
  for (const before of originalUsers) {
    const after = repairedUsers.find(user => user.id === before.id);
    if (before.id !== patricio) {
      assert.deepEqual(after, before, 'No modifica otras cuentas');
      continue;
    }
    for (const [field, value] of Object.entries(before)) {
      assert.deepEqual(after[field], tokenFields.includes(field) ? (value ?? '') : value,
        `Conserva ${field}, salvo completar tokens NULL`);
    }
  }
  assert.deepEqual(await rows('public.profiles'), originalProfiles);
  assert.deepEqual(await rows('auth.identities'), originalIdentities);
  await db.exec(migration);
  assert.deepEqual(await rows('auth.users'), repairedUsers, 'Repetir no cambia registros reparados');

  const asUser = async (role, id = '') => {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec(`SET ROLE ${role}`);
  };
  const password = randomBytes(24).toString('base64url');
  const create = username => db.query(
    "SELECT public.admin_create_user($1, $2, 'Coordinador de prueba', 'solicitante', '') AS id",
    [username, password],
  );

  await asUser('anon');
  await assert.rejects(create('fixture-denied'), /No tienes permisos/);
  await asUser('authenticated', other);
  await assert.rejects(create('fixture-denied'), /No tienes permisos/);
  await asUser('authenticated', admin);
  const created = (await create('fixture-new-coordinator')).rows[0].id;
  await db.exec('RESET ROLE');
  const newUser = (await db.query('SELECT * FROM auth.users WHERE id=$1', [created])).rows[0];
  for (const field of tokenFields) assert.equal(newUser[field], '', `${field} es legible por Auth`);
  assert.ok(newUser.email_confirmed_at);
  assert.equal((await db.query('SELECT encrypted_password = crypt($1, encrypted_password) AS valid FROM auth.users WHERE id=$2', [password, created])).rows[0].valid, true);
  assert.equal((await db.query('SELECT role FROM profiles WHERE id=$1', [created])).rows[0].role, 'solicitante');
  assert.equal((await db.query('SELECT identity_data->>\'email\' AS email FROM auth.identities WHERE user_id=$1', [created])).rows[0].email, 'fixture-new-coordinator@peie.com');

  // Un alta duplicada se revierte sin dejar perfiles o identidades parciales.
  const countsBefore = (await db.query('SELECT (SELECT count(*) FROM auth.users) AS users, (SELECT count(*) FROM profiles) AS profiles, (SELECT count(*) FROM auth.identities) AS identities')).rows[0];
  await asUser('authenticated', admin);
  await assert.rejects(create('fixture-new-coordinator'), /duplicate key/);
  await db.exec('RESET ROLE');
  assert.deepEqual((await db.query('SELECT (SELECT count(*) FROM auth.users) AS users, (SELECT count(*) FROM profiles) AS profiles, (SELECT count(*) FROM auth.identities) AS identities')).rows[0], countsBefore);

  console.log('PASS SQL: identidad exacta, reparacion limitada e idempotente, conservacion de contrasena y permisos, altas completas, rechazo de anonimos/coordinadores y duplicados atomicos.');
} finally {
  await db.close();
}
