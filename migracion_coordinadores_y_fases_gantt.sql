-- ==============================================================================
-- MIGRACIÓN: Coordinadores (Contacto, Domicilio, Foto) y Fases de Obra (Gantt)
-- ==============================================================================

-- 1. Ampliar tabla profiles con teléfono y domicilio (address)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;

-- 2. Crear tabla de fases del plan de obra
CREATE TABLE IF NOT EXISTS public.obra_fases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status text DEFAULT 'Pendiente',
    responsable_name text,
    order_index integer DEFAULT 0,
    notes text,
    color text,
    created_at timestamptz DEFAULT now()
);

-- 3. Índices para consultas rápidas de cronograma
CREATE INDEX IF NOT EXISTS idx_obra_fases_obra_id ON public.obra_fases(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_fases_dates ON public.obra_fases(start_date, end_date);

-- 4. Habilitar RLS
ALTER TABLE public.obra_fases ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura y escritura para usuarios autenticados
DROP POLICY IF EXISTS "obra_fases_select_policy" ON public.obra_fases;
CREATE POLICY "obra_fases_select_policy" ON public.obra_fases
    FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "obra_fases_insert_policy" ON public.obra_fases;
CREATE POLICY "obra_fases_insert_policy" ON public.obra_fases
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "obra_fases_update_policy" ON public.obra_fases;
CREATE POLICY "obra_fases_update_policy" ON public.obra_fases
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "obra_fases_delete_policy" ON public.obra_fases;
CREATE POLICY "obra_fases_delete_policy" ON public.obra_fases
    FOR DELETE TO authenticated USING (true);

-- 5. Cargar fases predeterminadas para obras activas si no tienen fases
DO $$
DECLARE
    r_obra RECORD;
BEGIN
    FOR r_obra IN SELECT id, name, encargado_name FROM public.obras WHERE active = true LOOP
        IF NOT EXISTS (SELECT 1 FROM public.obra_fases WHERE obra_id = r_obra.id) THEN
            INSERT INTO public.obra_fases (obra_id, name, start_date, end_date, progress, status, responsable_name, order_index)
            VALUES 
                (r_obra.id, 'Replanteo y Canalizaciones', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '10 days', 75, 'En Curso', r_obra.encargado_name, 1),
                (r_obra.id, 'Tendido de Bandejas y Cañerías', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 40, 'En Curso', r_obra.encargado_name, 2),
                (r_obra.id, 'Cableado de Potencia y Comandos', CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '45 days', 0, 'Pendiente', r_obra.encargado_name, 3),
                (r_obra.id, 'Montaje de Tableros Principales', CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days', 0, 'Pendiente', r_obra.encargado_name, 4),
                (r_obra.id, 'Pruebas, Medición y Certificación', CURRENT_DATE + INTERVAL '55 days', CURRENT_DATE + INTERVAL '75 days', 0, 'Pendiente', r_obra.encargado_name, 5);
        END IF;
    END LOOP;
END $$;
