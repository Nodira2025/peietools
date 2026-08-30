-- =========================================================================
-- PEIE TOOLS: MIGRACIÓN PARA LIQUIDACIÓN DE SUELDOS Y VALOR HORA
-- =========================================================================

-- 1. Agregar columnas de valor hora en la tabla empleados
ALTER TABLE public.empleados 
ADD COLUMN IF NOT EXISTS valor_hora NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_hora_extra NUMERIC DEFAULT 0;

-- 2. Agregar valor hora por defecto en reglas de trabajadores
ALTER TABLE public.reglas_horas_trabajadores 
ADD COLUMN IF NOT EXISTS valor_hora_defecto NUMERIC DEFAULT 4000;

-- 3. Tabla para persistir liquidaciones de sueldos cerradas o históricas
CREATE TABLE IF NOT EXISTS public.liquidaciones_sueldos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE,
    empleado_nombre TEXT NOT NULL,
    periodo_mes TEXT NOT NULL,
    periodo_quincena TEXT NOT NULL,
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NOT NULL,
    horas_trabajadas NUMERIC NOT NULL DEFAULT 0,
    horas_ausente NUMERIC DEFAULT 0,
    valor_hora NUMERIC NOT NULL DEFAULT 0,
    sueldo_bruto NUMERIC NOT NULL DEFAULT 0,
    bono_presentismo NUMERIC DEFAULT 0,
    adelantos_descuentos NUMERIC DEFAULT 0,
    total_neto NUMERIC NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'APROBADO', 'PAGADO')),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.liquidaciones_sueldos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura general de liquidaciones" ON public.liquidaciones_sueldos;
CREATE POLICY "Permitir lectura general de liquidaciones" ON public.liquidaciones_sueldos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion de liquidaciones" ON public.liquidaciones_sueldos;
CREATE POLICY "Permitir insercion de liquidaciones" ON public.liquidaciones_sueldos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de liquidaciones" ON public.liquidaciones_sueldos;
CREATE POLICY "Permitir actualizacion de liquidaciones" ON public.liquidaciones_sueldos FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion de liquidaciones" ON public.liquidaciones_sueldos;
CREATE POLICY "Permitir eliminacion de liquidaciones" ON public.liquidaciones_sueldos FOR DELETE USING (true);
