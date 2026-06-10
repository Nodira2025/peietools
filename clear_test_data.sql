-- SQL Script to clear all test/mock transactional data before demo/testing
-- Copy and execute this script in the Supabase SQL Editor

-- 1. Clear all transactional/history records
TRUNCATE TABLE public.movimientos CASCADE;
TRUNCATE TABLE public.mantenimientos CASCADE;
TRUNCATE TABLE public.solicitudes CASCADE;
TRUNCATE TABLE public.traslados_personal CASCADE;
TRUNCATE TABLE public.solicitudes_compras CASCADE;

-- 2. Reset tool states to "Disponible" at "DEPOSITO PEIE"
UPDATE public.herramientas 
SET status = 'Disponible', 
    current_obra_id = '36c94651-0aaf-486e-a69b-4dca3e524ee8';

-- 3. Reset employee assignments (unassigned / free)
UPDATE public.empleados 
SET obra_id = NULL;

-- 4. Log completion note
SELECT 'Base de datos limpia y lista para demostración.' AS status;
