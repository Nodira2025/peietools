-- ============================================================
-- MIGRACION: Agregar Fecha de Necesidad a Solicitudes de Herramientas
-- ============================================================

ALTER TABLE public.solicitudes 
ADD COLUMN IF NOT EXISTS needed_date TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.solicitudes.needed_date IS 'Fecha y hora requerida para la entrega en obra';
