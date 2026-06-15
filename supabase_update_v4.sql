-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN DE ACTUALIZACIÓN Y CORRECCIONES V4
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Crear tabla de historial de tracking
CREATE TABLE IF NOT EXISTS public.tracking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES public.solicitudes(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.tracking_history ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS para lectura e inserción
DROP POLICY IF EXISTS "Anyone can read tracking_history" ON public.tracking_history;
CREATE POLICY "Anyone can read tracking_history" ON public.tracking_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert tracking_history" ON public.tracking_history;
CREATE POLICY "Anyone can insert tracking_history" ON public.tracking_history FOR INSERT WITH CHECK (true);

-- 4. Agregar columna received_by en la tabla public.solicitudes
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS received_by TEXT;

-- 5. Actualizar políticas RLS de herramientas para permitir a logística crear/insertar
DROP POLICY IF EXISTS "Herramientas insert by admins" ON public.herramientas;
CREATE POLICY "Herramientas insert by admins" ON public.herramientas FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'compras' OR role = 'logistica')));


