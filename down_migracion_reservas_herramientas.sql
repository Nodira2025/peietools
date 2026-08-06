-- ====================================================================
-- ROLLBACK MIGRACIÓN: Sistema de Reservas de Herramientas por Fecha
-- Archivo: down_migracion_reservas_herramientas.sql
-- ====================================================================

-- 1. Eliminar función de verificación
DROP FUNCTION IF EXISTS public.verificar_disponibilidad_herramienta(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID);

-- 2. Eliminar tabla y dependencias (índices y políticas RLS se eliminan automáticamente)
DROP TABLE IF EXISTS public.reservas_herramientas CASCADE;
