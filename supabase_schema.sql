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
