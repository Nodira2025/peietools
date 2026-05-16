-- ============================================================
-- MIGRACION: Traslados de Personal
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS traslados_personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID REFERENCES empleados(id) NOT NULL,
    source_obra_id UUID REFERENCES obras(id),
    target_obra_id UUID REFERENCES obras(id) NOT NULL,
    requester_id UUID REFERENCES profiles(id) NOT NULL,
    status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Confirmado', 'Cancelado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    confirmed_by UUID REFERENCES profiles(id),
    confirmed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE traslados_personal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "traslados_personal_read" ON traslados_personal;
CREATE POLICY "traslados_personal_read" ON traslados_personal FOR SELECT USING (true);

DROP POLICY IF EXISTS "traslados_personal_write" ON traslados_personal;
CREATE POLICY "traslados_personal_write" ON traslados_personal FOR ALL USING (true) WITH CHECK (true);
