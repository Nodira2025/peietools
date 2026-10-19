import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const db = new PGlite({ extensions: { pgcrypto } });
const admin = '11111111-1111-4111-8111-111111111111';
const coord = '22222222-2222-4222-8222-222222222222';
const tokenFields = ['confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change', 'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token'];
const migration = await readFile('migracion_validacion_usuarios.sql', 'utf8');
const password = randomBytes(24).toString('base64url');
try {
  await db.exec(`
    CREATE EXTENSION pgcrypto;
    CREATE SCHEMA auth;
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, instance_id uuid, aud text, role text,
      email text, encrypted_password text, email_confirmed_at timestamptz,
      raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
      ${tokenFields.map(field => `${field} text`).join(',')}, is_sso_user boolean);
    CREATE UNIQUE INDEX unique_email ON auth.users(lower(email));
    CREATE TABLE auth.identities(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users,
      provider_id text, identity_data jsonb, provider text, last_sign_in_at timestamptz,
      created_at timestamptz, updated_at timestamptz, UNIQUE(provider_id,provider));
    CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users, full_name text, username text UNIQUE,
      role text, whatsapp text, photo_url text, phone text, address text, obra_id uuid, active boolean DEFAULT true);
    CREATE TABLE user_passwords(user_id uuid PRIMARY KEY REFERENCES profiles, clear_password text,
      updated_at timestamptz DEFAULT now());
    INSERT INTO auth.users(id,email,encrypted_password) VALUES
      ('${admin}','admin@peie.com','fixture-existing-hash'),('${coord}','coord@peie.com','fixture-coordinator-hash');
    INSERT INTO profiles(id,full_name,role) VALUES ('${admin}','Admin prueba','admin'),('${coord}','Coord prueba','solicitante');
    INSERT INTO auth.identities(id,user_id,provider_id,provider,identity_data) VALUES
      (gen_random_uuid(),'${admin}','${admin}','email','{"email":"admin@peie.com"}'),
      (gen_random_uuid(),'${coord}','${coord}','email','{"email":"coord@peie.com"}');
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_passwords ENABLE ROW LEVEL SECURITY;
    CREATE POLICY profile_read ON profiles FOR SELECT USING(true);
    CREATE POLICY profile_update ON profiles FOR UPDATE USING(auth.uid()=id);
    CREATE POLICY profile_insert ON profiles FOR INSERT WITH CHECK(true);
    CREATE POLICY password_read ON user_passwords FOR SELECT USING(auth.uid()=user_id);
    GRANT ALL ON profiles,user_passwords TO anon,authenticated;
  `);
  await db.exec(migration);
  await db.exec('CREATE TRIGGER on_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()');
  assert.deepEqual((await db.query('SELECT username FROM profiles ORDER BY username')).rows.map(r => r.username), ['admin','coord']);
  await db.exec(migration);
  assert.equal((await db.query('SELECT encrypted_password FROM auth.users WHERE id=$1',[admin])).rows[0].encrypted_password,'fixture-existing-hash');

  const asUser = async (id, role = 'authenticated') => {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id || '']);
    await db.exec(`SET ROLE ${role}`);
  };
  const create = (username, pass = password, name = 'Persona prueba', role = 'solicitante') =>
    db.query('SELECT admin_create_user($1,$2,$3,$4,$5) AS id',[username,pass,name,role,'']);
  await asUser(null,'anon');
  await assert.rejects(db.query('SELECT id FROM profiles'),/permission denied/);
  await assert.rejects(create('denied'),/permission denied/);
  await asUser(coord);
  await assert.rejects(create('denied'),/administrador activo/);
  await assert.rejects(db.query("UPDATE profiles SET role='admin' WHERE id=$1",[coord]),/permission denied/);
  await assert.rejects(db.query("UPDATE profiles SET active=false WHERE id=$1",[coord]),/permission denied/);
  await db.query("UPDATE profiles SET photo_url='fixture-photo' WHERE id=$1",[coord]);
  assert.equal((await db.query('SELECT photo_url FROM profiles WHERE id=$1',[coord])).rows[0].photo_url,'fixture-photo');
  await asUser(admin);
  for (const input of ['', '   ', 'dos palabras', 'a"b', 'a@peie.com@peie.com']) {
    await assert.rejects(create(input),/usuario debe/);
  }
  await assert.rejects(create('short','123'),/contrasena/);
  await assert.rejects(create('spaces','      '),/contrasena/);
  await assert.rejects(create('long','á'.repeat(37)),/contrasena/);
  await assert.rejects(create('no-role',password,'Prueba',''),/rol valido/);
  await assert.rejects(create('no-name',password,'  '),/nombre/);
  const newId = (await create('  NUEVO@PEIE.COM  ',password,'  Persona prueba  ')).rows[0].id;
  await db.exec('RESET ROLE');
  const newUser = (await db.query('SELECT * FROM auth.users WHERE id=$1',[newId])).rows[0];
  assert.equal(newUser.email,'nuevo@peie.com');
  for (const field of tokenFields) assert.equal(newUser[field],'');
  assert.equal((await db.query('SELECT encrypted_password = crypt($1,encrypted_password) AS valid FROM auth.users WHERE id=$2',[password,newId])).rows[0].valid,true);
  assert.deepEqual((await db.query('SELECT username,full_name,role FROM profiles WHERE id=$1',[newId])).rows[0],{username:'nuevo',full_name:'Persona prueba',role:'solicitante'});
  const beforeHash = newUser.encrypted_password;
  await asUser(admin);
  await assert.rejects(create('Nuevo'),/ya existe/);
  await db.query('SELECT admin_update_user_v2($1,$2,NULL,$3,$4,$5,false)',[newId,'RENOMBRADO','Nombre corregido','logistica','549000000000']);
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT encrypted_password FROM auth.users WHERE id=$1',[newId])).rows[0].encrypted_password,beforeHash);
  assert.equal((await db.query('SELECT active FROM profiles WHERE id=$1',[newId])).rows[0].active,false);
  assert.equal((await db.query("SELECT identity_data->>'email' AS email FROM auth.identities WHERE user_id=$1",[newId])).rows[0].email,'renombrado@peie.com');
  await asUser(admin);
  await assert.rejects(db.query('SELECT admin_update_user_v2($1,$2,NULL,$3,$4,$5,false)',[admin,'admin','Admin prueba','admin','']),/propia cuenta/);
  await assert.rejects(db.query('SELECT admin_update_user($1,$2,NULL,NULL,$3)',[admin,'admin','solicitante']),/propios permisos/);
  await assert.rejects(db.query('SELECT admin_update_user($1,$2)',[newId,'coord']),/ya existe/);
  // Una cuenta sin identidad hace fallar toda la actualizacion, sin cambiar email ni perfil.
  await db.exec('RESET ROLE');
  await db.query('DELETE FROM auth.identities WHERE user_id=$1',[newId]);
  await asUser(admin);
  await assert.rejects(db.query('SELECT admin_update_user($1,$2)',[newId,'otra-cosa']),/identidad/);
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT email FROM auth.users WHERE id=$1',[newId])).rows[0].email,'renombrado@peie.com');
  // Metadata enviada por un registro no autorizado no otorga privilegios.
  await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(gen_random_uuid(),'metadata@peie.com','{\"role\":\"admin\"}')");
  assert.equal((await db.query("SELECT role FROM profiles WHERE username='metadata'")).rows[0].role,'solicitante');
  await db.query('UPDATE profiles SET active=false WHERE id=$1',[admin]);
  await asUser(admin);
  await assert.rejects(create('inactive-admin'),/administrador activo/);
  await asUser(newId);
  await assert.rejects(db.query('SELECT change_own_password($1)',[password]),/cuenta activa/);
  console.log('PASS: altas validadas, normalizacion, alias recuperados, duplicados, atomicidad, password conservado, estado activo, permisos y metadata protegidos.');
} finally { await db.close(); }
