-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN V12: TABLA DE REPORTES EXCEDIDOS DE LOGÍSTICA
-- Ejecutar en el SQL Editor de Supabase
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.reportes_excedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    requester_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    requester_name TEXT NOT NULL,
    target_person_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_person_name TEXT NOT NULL,
    recipient_name TEXT NOT NULL DEFAULT 'Federico Grande',
    tarea TEXT,
    motivo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendiente'
);

-- Habilitar RLS
ALTER TABLE public.reportes_excedidos ENABLE ROW LEVEL SECURITY;

-- Politicas de seguridad
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.reportes_excedidos FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insercion a usuarios autenticados" 
ON public.reportes_excedidos FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir actualizacion a usuarios autenticados" 
ON public.reportes_excedidos FOR UPDATE 
TO authenticated 
USING (true);
