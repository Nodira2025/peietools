-- =========================================================================
-- MIGRACIÓN DE PEIE TOOLS: GPS, OBRAS y COMPRAS
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Actualizar tabla Obras
ALTER TABLE obras ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 2. Actualizar tabla Herramientas (Campos GPS)
ALTER TABLE herramientas ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION;
ALTER TABLE herramientas ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION;
ALTER TABLE herramientas ADD COLUMN IF NOT EXISTS last_location_accuracy DOUBLE PRECISION;
ALTER TABLE herramientas ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE herramientas ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- 3. Actualizar Roles (Añadir rol 'compras')
INSERT INTO roles (name) VALUES ('compras') ON CONFLICT DO NOTHING;

-- 4. Crear tabla de Solicitudes de Compra
CREATE TABLE IF NOT EXISTS solicitudes_compras (
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

-- Habilitar RLS para Solicitudes de Compra
ALTER TABLE solicitudes_compras ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para Solicitudes de Compra
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'SolicitudesCompras viewable by everyone') THEN
    CREATE POLICY "SolicitudesCompras viewable by everyone" ON solicitudes_compras FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can insert solicitudes_compras') THEN
    CREATE POLICY "Anyone can insert solicitudes_compras" ON solicitudes_compras FOR INSERT WITH CHECK (auth.uid() = requester_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update solicitudes_compras') THEN
    CREATE POLICY "Anyone can update solicitudes_compras" ON solicitudes_compras FOR UPDATE USING (true);
  END IF;
END $$;
