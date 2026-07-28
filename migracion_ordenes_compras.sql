-- ============================================================
-- MIGRACION: Agregar campos de texto WhatsApp y Empleado a solicitudes_compras
-- ============================================================

ALTER TABLE public.solicitudes_compras 
ADD COLUMN IF NOT EXISTS raw_whatsapp_text TEXT,
ADD COLUMN IF NOT EXISTS requested_employee TEXT;

COMMENT ON COLUMN public.solicitudes_compras.raw_whatsapp_text IS 'Texto crudo copiado y pegado de WhatsApp';
COMMENT ON COLUMN public.solicitudes_compras.requested_employee IS 'Nombre del empleado que solicita la compra (opcional)';
