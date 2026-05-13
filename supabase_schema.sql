-- Supabase Schema for PEIE Tools

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tablas principales
CREATE TABLE obras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    manager_name TEXT,
    phone TEXT,
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

-- RLS (Row Level Security) Policies
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE herramientas ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;

-- Obras: Anyone can read, only admin can insert/update
CREATE POLICY "Obras are viewable by everyone" ON obras FOR SELECT USING (true);
CREATE POLICY "Obras insert by admins" ON obras FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Obras update by admins" ON obras FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Profiles: Users can read all profiles (to assign, etc.), users can update their own profile, admin can do everything
CREATE POLICY "Profiles viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can update any profile" ON profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Herramientas: Anyone can view, admin can insert/update
CREATE POLICY "Herramientas viewable by everyone" ON herramientas FOR SELECT USING (true);
CREATE POLICY "Herramientas update by anyone" ON herramientas FOR UPDATE USING (true); -- allowed for logistics/requesters to change status
CREATE POLICY "Herramientas insert by admins" ON herramientas FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Solicitudes: Anyone can view, insert. Updates based on assignment or requester
CREATE POLICY "Solicitudes viewable by everyone" ON solicitudes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert solicitudes" ON solicitudes FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Anyone can update solicitudes" ON solicitudes FOR UPDATE USING (true);

-- Movimientos: Anyone can view, anyone can insert
CREATE POLICY "Movimientos viewable by everyone" ON movimientos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert movimientos" ON movimientos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for User Profile Creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'solicitante'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Seed Data (Example)
INSERT INTO roles (name) VALUES ('admin'), ('solicitante'), ('logistica');

INSERT INTO obras (name, address) VALUES 
('Obra Central', 'Av. San Martín 1234'),
('Obra Norte', 'Ruta 9 Km 50'),
('Depósito Principal', 'Calle Falsa 123');

-- Herramientas Seed se cargará por API para tener UUIDs válidos de Obras.
