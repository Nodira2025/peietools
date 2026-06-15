-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN DE ACTUALIZACIÓN Y CORRECCIONES V3
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Agregar columnas para Validación por Código de Seguridad en solicitudes de herramientas
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS security_code TEXT;

-- 2. Agregar columnas para Seguimiento en Tiempo Real (Trazabilidad) en solicitudes de herramientas
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS tracking_latitude DOUBLE PRECISION;
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS tracking_longitude DOUBLE PRECISION;
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS eta TEXT;
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS delay_reason TEXT;

-- 3. Asegurar que exista la obra IBAS en la tabla 'obras'
INSERT INTO public.obras (id, name, address, active, status, code)
SELECT uuid_generate_v4(), 'IBAS', 'Sede Central IBAS', true, 'En Proceso', 'IBAS'
WHERE NOT EXISTS (
    SELECT 1 FROM public.obras WHERE name = 'IBAS' OR code = 'IBAS'
);

-- 4. Reasignar todos los electricistas a la obra IBAS tal como estaban anteriormente
-- Se consideran electricistas los empleados cuya especialidad o rol es 'Electricista' o si specialty es nulo (valor por defecto)
UPDATE public.empleados
SET obra_id = (SELECT id FROM public.obras WHERE name = 'IBAS' OR code = 'IBAS' LIMIT 1)
WHERE specialty = 'Electricista' OR specialty IS NULL OR role = 'electricista';

-- 5. Corregir y asegurar políticas RLS para solicitudes para que Logística pueda actualizarlas sin trabas
DROP POLICY IF EXISTS "Anyone can update solicitudes" ON public.solicitudes;
CREATE POLICY "Anyone can update solicitudes" ON public.solicitudes FOR UPDATE USING (true) WITH CHECK (true);
