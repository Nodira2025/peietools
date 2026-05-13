-- =========================================================================
-- PEIE TOOLS - SCRIPT COMPLETO DE INSTALACIÓN
-- Copia todo este código y pégalo en el SQL Editor de Supabase
-- Nota: Esto reiniciará la base de datos pública y la dejará 100% lista.
-- =========================================================================

-- 1. Limpiar esquema para asegurar instalación limpia (opcional, remueve todas las tablas actuales)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- 1b. Restaurar permisos para roles de Supabase (CRÍTICO: sin esto, la API no funciona)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3. Crear tablas
CREATE TABLE obras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    manager_name TEXT,
    phone TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
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

-- 4. RLS (Row Level Security) Policies
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE herramientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Obras viewable by everyone" ON obras FOR SELECT USING (true);
CREATE POLICY "Obras insert/update by admins" ON obras FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Profiles viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can update any profile" ON profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Herramientas viewable by everyone" ON herramientas FOR SELECT USING (true);
CREATE POLICY "Herramientas update by anyone" ON herramientas FOR UPDATE USING (true);
CREATE POLICY "Herramientas insert by admins" ON herramientas FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'compras')));

CREATE POLICY "Solicitudes viewable by everyone" ON solicitudes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert solicitudes" ON solicitudes FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Anyone can update solicitudes" ON solicitudes FOR UPDATE USING (true);

CREATE POLICY "SolicitudesCompras viewable by everyone" ON solicitudes_compras FOR SELECT USING (true);
CREATE POLICY "Anyone can insert solicitudes_compras" ON solicitudes_compras FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Anyone can update solicitudes_compras" ON solicitudes_compras FOR UPDATE USING (true);

CREATE POLICY "Movimientos viewable by everyone" ON movimientos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert movimientos" ON movimientos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4b. Grants de PostgreSQL para roles de Supabase (CRÍTICO)
-- Sin estos grants, RLS no es suficiente - la API devuelve "Database error querying schema"
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Permisos por defecto para futuras tablas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- 5. Trigger para creación automática de Perfil al hacer Login
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, whatsapp)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'solicitante'),
    new.raw_user_meta_data->>'whatsapp'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Insertar Roles iniciales
INSERT INTO roles (name) VALUES ('admin'), ('solicitante'), ('logistica'), ('compras'), ('encargado') ON CONFLICT DO NOTHING;

-- 7. Insertar Datos de Semilla (Obra y Usuarios)
DO $$
DECLARE
  santiago_id UUID := gen_random_uuid();
  martin_id UUID := gen_random_uuid();
  franco_id UUID := gen_random_uuid();
  cristian_id UUID := gen_random_uuid();
  federico_id UUID := gen_random_uuid();
  obra_id UUID := gen_random_uuid();
BEGIN

  -- Limpiar usuarios de prueba si ya existen
  DELETE FROM auth.users WHERE email IN (
    'santiago@peie.com', 'martin@peie.com', 'franco@peie.com', 'cristian@peie.com', 'federico@peie.com',
    'encargado@peie.com', 'logistica@peie.com', 'encargado@peie.local', 'logistica@peie.local'
  );

  -- 1. Santiago Moreno (Logística)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (santiago_id, '00000000-0000-0000-0000-000000000000', 'santiago@peie.com', crypt('santiago123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Santiago Moreno","role":"logistica","whatsapp":"+543815158212"}', now(), now(), 'authenticated', 'authenticated');
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  VALUES (gen_random_uuid(), santiago_id, santiago_id, format('{"sub":"%s","email":"%s"}', santiago_id::text, 'santiago@peie.com')::jsonb, 'email', now(), now());

  -- 2. Martin Grande (Encargado)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (martin_id, '00000000-0000-0000-0000-000000000000', 'martin@peie.com', crypt('martin123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Martin Grande","role":"encargado","whatsapp":"+543816490060"}', now(), now(), 'authenticated', 'authenticated');
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  VALUES (gen_random_uuid(), martin_id, martin_id, format('{"sub":"%s","email":"%s"}', martin_id::text, 'martin@peie.com')::jsonb, 'email', now(), now());

  -- 3. Franco Lobo (Encargado)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (franco_id, '00000000-0000-0000-0000-000000000000', 'franco@peie.com', crypt('franco123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Franco Lobo","role":"encargado","whatsapp":"+543816490060"}', now(), now(), 'authenticated', 'authenticated');
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  VALUES (gen_random_uuid(), franco_id, franco_id, format('{"sub":"%s","email":"%s"}', franco_id::text, 'franco@peie.com')::jsonb, 'email', now(), now());

  -- 4. Cristian Perez (Encargado)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (cristian_id, '00000000-0000-0000-0000-000000000000', 'cristian@peie.com', crypt('cristian123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Cristian Perez","role":"encargado","whatsapp":"+543816490060"}', now(), now(), 'authenticated', 'authenticated');
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  VALUES (gen_random_uuid(), cristian_id, cristian_id, format('{"sub":"%s","email":"%s"}', cristian_id::text, 'cristian@peie.com')::jsonb, 'email', now(), now());

  -- 5. Federico Grande (Encargado)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (federico_id, '00000000-0000-0000-0000-000000000000', 'federico@peie.com', crypt('federico123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Federico Grande","role":"encargado","whatsapp":"+543816490060"}', now(), now(), 'authenticated', 'authenticated');
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  VALUES (gen_random_uuid(), federico_id, federico_id, format('{"sub":"%s","email":"%s"}', federico_id::text, 'federico@peie.com')::jsonb, 'email', now(), now());

  -- Crear Obra de Prueba
  INSERT INTO obras (id, code, name, address, active)
  VALUES (obra_id, 'OBRA-001', 'Obra Central', 'Santiago del Estero, Argentina', true);

  -- Crear Herramienta de Prueba asignada a la Obra
  INSERT INTO herramientas (code, name, brand, model, status, current_obra_id)
  VALUES ('TAL-001', 'Taladro Bosch', 'Bosch', 'GSB 13 RE', 'Disponible', obra_id);

END $$;
