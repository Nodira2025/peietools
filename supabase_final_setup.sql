-- =========================================================================
-- PEIE TOOLS - SCRIPT DEFINITIVO DE INSTALACIÓN (v2 - Fix Auth)
-- =========================================================================
-- IMPORTANTE: NO usa "DROP SCHEMA public CASCADE".
-- Los usuarios se insertan con TODOS los campos requeridos por GoTrue
-- para evitar "Database error querying schema".
-- =========================================================================

-- 1. Borrar tablas existentes (en orden correcto por dependencias)
DROP TABLE IF EXISTS mantenimientos CASCADE;
DROP TABLE IF EXISTS movimientos CASCADE;
DROP TABLE IF EXISTS solicitudes_compras CASCADE;
DROP TABLE IF EXISTS solicitudes CASCADE;
DROP TABLE IF EXISTS herramientas CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS obras CASCADE;

-- 2. Borrar usuarios de prueba anteriores
DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'admin@peie.com', 'santiago@peie.com', 'martin@peie.com', 'franco@peie.com', 
    'cristian@peie.com', 'federico@peie.com', 'florencia@peie.com', 'melisa@peie.com'
  )
);
DELETE FROM auth.users WHERE email IN (
  'admin@peie.com', 'santiago@peie.com', 'martin@peie.com', 'franco@peie.com', 
  'cristian@peie.com', 'federico@peie.com', 'florencia@peie.com', 'melisa@peie.com'
);

-- 3. Borrar trigger y función antiguos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 4. Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- 5. CREAR TABLAS
-- =========================================================================

CREATE TABLE obras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    manager_name TEXT,
    phone TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    photo_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    username TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'solicitante',
    whatsapp TEXT,
    obra_id UUID REFERENCES obras(id),
    photo_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE herramientas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    qr_code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    brand TEXT,
    model TEXT,
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'Disponible' CHECK (status IN ('Disponible', 'Reservada', 'En uso', 'En traslado', 'En mantenimiento', 'Fuera de servicio')),
    current_obra_id UUID REFERENCES obras(id),
    notes TEXT,
    last_latitude DOUBLE PRECISION,
    last_longitude DOUBLE PRECISION,
    last_location_accuracy DOUBLE PRECISION,
    last_location_at TIMESTAMP WITH TIME ZONE,
    google_maps_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES profiles(id) NOT NULL,
    herramienta_id UUID REFERENCES herramientas(id) NOT NULL,
    source_obra_id UUID REFERENCES obras(id),
    target_obra_id UUID REFERENCES obras(id) NOT NULL,
    assigned_to UUID REFERENCES profiles(id),
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Baja', 'Normal', 'Alta', 'Urgente')),
    status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada', 'Confirmada', 'Cancelada')),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE solicitudes_compras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Baja', 'Normal', 'Alta', 'Urgente')),
    justification TEXT,
    obra_id UUID REFERENCES obras(id),
    requester_id UUID REFERENCES profiles(id) NOT NULL,
    status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'En evaluación', 'Aprobada', 'Rechazada', 'Comprada', 'Recibida', 'Cerrada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    herramienta_id UUID REFERENCES herramientas(id) NOT NULL,
    solicitud_id UUID REFERENCES solicitudes(id),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    action TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE mantenimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    herramienta_id UUID REFERENCES herramientas(id) NOT NULL,
    reported_by UUID REFERENCES profiles(id),
    issue_description TEXT NOT NULL,
    status TEXT DEFAULT 'Abierto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 6. RLS (Row Level Security)
-- =========================================================================

ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE herramientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantenimientos ENABLE ROW LEVEL SECURITY;

-- Obras
CREATE POLICY "Obras viewable by everyone" ON obras FOR SELECT USING (true);
CREATE POLICY "Obras insert/update by admins" ON obras FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Profiles
CREATE POLICY "Profiles viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can update any profile" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Profiles insert for trigger" ON profiles FOR INSERT WITH CHECK (true);

-- Herramientas
CREATE POLICY "Herramientas viewable by everyone" ON herramientas FOR SELECT USING (true);
CREATE POLICY "Herramientas update by anyone" ON herramientas FOR UPDATE USING (true);
CREATE POLICY "Herramientas insert by admins" ON herramientas FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'compras'))
);

-- Solicitudes
CREATE POLICY "Solicitudes viewable by everyone" ON solicitudes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert solicitudes" ON solicitudes FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Anyone can update solicitudes" ON solicitudes FOR UPDATE USING (true);

-- Solicitudes Compras
CREATE POLICY "SolicitudesCompras viewable by everyone" ON solicitudes_compras FOR SELECT USING (true);
CREATE POLICY "Anyone can insert solicitudes_compras" ON solicitudes_compras FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Anyone can update solicitudes_compras" ON solicitudes_compras FOR UPDATE USING (true);

-- Movimientos
CREATE POLICY "Movimientos viewable by everyone" ON movimientos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert movimientos" ON movimientos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Mantenimientos
CREATE POLICY "Mantenimientos viewable by everyone" ON mantenimientos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert mantenimientos" ON mantenimientos FOR INSERT WITH CHECK (true);

-- =========================================================================
-- 7. PERMISOS (Grants para roles de Supabase API)
-- =========================================================================

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- =========================================================================
-- 8. TRIGGER para creación automática de Perfil
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'solicitante'),
    new.raw_user_meta_data->>'whatsapp',
    new.raw_user_meta_data->>'photo_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================================================
-- 9. DATOS INICIALES
-- =========================================================================

-- Roles
INSERT INTO roles (name) VALUES ('admin'), ('solicitante'), ('logistica'), ('compras'), ('encargado') ON CONFLICT DO NOTHING;

-- Usuarios de prueba (con TODOS los campos requeridos por GoTrue)
DO $$
DECLARE
  admin_id UUID := gen_random_uuid();
  santiago_id UUID := gen_random_uuid();
  martin_id UUID := gen_random_uuid();
  franco_id UUID := gen_random_uuid();
  cristian_id UUID := gen_random_uuid();
  federico_id UUID := gen_random_uuid();
  florencia_id UUID := gen_random_uuid();
  melisa_id UUID := gen_random_uuid();
  obra_id UUID := gen_random_uuid();
BEGIN

  -- 0. Administrador Maestro (Admin)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    admin_id, '00000000-0000-0000-0000-000000000000', 'admin@peie.com', 
    crypt('admin123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Administrador General","role":"admin","whatsapp":"+543810000000","photo_url":"/img/foto_empleado_santiago.jpg"}',
    now(), now(), 'authenticated', 'authenticated', false
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), admin_id, admin_id, format('{"sub":"%s","email":"admin@peie.com","email_verified":true}', admin_id::text)::jsonb, 'email', now(), now(), now());

  -- 1. Santiago Moreno (Logística)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    santiago_id, '00000000-0000-0000-0000-000000000000', 'santiago@peie.com', 
    crypt('santiago123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Santiago Moreno","role":"logistica","whatsapp":"+543815158212","photo_url":"/img/foto_empleado_santiago.jpg"}',
    now(), now(), 'authenticated', 'authenticated', false
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), santiago_id, santiago_id, format('{"sub":"%s","email":"santiago@peie.com","email_verified":true}', santiago_id::text)::jsonb, 'email', now(), now(), now());

  -- 2. Martin Grande (Encargado)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    martin_id, '00000000-0000-0000-0000-000000000000', 'martin@peie.com',
    crypt('martin123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Martin Grande","role":"encargado","whatsapp":"+54 9 3816 69-8316","photo_url":"/img/foto_empleado_martin.jpg"}',
    now(), now(), 'authenticated', 'authenticated', false
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), martin_id, martin_id, format('{"sub":"%s","email":"martin@peie.com","email_verified":true}', martin_id::text)::jsonb, 'email', now(), now(), now());

  -- 3. Franco Lobo (Encargado)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    franco_id, '00000000-0000-0000-0000-000000000000', 'franco@peie.com',
    crypt('franco123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Franco Lobo","role":"encargado","whatsapp":"+543816490060","photo_url":"/img/foto_empleado_franco.jpg"}',
    now(), now(), 'authenticated', 'authenticated', false
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), franco_id, franco_id, format('{"sub":"%s","email":"franco@peie.com","email_verified":true}', franco_id::text)::jsonb, 'email', now(), now(), now());

  -- 4. Cristian Perez (Encargado)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    cristian_id, '00000000-0000-0000-0000-000000000000', 'cristian@peie.com',
    crypt('cristian123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Cristian Perez","role":"encargado","whatsapp":"+543816490060","photo_url":"/img/foto_empleado_santiago.jpg"}',
    now(), now(), 'authenticated', 'authenticated', false
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), cristian_id, cristian_id, format('{"sub":"%s","email":"cristian@peie.com","email_verified":true}', cristian_id::text)::jsonb, 'email', now(), now(), now());

  -- 5. Federico Grande (Encargado)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    federico_id, '00000000-0000-0000-0000-000000000000', 'federico@peie.com',
    crypt('federico123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Federico Grande","role":"admin","whatsapp":"+54 9 3814 01-5738","photo_url":"/img/foto_empleado_santiago.jpg"}',
    now(), now(), 'authenticated', 'authenticated', false
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), federico_id, federico_id, format('{"sub":"%s","email":"federico@peie.com","email_verified":true}', federico_id::text)::jsonb, 'email', now(), now(), now());

  -- 6. Florencia Grande (Admin)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    florencia_id, '00000000-0000-0000-0000-000000000000', 'florencia@peie.com',
    crypt('admin123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Florencia Grande","role":"admin","whatsapp":"+54 9 3813 32-3666","photo_url":"/img/foto_empleado_santiago.jpg"}',
    now(), now(), 'authenticated', 'authenticated', false
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), florencia_id, florencia_id, format('{"sub":"%s","email":"florencia@peie.com","email_verified":true}', florencia_id::text)::jsonb, 'email', now(), now(), now());

  -- 7. Melisa Gonzales (Admin)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    melisa_id, '00000000-0000-0000-0000-000000000000', 'melisa@peie.com',
    crypt('admin123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Melisa Gonzales","role":"admin","whatsapp":"+54 9 3816 29-5626","photo_url":"/img/foto_empleado_santiago.jpg"}',
    now(), now(), 'authenticated', 'authenticated', false
  );
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), melisa_id, melisa_id, format('{"sub":"%s","email":"melisa@peie.com","email_verified":true}', melisa_id::text)::jsonb, 'email', now(), now(), now());

  -- Crear Obra de Prueba
  INSERT INTO obras (id, code, name, address, active, photo_url)
  VALUES (obra_id, 'OBRA-001', 'Obra Central', 'Santiago del Estero, Argentina', true, '/img/foto_obra_central.jpg');

  -- Crear Herramienta de Prueba
  INSERT INTO herramientas (code, name, brand, model, status, current_obra_id, photo_url)
  VALUES ('TAL-001', 'Taladro Bosch', 'Bosch', 'GSB 13 RE', 'Disponible', obra_id, '/img/foto_herramienta_taladro.jpg');

END $$;

-- =========================================================================
-- FIN - La base de datos está lista para usar
-- =========================================================================
-- Usuarios disponibles:
--   admin@peie.com    / admin123     (rol: admin)
--   santiago@peie.com / santiago123  (rol: logistica)
--   martin@peie.com   / martin123    (rol: encargado)
--   franco@peie.com   / franco123    (rol: encargado)
--   cristian@peie.com / cristian123  (rol: encargado)
--   federico@peie.com / federico123  (rol: admin)
--   florencia@peie.com / admin123    (rol: admin)
--   melisa@peie.com    / admin123    (rol: admin)
--
-- En la app, solo escribí el nombre (ej: "admin" o "santiago") y la contraseña.
-- El @peie.com se agrega automáticamente.
-- =========================================================================
