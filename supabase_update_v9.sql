-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN DE ACTUALIZACIÓN V9
-- CREAR NUEVAS UBICACIONES (OBRAS/DEPÓSITOS) Y PERMITIR PEDIDOS ABIERTOS POR VOZ/TEXTO
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Insertar "DEPÓSITO DE LA EMPRESA" si no existe
INSERT INTO public.obras (name, address, active, status, code)
SELECT 'DEPÓSITO DE LA EMPRESA', 'Depósito General de la Empresa, Tucumán', true, 'En Proceso', 'DEP-EMP'
WHERE NOT EXISTS (
  SELECT 1 FROM public.obras WHERE name = 'DEPÓSITO DE LA EMPRESA' OR code = 'DEP-EMP'
);

-- 2. Insertar "CAMIONETA" si no existe
INSERT INTO public.obras (name, address, active, status, code)
SELECT 'CAMIONETA', 'Vehículo de traslado / Camioneta de herramientas, Tucumán', true, 'En Proceso', 'CAM-01'
WHERE NOT EXISTS (
  SELECT 1 FROM public.obras WHERE name = 'CAMIONETA' OR code = 'CAM-01'
);

-- 3. Permitir solicitudes de herramientas por texto/dictado libre (herramienta_id opcional)
ALTER TABLE public.solicitudes ALTER COLUMN herramienta_id DROP NOT NULL;
