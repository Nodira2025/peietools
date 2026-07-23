-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN V11: VACIAR HISTORIAL DE MOVIMIENTOS Y SOLICITUDES
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Eliminar el historial de movimientos de herramientas
TRUNCATE TABLE public.movimientos CASCADE;

-- 2. Eliminar las solicitudes de herramientas asociadas (opcional pero recomendado para consistencia)
TRUNCATE TABLE public.solicitudes CASCADE;
