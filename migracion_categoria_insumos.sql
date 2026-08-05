-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN DE NUEVA CATEGORÍA: Insumos y Consumibles
-- Ejecutar en el SQL Editor de Supabase
-- =========================================================================

-- 1. Eliminar la restricción de categorías previa
ALTER TABLE public.herramientas DROP CONSTRAINT IF EXISTS herramientas_category_check;

-- 2. Agregar la restricción actualizada incluyendo 'Insumos y Consumibles' y 'Prensas y Pinzas'
ALTER TABLE public.herramientas 
ADD CONSTRAINT herramientas_category_check 
CHECK (category IN (
  'Escaleras', 
  'Amoladoras', 
  'Taladros', 
  'Prensas y Pinzas', 
  'Elementos de seguridad', 
  'Instrumentos de medición', 
  'Vehículos', 
  'Insumos y Consumibles', 
  'Otros'
));

-- 3. Actualizar la categoría en base de datos para las vaselinas registradas
UPDATE public.herramientas 
SET category = 'Insumos y Consumibles' 
WHERE name ILIKE '%vaselina%' OR code LIKE 'VAS-%';
