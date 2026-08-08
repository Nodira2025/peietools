-- ====================================================================
-- MIGRACIÓN: Asistente Simplificado de Pedidos y Asignación de Logística
-- Archivo: migracion_asistente_pedidos_simplificado.sql
-- Rollback script correspondiente: down_migracion_asistente_pedidos_simplificado.sql
-- ====================================================================

-- 1. Crear la tabla solicitudes si aún no existe en el esquema public
CREATE TABLE IF NOT EXISTS public.solicitudes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES public.profiles(id),
    herramienta_id UUID REFERENCES public.herramientas(id),
    requested_tool_name TEXT,
    source_obra_id UUID REFERENCES public.obras(id),
    target_obra_id UUID REFERENCES public.obras(id),
    assigned_to UUID REFERENCES public.profiles(id),
    assigned_logistica_id UUID REFERENCES public.profiles(id),
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Baja', 'Normal', 'Alta', 'Urgente')),
    status TEXT DEFAULT 'Pendiente',
    comments TEXT,
    needed_date TIMESTAMPTZ,
    security_code TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Permitir que herramienta_id sea opcional (NULLable)
ALTER TABLE public.solicitudes ALTER COLUMN herramienta_id DROP NOT NULL;

-- 3. Agregar columnas si no existen
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS requested_tool_name TEXT;
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS assigned_logistica_id UUID REFERENCES public.profiles(id);

-- 4. Actualizar el constraint de estados para soportar 'En atención'
ALTER TABLE public.solicitudes DROP CONSTRAINT IF EXISTS solicitudes_status_check;
ALTER TABLE public.solicitudes ADD CONSTRAINT solicitudes_status_check 
  CHECK (status IN ('Pendiente', 'En atención', 'Asignada', 'En retiro', 'En traslado', 'Entregada', 'Confirmada', 'Cancelada', 'Rechazada'));

-- 5. Función para calcular distancia aproximada entre dos pares de coordenadas (Fórmula de Haversine)
CREATE OR REPLACE FUNCTION public.calcular_distancia_km(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    r CONSTANT DOUBLE PRECISION := 6371.0; -- Radio de la Tierra en km
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN 99999.0; -- Retornar distancia grande si falta alguna coordenada
    END IF;

    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)^2;
    c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
    RETURN r * c;
END;
$$;
