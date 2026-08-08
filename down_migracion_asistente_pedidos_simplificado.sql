-- ====================================================================
-- ROLLBACK MIGRACIÓN: Asistente Simplificado de Pedidos y Logística
-- Archivo: down_migracion_asistente_pedidos_simplificado.sql
-- ====================================================================

-- 1. Eliminar función de cálculo de distancia
DROP FUNCTION IF EXISTS public.calcular_distancia_km(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

-- 2. Eliminar columnas añadidas a la tabla solicitudes
ALTER TABLE public.solicitudes DROP COLUMN IF EXISTS requested_tool_name;
ALTER TABLE public.solicitudes DROP COLUMN IF EXISTS assigned_logistica_id;

-- 3. Restaurar constraint de estados original
ALTER TABLE public.solicitudes DROP CONSTRAINT IF EXISTS solicitudes_status_check;
ALTER TABLE public.solicitudes ADD CONSTRAINT solicitudes_status_check 
  CHECK (status IN ('Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada', 'Confirmada', 'Cancelada', 'Rechazada'));
