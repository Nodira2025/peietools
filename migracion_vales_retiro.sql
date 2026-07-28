-- ============================================================
-- MIGRACION: Agregar campos para Vales de Retiro y Autorizaciones
-- ============================================================

ALTER TABLE public.solicitudes 
ADD COLUMN IF NOT EXISTS vale_url TEXT,
ADD COLUMN IF NOT EXISTS authorized_pickup_person TEXT;

COMMENT ON COLUMN public.solicitudes.vale_url IS 'URL o imagen del vale de retiro / autorización subida';
COMMENT ON COLUMN public.solicitudes.authorized_pickup_person IS 'Nombre y DNI/Legajo de la persona autorizada para retirar';
