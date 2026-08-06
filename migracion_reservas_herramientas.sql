-- ====================================================================
-- MIGRACIÓN: Sistema de Reservas de Herramientas por Fecha
-- Archivo: migracion_reservas_herramientas.sql
-- Rollback script correspondiente: down_migracion_reservas_herramientas.sql
-- ====================================================================

-- 1. Crear la tabla de reservas de herramientas
CREATE TABLE IF NOT EXISTS public.reservas_herramientas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    herramienta_id UUID NOT NULL REFERENCES public.herramientas(id) ON DELETE CASCADE,
    solicitante_id UUID NOT NULL REFERENCES public.profiles(id),
    poseedor_actual_id UUID REFERENCES public.profiles(id),
    obra_id UUID REFERENCES public.obras(id),
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    estado TEXT NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('pendiente', 'confirmada', 'en_curso', 'completada', 'cancelada')),
    notas TEXT,
    notificado_24h BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_fechas CHECK (fecha_fin > fecha_inicio)
);

-- 2. Crear índices para optimizar consultas de disponibilidad y notificaciones
CREATE INDEX IF NOT EXISTS idx_reservas_herramienta ON public.reservas_herramientas(herramienta_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_reservas_solicitante ON public.reservas_herramientas(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON public.reservas_herramientas(estado);

-- 3. Habilitar RLS
ALTER TABLE public.reservas_herramientas ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas RLS
DROP POLICY IF EXISTS "Permitir lectura de reservas a usuarios autenticados" ON public.reservas_herramientas;
CREATE POLICY "Permitir lectura de reservas a usuarios autenticados"
ON public.reservas_herramientas FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir insercion de reservas a usuarios autenticados" ON public.reservas_herramientas;
CREATE POLICY "Permitir insercion de reservas a usuarios autenticados"
ON public.reservas_herramientas FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de reservas a usuarios autenticados" ON public.reservas_herramientas;
CREATE POLICY "Permitir actualizacion de reservas a usuarios autenticados"
ON public.reservas_herramientas FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion de reservas a usuarios autenticados" ON public.reservas_herramientas;
CREATE POLICY "Permitir eliminacion de reservas a usuarios autenticados"
ON public.reservas_herramientas FOR DELETE
TO authenticated
USING (true);

-- 5. Función de base de datos para verificar disponibilidad sin superposiciones
CREATE OR REPLACE FUNCTION public.verificar_disponibilidad_herramienta(
    p_herramienta_id UUID,
    p_fecha_inicio TIMESTAMPTZ,
    p_fecha_fin TIMESTAMPTZ,
    p_reserva_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conflictos INT;
BEGIN
    SELECT COUNT(*)
    INTO v_conflictos
    FROM public.reservas_herramientas
    WHERE herramienta_id = p_herramienta_id
      AND estado IN ('confirmada', 'en_curso', 'pendiente')
      AND (p_reserva_id IS NULL OR id <> p_reserva_id)
      AND (fecha_inicio, fecha_fin) OVERLAPS (p_fecha_inicio, p_fecha_fin);

    RETURN v_conflictos = 0;
END;
$$;
