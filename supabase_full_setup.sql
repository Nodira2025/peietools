-- =========================================================================
-- PEIE TOOLS - SCRIPT COMPLETO DE INSTALACIÓN (SINCRONIZADO)
-- Copia todo este código y pégalo en el SQL Editor de Supabase
-- Nota: Esto reiniciará la base de datos pública y la dejará 100% lista.
-- =========================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- =========================================================================
-- PEIE TOOLS - ESQUEMA DE BASE DE DATOS COMPLETO (SINCRONIZADO)
-- Copia todo este código y pégalo en el SQL Editor de Supabase
-- =========================================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABLA: OBRAS
CREATE TABLE IF NOT EXISTS public.obras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    encargado_name TEXT,
    phone TEXT,
    photo_url TEXT,
    latitude TEXT,
    longitude TEXT,
    status TEXT DEFAULT 'Planificada',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA: ROLES
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL
);

-- 3. TABLA: PROFILES (Perfiles de usuario de la App)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    username TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'solicitante',
    whatsapp TEXT,
    photo_url TEXT,
    obra_id UUID REFERENCES public.obras(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA: EMPLEADOS (Operarios y Personal de Obra)
CREATE TABLE IF NOT EXISTS public.empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operario',
    whatsapp TEXT,
    active BOOLEAN DEFAULT true,
    obra_id UUID REFERENCES public.obras(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA: HERRAMIENTAS
CREATE TABLE IF NOT EXISTS public.herramientas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    qr_code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    brand TEXT,
    model TEXT,
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'Disponible' CHECK (status IN ('Disponible', 'Reservada', 'En uso', 'En traslado', 'En mantenimiento', 'Fuera de servicio')),
    current_obra_id UUID REFERENCES public.obras(id),
    notes TEXT,
    last_latitude DOUBLE PRECISION,
    last_longitude DOUBLE PRECISION,
    last_location_accuracy DOUBLE PRECISION,
    last_location_at TIMESTAMP WITH TIME ZONE,
    google_maps_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLA: SOLICITUDES (Traslado de Herramientas)
CREATE TABLE IF NOT EXISTS public.solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES public.profiles(id) NOT NULL,
    herramienta_id UUID REFERENCES public.herramientas(id) NOT NULL,
    source_obra_id UUID REFERENCES public.obras(id),
    target_obra_id UUID REFERENCES public.obras(id) NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id),
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Baja', 'Normal', 'Alta', 'Urgente')),
    status TEXT DEFAULT 'Pendiente',
    comments TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT solicitudes_status_check CHECK (status IN ('Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada', 'Confirmada', 'Cancelada', 'Rechazada'))
);

-- 7. TABLA: SOLICITUDES DE COMPRAS
CREATE TABLE IF NOT EXISTS public.solicitudes_compras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Baja', 'Normal', 'Alta', 'Urgente')),
    justification TEXT,
    obra_id UUID REFERENCES public.obras(id),
    requester_id UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'En evaluación', 'Aprobada', 'Rechazada', 'Comprada', 'Recibida', 'Cerrada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TABLA: MOVIMIENTOS (Historial de Estados y Traslados)
CREATE TABLE IF NOT EXISTS public.movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    herramienta_id UUID REFERENCES public.herramientas(id) NOT NULL,
    solicitud_id UUID REFERENCES public.solicitudes(id),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    action TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TABLA: MANTENIMIENTOS
CREATE TABLE IF NOT EXISTS public.mantenimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    herramienta_id UUID REFERENCES public.herramientas(id) NOT NULL,
    reported_by UUID REFERENCES public.profiles(id),
    issue_description TEXT NOT NULL,
    status TEXT DEFAULT 'Abierto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. TABLA: TRASLADOS DE PERSONAL
CREATE TABLE IF NOT EXISTS public.traslados_personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID REFERENCES public.empleados(id) NOT NULL,
    source_obra_id UUID REFERENCES public.obras(id),
    target_obra_id UUID REFERENCES public.obras(id) NOT NULL,
    requester_id UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT DEFAULT 'Pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    confirmed_by UUID REFERENCES public.profiles(id),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    CONSTRAINT traslados_personal_status_check CHECK (status IN ('Pendiente', 'Confirmado', 'Cancelado', 'Rechazado'))
);

-- =========================================================================
-- HABILITACIÓN DE SEGURIDAD (RLS)
-- =========================================================================
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herramientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mantenimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traslados_personal ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =========================================================================

-- Obras: Anyone can read, only admin can write
DROP POLICY IF EXISTS "Obras viewable by everyone" ON public.obras;
CREATE POLICY "Obras viewable by everyone" ON public.obras FOR SELECT USING (true);
DROP POLICY IF EXISTS "Obras insert/update by admins" ON public.obras;
CREATE POLICY "Obras insert/update by admins" ON public.obras FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Roles: Anyone can read
DROP POLICY IF EXISTS "Roles viewable by everyone" ON public.roles;
CREATE POLICY "Roles viewable by everyone" ON public.roles FOR SELECT USING (true);

-- Profiles: Anyone can read, users can update their own, admins everything
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile" ON public.profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Empleados: Anyone can read/update (logistics needs to manage obra assignments)
DROP POLICY IF EXISTS "Empleados viewable by everyone" ON public.empleados;
CREATE POLICY "Empleados viewable by everyone" ON public.empleados FOR SELECT USING (true);
DROP POLICY IF EXISTS "Empleados insert/update by authenticated" ON public.empleados;
CREATE POLICY "Empleados insert/update by authenticated" ON public.empleados FOR ALL USING (true) WITH CHECK (true);

-- Herramientas: Anyone can view, anyone can update (for logistics/transfer status)
DROP POLICY IF EXISTS "Herramientas viewable by everyone" ON public.herramientas;
CREATE POLICY "Herramientas viewable by everyone" ON public.herramientas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Herramientas update by anyone" ON public.herramientas;
CREATE POLICY "Herramientas update by anyone" ON public.herramientas FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Herramientas insert by admins" ON public.herramientas;
CREATE POLICY "Herramientas insert by admins" ON public.herramientas FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'compras')));

-- Solicitudes: Anyone can view and insert, anyone can update
DROP POLICY IF EXISTS "Solicitudes viewable by everyone" ON public.solicitudes;
CREATE POLICY "Solicitudes viewable by everyone" ON public.solicitudes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert solicitudes" ON public.solicitudes;
CREATE POLICY "Anyone can insert solicitudes" ON public.solicitudes FOR INSERT WITH CHECK (auth.uid() = requester_id);
DROP POLICY IF EXISTS "Anyone can update solicitudes" ON public.solicitudes;
CREATE POLICY "Anyone can update solicitudes" ON public.solicitudes FOR UPDATE USING (true);

-- Solicitudes de Compras: Anyone can view, insert, and update
DROP POLICY IF EXISTS "SolicitudesCompras viewable by everyone" ON public.solicitudes_compras;
CREATE POLICY "SolicitudesCompras viewable by everyone" ON public.solicitudes_compras FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert solicitudes_compras" ON public.solicitudes_compras;
CREATE POLICY "Anyone can insert solicitudes_compras" ON public.solicitudes_compras FOR INSERT WITH CHECK (auth.uid() = requester_id);
DROP POLICY IF EXISTS "Anyone can update solicitudes_compras" ON public.solicitudes_compras;
CREATE POLICY "Anyone can update solicitudes_compras" ON public.solicitudes_compras FOR UPDATE USING (true);

-- Movimientos: Anyone can view, user can insert
DROP POLICY IF EXISTS "Movimientos viewable by everyone" ON public.movimientos;
CREATE POLICY "Movimientos viewable by everyone" ON public.movimientos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert movimientos" ON public.movimientos;
CREATE POLICY "Anyone can insert movimientos" ON public.movimientos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Traslados de Personal: Anyone can read, anyone can write
DROP POLICY IF EXISTS "traslados_personal_read" ON public.traslados_personal;
CREATE POLICY "traslados_personal_read" ON public.traslados_personal FOR SELECT USING (true);
DROP POLICY IF EXISTS "traslados_personal_write" ON public.traslados_personal;
CREATE POLICY "traslados_personal_write" ON public.traslados_personal FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- PERMISOS Y CONCESIÓN DE GRANTS (CRÍTICO PARA LA API DE SUPABASE)
-- =========================================================================
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

-- =========================================================================
-- TRIGGERS Y FUNCIONES DE AUTOMATIZACIÓN DE PERFILES
-- =========================================================================
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- =========================================================================
-- SEED DATA FROM PRODUCTION (AUTO-GENERATED ON 2026-05-18T04:11:54.828Z)
-- =========================================================================

ALTER TABLE IF EXISTS public.profiles DISABLE TRIGGER ALL;
ALTER TABLE IF EXISTS public.solicitudes DISABLE TRIGGER ALL;

-- Table: obras
DELETE FROM public.obras; -- Clear existing records
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('1006c590-c141-4770-a666-329a6c0e3511', 'AltaVista', 'AltaVista', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('e4422d80-9da6-4931-96e9-0db03838c2aa', 'AlterPoint', 'AlterPoint', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('11d360c3-c877-46a8-82c4-b8fe47b1bb55', 'Rioja 856', 'Rioja 856', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('c6b2b823-3da3-463e-b992-6c5d4963a988', 'Las Piedras 1668', 'Las Piedras 1668', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('9406838a-6735-46c6-96b4-59188d4f02e6', 'YPF Banda del Rio Sali', 'Banda del Rio Sali', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('dc0d9d57-f6b2-4def-b28b-ae155f67589d', 'One Residence', 'Thames Norte', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('678fcd32-2b24-43bd-8849-5be995a94444', 'Ituzaingo y Ruben Dario', 'Yerba Buena', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('2b3d295b-0efa-447c-951d-9e3895db3b6c', 'Oficina Nueva - Edificio Isaura', 'Edificio Isaura', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('0ee6847a-b41e-45fa-97f0-7b6afa36c7fb', 'Casa Pringles', 'San Martin y Pringles', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('d298f3db-1adc-4606-8ad3-43fbc7d2f93f', 'Arquitectos y Asociados', 'Catamarca', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('3782125a-2bf2-4120-9fe3-815f86a07223', 'Coletti - Waldhaus', 'Waldhaus', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('36c94651-0aaf-486e-a69b-4dca3e524ee8', 'DEPOSITO PEIE', 'Deposito Central', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('0770e57d-3251-486f-855b-0cdd91579912', 'MANTENIMIENTO', 'Taller de Mantenimiento', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('8dfd64e6-5a55-46a1-9625-76986c4082b9', 'Quality Barrio Norte', 'Junin esq. Santa Fe (SMT)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', 'Martin', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('4f3f542b-e130-495f-a0f5-bb133619068d', 'One Boulevard', 'Salta 560 (SMT)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', 'Martin', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('e8e5771b-0cd5-4ff7-8582-49033993154b', 'Torre Duo - Link', 'Av. Mate de Luna y Thames (SMT)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', 'Christian', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('03258fc6-a274-4812-920e-f28b5fd4901b', 'Domus', 'Boulevard 9 de Julio 1265 (Yerba Buena)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', 'Franco', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('f445d7da-0414-48a6-bfff-a37ef38d43e2', 'Country Cantares', 'Diagonal Lechesi (Tafi Viejo)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', 'Franco', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('82264273-36a9-438f-b5ce-fbf8cb0588ce', 'Alberdi 152', 'Alberdi 185 (SMT)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('9918df5a-6cc8-4438-829a-7399117465f0', 'San Pablo', 'Av Solano Vera RP339 Km 5 (San Pablo)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('f7874eb1-8aab-4bbb-bd80-5218784dd87f', 'Bamboo', 'Anzorena y Cariola (Yerba Buena)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('28ba50d8-40d3-4b9b-8537-faa9f99b477a', '#300 - Link', 'Av. Peron 480 (Yerba Buena)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', 'Christian', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('905a9118-ddb1-4e95-b410-926871729f84', 'Aeropuerto', 'Av. Santiago Gallo 4117 (SMT)', true, '2026-05-16T17:03:15.474198+00:00', 'En Proceso', 'Martin', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('940058be-7744-49ce-8ce1-2b117099d163', 'Shell Oasis', 'Ex Ruta 9 Km 1288 (Banda del Rio Sali)', true, '2026-05-16T17:01:21.204245+00:00', 'En Proceso', 'Franco', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.obras (id, name, address, active, created_at, status, encargado_name, code, photo_url, phone, latitude, longitude) VALUES ('f58df9cd-3c96-4e46-8898-2f710269de63', 'Obra Central', 'Santiago del Estero, Argentina', true, '2026-05-16T16:56:31.925466+00:00', 'En Proceso', 'Martin', 'OBRA-001', '/img/foto_obra_central.jpg', NULL, NULL, NULL);

-- Table: profiles
DELETE FROM public.profiles; -- Clear existing records
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('5ae8abbd-c7c1-48bc-b28f-27b2d74ee6f1', 'Administrador General', 'admin', '+543810000000', '/img/foto_empleado_santiago.jpg', true, '2026-05-16T16:56:31.925466+00:00', NULL, NULL);
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Santiago Moreno', 'logistica', '+543815158212', '/img/foto_empleado_santiago.jpg', true, '2026-05-16T16:56:31.925466+00:00', NULL, NULL);
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('68a0fc95-2048-4a3a-8d5b-6af8b4142c0f', 'Cristian Perez', 'encargado', '+543816490060', '/img/foto_empleado_santiago.jpg', true, '2026-05-16T16:56:31.925466+00:00', NULL, NULL);
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('e31019fa-b201-492a-93c2-4af14fe26a5b', 'Federico Grande', 'admin', '+54 9 3814 01-5738', '/img/foto_empleado_santiago.jpg', true, '2026-05-16T16:56:31.925466+00:00', NULL, NULL);
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('5bed2b00-940f-41f5-88a9-83a86f33903e', 'Florencia Grande', 'admin', '+54 9 3813 32-3666', '/img/foto_empleado_santiago.jpg', true, '2026-05-16T16:56:31.925466+00:00', NULL, NULL);
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Melisa Gonzales', 'admin', '+54 9 3816 29-5626', '/img/foto_empleado_santiago.jpg', true, '2026-05-16T16:56:31.925466+00:00', NULL, NULL);
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('84d21d6a-81a8-45a8-9b23-212db945052c', 'FRANCIS', 'logistica', '+543816490060', NULL, true, '2026-05-16T19:26:58.532405+00:00', NULL, NULL);
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('7b86cb1a-0d26-4117-a2ec-66e339b37fd9', 'Franco Lobo', 'encargado', '+54 9 381 402-2910', '/img/foto_empleado_franco.jpg', true, '2026-05-16T16:56:31.925466+00:00', NULL, NULL);
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('90702240-ad72-44a1-b19c-f47e7e3f60a7', 'Carlos Grande', 'admin', '+54 9 381 604-4615', NULL, true, '2026-05-16T19:46:07.167284+00:00', 'Carlos', NULL);
INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url, active, created_at, username, obra_id) VALUES ('586d95a0-df23-42c7-926a-892d9b7e52a6', 'Martin Grande', 'solicitante', '+54 9 3816 69-8316', '/img/foto_empleado_martin.jpg', true, '2026-05-16T16:56:31.925466+00:00', 'martin', NULL);

-- Table: empleados
DELETE FROM public.empleados; -- Clear existing records
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('2fe85a3d-32fa-4230-8845-7860851e449a', 'Ale, Hector Antonio', 'operario', true, '2026-05-13T22:10:25.990401+00:00', NULL, NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('966d6e96-8751-4e5b-8d9c-763569b265d1', 'Aguirresarobe, Marcelo', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('1d847ff3-53ad-44cc-851a-97e1ad385cb6', 'Juarez, Edgar Maximiliano', 'operario', true, '2026-05-16T17:01:21.204245+00:00', NULL, NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('a44cd69c-d4ad-4f99-88df-f674d6818378', 'Ledesma, Marcos German', 'operario', true, '2026-05-13T22:10:25.990401+00:00', '8dfd64e6-5a55-46a1-9625-76986c4082b9', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('7eb42568-b64f-477b-ba22-173e7ce3cb0e', 'Torres, Jorge Manuel', 'operario', true, '2026-05-13T22:10:25.990401+00:00', '8dfd64e6-5a55-46a1-9625-76986c4082b9', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('6f916682-76f4-4597-9fe1-c1b6d18ac5ce', 'De la Rosa, Christian', 'operario', true, '2026-05-16T17:01:21.204245+00:00', '4f3f542b-e130-495f-a0f5-bb133619068d', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('05c93b97-c150-41bd-b839-3f0b97173087', 'Alvarez, Carlos Antonio', 'operario', true, '2026-05-13T22:10:25.990401+00:00', 'e8e5771b-0cd5-4ff7-8582-49033993154b', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('004c950d-8eca-466a-bc96-6bc54dfd50b7', 'Rojas, Carlos Daniel', 'operario', true, '2026-05-13T22:10:25.990401+00:00', 'e8e5771b-0cd5-4ff7-8582-49033993154b', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('34b1e25a-aa64-4e5f-9938-8852a532e73a', 'Catan, David Nazareno', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'e8e5771b-0cd5-4ff7-8582-49033993154b', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('3b5d60e6-ca36-4755-b616-5478cc82c999', 'Espinoza, Facundo', 'operario', true, '2026-05-13T22:10:25.990401+00:00', '03258fc6-a274-4812-920e-f28b5fd4901b', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('0f0ab881-f720-4d80-9676-86188092348d', 'Blanco Medina, Yonatan Gabriel', 'operario', true, '2026-05-16T17:01:21.204245+00:00', '03258fc6-a274-4812-920e-f28b5fd4901b', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('2589f2db-eae8-4244-b99e-087988f6894f', 'Cruz, Gustavo Manuel', 'operario', true, '2026-05-16T17:01:21.204245+00:00', '03258fc6-a274-4812-920e-f28b5fd4901b', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('9aa4e7bb-2f0a-4705-b120-ebcb3297bcf0', 'Blanco Medina, Juan Jose', 'operario', true, '2026-05-13T22:10:25.990401+00:00', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('e517fbbf-cf9f-42ee-b931-9835c8d4dc4a', 'Moreno, Santiago', 'operario', true, '2026-05-16T17:01:21.204245+00:00', NULL, NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('65559788-cb4b-4c84-8e63-6af1e28fceac', 'Lobos, Eduardo Marcelo', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'e8e5771b-0cd5-4ff7-8582-49033993154b', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('cecbaa9b-08cf-456b-8190-5be70e644bb3', 'Lopez, Ramon Edgardo', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'e8e5771b-0cd5-4ff7-8582-49033993154b', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('bc614018-bc45-4d5b-8a7e-1be053620334', 'Medina, Franco Daniel', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'e8e5771b-0cd5-4ff7-8582-49033993154b', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('2611a9f0-102b-4649-9e88-2a69923ce5a4', 'Altamiranda, Esteban German', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('aabf7666-33c0-4f9a-8ba9-47f78e2ba014', 'Catan, Cristian Alejandro', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('8dbe145a-8bbb-473c-89fd-4676043b2c97', 'Lucena, Enzo Emanuel', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('2116a15c-f8a0-42f0-90d7-03150dc7935f', 'Mendoza, Rene Nestor', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('329db722-df30-4db0-898d-d4f58772bbd8', 'Rivero, Leandro Nicolas', 'operario', true, '2026-05-13T22:10:25.990401+00:00', 'f7874eb1-8aab-4bbb-bd80-5218784dd87f', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('4fa4a43b-642a-4b68-a623-ee99af511e16', 'Olivera, Cristhian Gaston', 'operario', true, '2026-05-16T17:01:21.204245+00:00', 'f7874eb1-8aab-4bbb-bd80-5218784dd87f', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('95e36806-26dd-4615-bcb9-526dba715988', 'Jimenez, Santiago Emanuel', 'operario', true, '2026-05-13T22:10:25.990401+00:00', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('13be65ee-b6ef-4538-b795-be57052ab3ca', 'Lopez, Nicolas Eduardo', 'operario', true, '2026-05-13T22:10:25.990401+00:00', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('35273b2f-f342-465f-90df-d544a3602821', 'Lopez, Leonardo Andres', 'operario', true, '2026-05-13T22:10:25.990401+00:00', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('8374cc83-6e8f-488e-b9b8-862d189de3dc', 'Lizarraga, Gustavo Matias', 'operario', true, '2026-05-16T17:01:21.204245+00:00', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('20534026-cbe8-4d87-a380-278a3545ddf3', 'Carrizo, Luis Fabian', 'operario', true, '2026-05-13T22:10:25.990401+00:00', '905a9118-ddb1-4e95-b410-926871729f84', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('54ca1b40-5c78-4718-8615-49de94600706', 'Paz, Jorge Gaston', 'operario', true, '2026-05-13T22:10:25.990401+00:00', '905a9118-ddb1-4e95-b410-926871729f84', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('77baa3f9-0f57-4975-ad9c-1825e0c4cf98', 'Martinez, Guillermo Ariel', 'operario', true, '2026-05-16T17:01:21.204245+00:00', '905a9118-ddb1-4e95-b410-926871729f84', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('2bb4fc2c-cc40-465f-87db-acfa4ec6372a', 'Ybanez, Leonardo Dario', 'operario', true, '2026-05-16T17:01:21.204245+00:00', '905a9118-ddb1-4e95-b410-926871729f84', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('561c35be-e212-43da-921b-2ea955a75a75', 'Ybanez, Pablo Alejandro', 'operario', true, '2026-05-16T17:01:21.204245+00:00', '905a9118-ddb1-4e95-b410-926871729f84', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('197f2b99-f307-49ca-b2b2-5a1f21d73cfe', 'Flores, Hector Alexis', 'operario', true, '2026-05-13T22:10:25.990401+00:00', '940058be-7744-49ce-8ce1-2b117099d163', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('1882adbd-5e6c-4fdc-9b55-8d976091c1a7', 'Ibanez, Manuel Enrique', 'operario', true, '2026-05-16T17:01:21.204245+00:00', '940058be-7744-49ce-8ce1-2b117099d163', NULL);
INSERT INTO public.empleados (id, full_name, role, active, created_at, obra_id, whatsapp) VALUES ('bc79beb7-26c7-4d94-858a-10ce6d988bdf', 'Castro, Gustavo Mauricio', 'operario', true, '2026-05-16T17:01:21.204245+00:00', NULL, NULL);

-- Table: herramientas
DELETE FROM public.herramientas; -- Clear existing records
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('c5c1efd3-d525-4b2d-8adb-a903d74b872a', 'A-41/2-04', 'Amoladora 4 1/2"', 'Black&Decker', '4 1/2"', 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('9cc0b2e8-0703-4c1f-95fc-914d6d92a3bd', 'A-7-01', 'Amoladora 7"', 'Total', '7"', 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('b0500623-776c-4b16-8856-db3709b3d274', 'A-7-02', 'Amoladora 7"', 'Total', '7"', 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('bc94a129-65f6-4ea5-a052-085878f65f98', 'ANC-01', 'Cuerpo Andamio 1', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('4bd0ce7f-b434-4412-9f65-382a3c55cd1f', 'ANC-02', 'Cuerpo Andamio 2', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('c258b92c-3cc0-4455-80cf-208a56cf6a5f', 'ANC-03', 'Cuerpo Andamio 3', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('1b2bbc20-18a1-4691-9f6f-69264d096816', 'ARN-01', 'Arnes', 'Amarillo', NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('b630dda3-17f7-4c52-9c6d-d8cb6ae33665', 'ESC-01', 'Escalera 1', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('83bff0f7-2b8a-49bc-815b-7791a5ee9d66', 'ESC-02', 'Escalera 2', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('a09b2b3e-d62b-4810-9730-0e28a8c19316', 'ESC-03', 'Escalera 3', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('75e89e3d-9704-4b86-8b54-dcd765a58416', 'ESC-04', 'Escalera 4', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('02b7b2b7-e3cd-43f0-8bb1-a83e1b4cd3dd', 'ESC-05', 'Escalera 5', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('9b5597de-c632-48a0-92bc-d0308ecbdf61', 'GA-01', 'Garrafa', 'Negra', NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('93844d09-bbcd-4276-af31-23cff31d39d5', 'GA-02', 'Garrafa', 'Roja', NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('40d7813e-0ddf-4637-8382-c82947dcce88', 'PI-01', 'Pinza de identar', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('920d4afb-b57a-439b-9837-d22e00240328', 'PI-02', 'Pinza de identar', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('ad39ac29-ed4b-40bc-af24-5d18184dd9fd', 'RES-20-01', 'Resorte 20mm (3/4")', NULL, '20mm', 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('0b6c1cf0-f2e9-4190-98a4-bacf535e2a9a', 'RES-22-01', 'Resorte 22mm (7/8")', NULL, '22mm', 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('010af143-e609-40bf-af6a-cecc44568630', 'RES-25-01', 'Resorte 25mm (1")', NULL, '25mm', 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('9338a3db-9c83-4363-8b9f-7a125a933337', 'RTD01', 'Rotomartillo demoledor', 'Barovo', NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('6b5b3253-f83b-43fd-8096-e2192ae19508', 'RTP-01', 'Rotomartillo percutor', 'Barovo', NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('bbdc9ccd-5936-473e-a843-f7d6c9bba1d2', 'TCC-01', 'Tijera corta cable', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('01a8f4c5-ba77-4c7c-ae9c-b4ca191f36be', 'TCC-02', 'Tijera corta cable', NULL, NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('d376c39d-c0b4-4a44-bd54-56e7f5d712ad', 'TP-01', 'Taladro percutor', 'Total', NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('43b3b460-a522-40da-a212-f2e3b131a47d', 'TP-02', 'Taladro chico', 'Barovo', NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('ae07b8b9-c76d-4105-8ca1-ad204313f744', 'TRP-01', 'Taladro rotopercutor', 'Dewalt', NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('1a81a5a4-551a-4773-a692-1cec6ae370a2', 'TRP-02', 'Taladro rotopercutor', 'Barovo', NULL, 'Disponible', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('6169a539-e644-4176-8ff2-7e0fbc28f8c9', 'A-41/2-01', 'Amoladora 4 1/2"', 'Hamilton', '4 1/2"', 'En uso', '905a9118-ddb1-4e95-b410-926871729f84', '2026-05-16T17:01:21.204245+00:00', -26.8508333807317, -65.2159666798524, 129, '2026-05-16T19:01:14.974+00:00', 'https://www.google.com/maps?q=-26.850833380731686,-65.2159666798524', NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('e4e9bfb1-a074-46af-a09b-4f8a80876e32', 'A-41/2-02', 'Amoladora 4 1/2"', 'Skil', '4 1/2"', 'En uso', '905a9118-ddb1-4e95-b410-926871729f84', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('d4194a99-5c01-4e88-815f-2ba436732c6f', 'A-41/2-03', 'Amoladora 4 1/2"', 'Hamilton', '4 1/2"', 'En uso', '82264273-36a9-438f-b5ce-fbf8cb0588ce', '2026-05-16T17:01:21.204245+00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.herramientas (id, code, name, brand, model, status, current_obra_id, created_at, last_latitude, last_longitude, last_location_accuracy, last_location_at, google_maps_url, photo_url, qr_code, description, notes) VALUES ('3a807f8d-ba27-405a-b867-a105fc670e21', 'TAL-001', 'Taladro Bosch', 'Bosch', 'GSB 13 RE', 'En uso', '905a9118-ddb1-4e95-b410-926871729f84', '2026-05-16T16:56:31.925466+00:00', NULL, NULL, NULL, NULL, NULL, '/img/foto_herramienta_taladro.jpg', NULL, NULL, NULL);

-- Table: solicitudes
DELETE FROM public.solicitudes; -- Clear existing records
INSERT INTO public.solicitudes (id, requester_id, herramienta_id, source_obra_id, target_obra_id, assigned_to, priority, status, created_at, comments, rejection_reason) VALUES ('7bccc890-9326-449d-9806-1b6cf1f49a9b', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', '6169a539-e644-4176-8ff2-7e0fbc28f8c9', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '905a9118-ddb1-4e95-b410-926871729f84', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Normal', 'Entregada', '2026-05-16T17:20:47.456937+00:00', NULL, NULL);
INSERT INTO public.solicitudes (id, requester_id, herramienta_id, source_obra_id, target_obra_id, assigned_to, priority, status, created_at, comments, rejection_reason) VALUES ('3f023161-a29c-4c5e-b401-8de221a24731', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'e4e9bfb1-a074-46af-a09b-4f8a80876e32', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '905a9118-ddb1-4e95-b410-926871729f84', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Urgente', 'Entregada', '2026-05-16T19:30:24.19068+00:00', NULL, NULL);
INSERT INTO public.solicitudes (id, requester_id, herramienta_id, source_obra_id, target_obra_id, assigned_to, priority, status, created_at, comments, rejection_reason) VALUES ('54e2fd15-cd5e-45b9-97b2-a941c954c6b5', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'd4194a99-5c01-4e88-815f-2ba436732c6f', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '82264273-36a9-438f-b5ce-fbf8cb0588ce', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Alta', 'Entregada', '2026-05-16T19:38:39.01959+00:00', 'Entregar a pablo', NULL);
INSERT INTO public.solicitudes (id, requester_id, herramienta_id, source_obra_id, target_obra_id, assigned_to, priority, status, created_at, comments, rejection_reason) VALUES ('9590b22e-eafc-4eb6-913e-28194b73245e', '7b86cb1a-0d26-4117-a2ec-66e339b37fd9', '3a807f8d-ba27-405a-b867-a105fc670e21', 'f58df9cd-3c96-4e46-8898-2f710269de63', '905a9118-ddb1-4e95-b410-926871729f84', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Normal', 'Entregada', '2026-05-17T18:33:00.224296+00:00', 'Tfvtdf', NULL);

-- Table: solicitudes_compras
DELETE FROM public.solicitudes_compras; -- Clear existing records
INSERT INTO public.solicitudes_compras (id, tool_name, description, quantity, priority, justification, obra_id, requester_id, status, created_at) VALUES ('10ef3109-2d37-4770-a441-d67d40e31d75', 'Amoladora', 'Entregar a la mole', 1, 'Normal', 'Se necesita para otro electricista ', '905a9118-ddb1-4e95-b410-926871729f84', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Recibida', '2026-05-16T19:40:57.222283+00:00');

-- Table: movimientos
DELETE FROM public.movimientos; -- Clear existing records
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('f471a282-b3e4-4c84-8cf9-316b71f3e2dc', '6169a539-e644-4176-8ff2-7e0fbc28f8c9', '7bccc890-9326-449d-9806-1b6cf1f49a9b', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Generó solicitud de traslado', 'Hacia obra destino con prioridad Normal', '2026-05-16T17:20:47.803164+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('bb6b31d8-c5c3-4e75-ac76-efe7695ac91c', '6169a539-e644-4176-8ff2-7e0fbc28f8c9', '7bccc890-9326-449d-9806-1b6cf1f49a9b', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: Asignada', 'Gestionado por Santiago Moreno', '2026-05-16T17:21:26.143508+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('25d27f7d-d11b-422d-acfb-09d2d2256b92', '6169a539-e644-4176-8ff2-7e0fbc28f8c9', '7bccc890-9326-449d-9806-1b6cf1f49a9b', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: En retiro', 'Gestionado por Santiago Moreno', '2026-05-16T17:21:30.997316+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('9986e7a9-123e-46b6-a223-64bee40578f3', '6169a539-e644-4176-8ff2-7e0fbc28f8c9', '7bccc890-9326-449d-9806-1b6cf1f49a9b', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: En traslado', 'Gestionado por Santiago Moreno', '2026-05-16T17:21:35.295063+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('c1b52e53-682d-4130-8791-24a73b9878bd', '6169a539-e644-4176-8ff2-7e0fbc28f8c9', '7bccc890-9326-449d-9806-1b6cf1f49a9b', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Cambio de estado a: Entregada', 'Gestionado por Melisa Gonzales', '2026-05-16T17:22:22.412876+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('3a1da18a-57f5-41ec-9022-c6801a123c4a', 'e4e9bfb1-a074-46af-a09b-4f8a80876e32', '3f023161-a29c-4c5e-b401-8de221a24731', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Generó solicitud de traslado', 'Hacia obra destino con prioridad Urgente', '2026-05-16T19:30:24.523832+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('49a1b0fa-a01f-40cb-a4be-e9f92cbe4f94', 'e4e9bfb1-a074-46af-a09b-4f8a80876e32', '3f023161-a29c-4c5e-b401-8de221a24731', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: Asignada', 'Gestionado por Santiago Moreno', '2026-05-16T19:31:22.951771+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('4b921905-9208-438e-a7c5-617b21a7a382', 'e4e9bfb1-a074-46af-a09b-4f8a80876e32', '3f023161-a29c-4c5e-b401-8de221a24731', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: En retiro', 'Gestionado por Santiago Moreno', '2026-05-16T19:32:00.547671+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('4127a65a-5226-419c-868c-2fb4ed8627ef', 'e4e9bfb1-a074-46af-a09b-4f8a80876e32', '3f023161-a29c-4c5e-b401-8de221a24731', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: En traslado', 'Gestionado por Santiago Moreno', '2026-05-16T19:32:12.5295+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('0c61a39b-a817-472e-bbad-d63b7e4894a5', 'e4e9bfb1-a074-46af-a09b-4f8a80876e32', '3f023161-a29c-4c5e-b401-8de221a24731', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: Entregada', 'Gestionado por Santiago Moreno', '2026-05-16T19:32:17.905584+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('1b3bd0d2-ce1c-4fd4-9db8-4f47368672e3', 'e4e9bfb1-a074-46af-a09b-4f8a80876e32', '3f023161-a29c-4c5e-b401-8de221a24731', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Cambio de estado a: Entregada', 'Gestionado por Melisa Gonzales', '2026-05-16T19:32:19.230007+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('74bd28f7-ae44-46f4-a4fa-1d2f31d7cc36', 'd4194a99-5c01-4e88-815f-2ba436732c6f', '54e2fd15-cd5e-45b9-97b2-a941c954c6b5', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Generó solicitud de traslado', 'Hacia obra destino con prioridad Alta', '2026-05-16T19:38:39.475046+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('fe5aa1d6-d1a4-4c5a-b8a5-e3f4f5ddff25', 'd4194a99-5c01-4e88-815f-2ba436732c6f', '54e2fd15-cd5e-45b9-97b2-a941c954c6b5', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Cambio de estado a: Asignada', 'Gestionado por Melisa Gonzales', '2026-05-16T19:39:30.460437+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('bea72009-80ea-48a9-9be7-b30e6ba46225', 'd4194a99-5c01-4e88-815f-2ba436732c6f', '54e2fd15-cd5e-45b9-97b2-a941c954c6b5', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Cambio de estado a: En retiro', 'Gestionado por Melisa Gonzales', '2026-05-16T19:39:49.022544+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('27a32797-375d-4c2f-98b7-9b913177338c', 'd4194a99-5c01-4e88-815f-2ba436732c6f', '54e2fd15-cd5e-45b9-97b2-a941c954c6b5', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Cambio de estado a: En traslado', 'Gestionado por Melisa Gonzales', '2026-05-16T19:39:52.875525+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('bafa5bdf-7c5c-4ba8-99f4-0761d9f3b42b', 'd4194a99-5c01-4e88-815f-2ba436732c6f', '54e2fd15-cd5e-45b9-97b2-a941c954c6b5', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Cambio de estado a: Entregada', 'Gestionado por Melisa Gonzales', '2026-05-16T19:39:55.591055+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('e7904674-9642-4336-834c-5adb200a42d9', '3a807f8d-ba27-405a-b867-a105fc670e21', '9590b22e-eafc-4eb6-913e-28194b73245e', '7b86cb1a-0d26-4117-a2ec-66e339b37fd9', 'Generó solicitud de traslado', 'Hacia obra destino con prioridad Normal', '2026-05-17T18:33:00.637476+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('2e045402-ddbb-4c55-ae2b-b5f71f853e4b', '3a807f8d-ba27-405a-b867-a105fc670e21', '9590b22e-eafc-4eb6-913e-28194b73245e', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: Asignada', 'Gestionado por Santiago Moreno', '2026-05-17T18:34:10.0187+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('a52200c6-0951-44cf-a886-f59b5c0daac3', '3a807f8d-ba27-405a-b867-a105fc670e21', '9590b22e-eafc-4eb6-913e-28194b73245e', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: En retiro', 'Gestionado por Santiago Moreno', '2026-05-17T18:34:39.083687+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('419e8aae-a069-4a64-9535-811fe86b2cdc', '3a807f8d-ba27-405a-b867-a105fc670e21', '9590b22e-eafc-4eb6-913e-28194b73245e', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: En traslado', 'Gestionado por Santiago Moreno', '2026-05-17T18:34:47.068077+00:00');
INSERT INTO public.movimientos (id, herramienta_id, solicitud_id, user_id, action, notes, created_at) VALUES ('af622977-c661-48fa-b94c-3d3c04278200', '3a807f8d-ba27-405a-b867-a105fc670e21', '9590b22e-eafc-4eb6-913e-28194b73245e', '5d3a6197-42fc-4c59-9add-11d97a84c0c9', 'Cambio de estado a: Entregada', 'Gestionado por Santiago Moreno', '2026-05-17T18:34:57.95697+00:00');

-- Table: traslados_personal
DELETE FROM public.traslados_personal; -- Clear existing records
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('9263ad22-0c74-4f17-95be-98b612755405', '2fe85a3d-32fa-4230-8845-7860851e449a', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', '586d95a0-df23-42c7-926a-892d9b7e52a6', 'Pendiente', '2026-05-16T18:06:49.321812+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('8bda630b-3b8f-46ed-91cb-a6aac5af8a69', '966d6e96-8751-4e5b-8d9c-763569b265d1', '905a9118-ddb1-4e95-b410-926871729f84', '586d95a0-df23-42c7-926a-892d9b7e52a6', 'Pendiente', '2026-05-16T18:07:33.479935+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('3d3ff0b4-1f72-4ab2-82eb-f1941f8c3296', '966d6e96-8751-4e5b-8d9c-763569b265d1', '36c94651-0aaf-486e-a69b-4dca3e524ee8', '586d95a0-df23-42c7-926a-892d9b7e52a6', 'Pendiente', '2026-05-16T18:08:03.691719+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('adfc7c9c-6d07-47d2-a382-74a53a2e8d93', '966d6e96-8751-4e5b-8d9c-763569b265d1', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', '586d95a0-df23-42c7-926a-892d9b7e52a6', 'Pendiente', '2026-05-16T18:11:38.184269+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('524af99c-9914-44c8-b752-602f05d535d0', '966d6e96-8751-4e5b-8d9c-763569b265d1', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', '586d95a0-df23-42c7-926a-892d9b7e52a6', 'Pendiente', '2026-05-16T18:19:04.516582+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('4bfe4d37-5711-4c66-a81d-bc1ae22408cf', '966d6e96-8751-4e5b-8d9c-763569b265d1', '905a9118-ddb1-4e95-b410-926871729f84', '586d95a0-df23-42c7-926a-892d9b7e52a6', 'Pendiente', '2026-05-16T18:22:36.618318+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('a60a7ad7-aee5-4189-9d0a-f5fd8739179d', '966d6e96-8751-4e5b-8d9c-763569b265d1', '905a9118-ddb1-4e95-b410-926871729f84', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T18:33:02.108644+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('cfee3fb7-1bd3-40c2-8520-6d1ac64cfec0', 'bc79beb7-26c7-4d94-858a-10ce6d988bdf', '905a9118-ddb1-4e95-b410-926871729f84', '586d95a0-df23-42c7-926a-892d9b7e52a6', 'Pendiente', '2026-05-16T18:37:15.793313+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('ce73780b-661f-4bf9-b5e1-445d90cf16e1', '1d847ff3-53ad-44cc-851a-97e1ad385cb6', '905a9118-ddb1-4e95-b410-926871729f84', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T18:43:25.983374+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('9cba22ed-e01b-46be-8918-5e2cc908dd56', '966d6e96-8751-4e5b-8d9c-763569b265d1', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T18:44:07.827977+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('e32a0a34-8457-4473-a191-842fc29f6dab', '966d6e96-8751-4e5b-8d9c-763569b265d1', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T18:44:28.121445+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('5a30e5e8-a1ba-47de-b5d3-4dc2802e7eee', '966d6e96-8751-4e5b-8d9c-763569b265d1', 'f58df9cd-3c96-4e46-8898-2f710269de63', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T18:44:39.220194+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('2b654235-256c-4e44-9905-f0c2a20c4eda', '966d6e96-8751-4e5b-8d9c-763569b265d1', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T18:49:53.693627+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('a12778f0-73e8-418c-84c4-f822478a7f26', '966d6e96-8751-4e5b-8d9c-763569b265d1', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T18:57:00.687186+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('d4a4ceec-62df-4387-9f17-252b89a1d16d', '966d6e96-8751-4e5b-8d9c-763569b265d1', 'f58df9cd-3c96-4e46-8898-2f710269de63', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T18:57:43.452756+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('eef94c44-bc80-44c0-812c-dcc6f3968518', '966d6e96-8751-4e5b-8d9c-763569b265d1', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T19:24:28.200189+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('78d4147c-92e8-422b-9b48-f02c4f1e5c30', '966d6e96-8751-4e5b-8d9c-763569b265d1', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Confirmado', '2026-05-16T20:04:41.429905+00:00', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', '2026-05-16T20:20:23.101+00:00', NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('87101a29-1773-4d35-a62d-08f6767f8d2d', '966d6e96-8751-4e5b-8d9c-763569b265d1', 'f58df9cd-3c96-4e46-8898-2f710269de63', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Rechazado', '2026-05-16T19:38:47.022981+00:00', NULL, NULL, 'no
', NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('42e6e6bb-e1a3-4931-8b72-601260dbd387', '966d6e96-8751-4e5b-8d9c-763569b265d1', '4f3f542b-e130-495f-a0f5-bb133619068d', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T21:52:24.012431+00:00', NULL, NULL, NULL, 'f445d7da-0414-48a6-bfff-a37ef38d43e2');
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('fbc1bcae-ec1e-45d1-a42a-dc483436fc57', '2fe85a3d-32fa-4230-8845-7860851e449a', 'e8e5771b-0cd5-4ff7-8582-49033993154b', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T21:52:59.792433+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('ea30b6d6-40c1-4fb4-877d-b5531f556936', '966d6e96-8751-4e5b-8d9c-763569b265d1', '4f3f542b-e130-495f-a0f5-bb133619068d', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T21:53:45.891624+00:00', NULL, NULL, NULL, 'f445d7da-0414-48a6-bfff-a37ef38d43e2');
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('e27ede0e-fbd6-462f-b0e1-2ebd7b5898c6', 'bc79beb7-26c7-4d94-858a-10ce6d988bdf', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', '2f5ddb7b-ae11-4134-a9c2-a825ab7a0ee9', 'Pendiente', '2026-05-16T21:54:23.695937+00:00', NULL, NULL, NULL, NULL);
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('f54c0493-0f57-4be3-8649-3d7dfa0811c7', '966d6e96-8751-4e5b-8d9c-763569b265d1', '28ba50d8-40d3-4b9b-8537-faa9f99b477a', '586d95a0-df23-42c7-926a-892d9b7e52a6', 'Pendiente', '2026-05-16T21:57:09.838742+00:00', NULL, NULL, NULL, 'f445d7da-0414-48a6-bfff-a37ef38d43e2');
INSERT INTO public.traslados_personal (id, empleado_id, target_obra_id, requester_id, status, created_at, confirmed_by, confirmed_at, rejection_reason, source_obra_id) VALUES ('4193d37c-843e-426a-8615-dd8a68f3545c', '2fe85a3d-32fa-4230-8845-7860851e449a', 'f445d7da-0414-48a6-bfff-a37ef38d43e2', '586d95a0-df23-42c7-926a-892d9b7e52a6', 'Pendiente', '2026-05-16T21:57:28.449121+00:00', NULL, NULL, NULL, NULL);

ALTER TABLE IF EXISTS public.profiles ENABLE TRIGGER ALL;
ALTER TABLE IF EXISTS public.solicitudes ENABLE TRIGGER ALL;
