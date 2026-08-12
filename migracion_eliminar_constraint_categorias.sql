-- =========================================================================
-- PEIE TOOLS - Eliminar restricción rígida de categorías en herramientas
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- Eliminar la restricción CHECK que limita los nombres de las categorías
ALTER TABLE public.herramientas DROP CONSTRAINT IF EXISTS herramientas_category_check;
