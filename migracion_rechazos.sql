-- ============================================================
-- MIGRACION: Sistema de Rechazos con Motivo
-- ============================================================

-- 1. Agregar columna de motivo de rechazo a solicitudes (herramientas)
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Actualizar el check de status para solicitudes
ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_status_check;
ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_status_check 
CHECK (status IN ('Pendiente', 'Asignada', 'En retiro', 'En traslado', 'Entregada', 'Confirmada', 'Cancelada', 'Rechazada'));

-- 3. Agregar columna de motivo de rechazo a traslados de personal
ALTER TABLE traslados_personal ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 4. Actualizar el check de status para traslados_personal
ALTER TABLE traslados_personal DROP CONSTRAINT IF EXISTS traslados_personal_status_check;
ALTER TABLE traslados_personal ADD CONSTRAINT traslados_personal_status_check 
CHECK (status IN ('Pendiente', 'Confirmado', 'Cancelado', 'Rechazado'));

-- 5. Recargar esquema
NOTIFY pgrst, 'reload schema';
