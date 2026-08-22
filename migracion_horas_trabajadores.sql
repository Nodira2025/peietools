-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN: REGISTRO DE HORAS, FORMULARIOS Y REGLAS DE BONOS
-- Ejecutar en el SQL Editor de Supabase
-- =========================================================================

-- 1. TABLA: REGISTRO DE HORAS SEMANALES DE TRABAJADORES
CREATE TABLE IF NOT EXISTS public.registro_horas_semanales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
    empleado_dni TEXT NOT NULL,
    empleado_nombre TEXT NOT NULL,
    semana_inicio DATE NOT NULL,
    lunes NUMERIC DEFAULT 0,
    martes NUMERIC DEFAULT 0,
    miercoles NUMERIC DEFAULT 0,
    jueves NUMERIC DEFAULT 0,
    viernes NUMERIC DEFAULT 0,
    sabado NUMERIC DEFAULT 0,
    domingo NUMERIC DEFAULT 0,
    total_horas NUMERIC NOT NULL DEFAULT 0,
    motivo_ausencia TEXT DEFAULT 'Ninguno',
    detalles_ausencia TEXT,
    bono_alcanzado BOOLEAN DEFAULT false,
    porcentaje_bono NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA: REGLAS DE BONIFICACIÓN Y HORAS TRABAJADAS
CREATE TABLE IF NOT EXISTS public.reglas_horas_trabajadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    horas_objetivo_semanal NUMERIC NOT NULL DEFAULT 44,
    porcentaje_bono NUMERIC NOT NULL DEFAULT 10,
    alerta_salud_activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. INSERTAR REGLA POR DEFECTO SI NO EXISTE
INSERT INTO public.reglas_horas_trabajadores (horas_objetivo_semanal, porcentaje_bono, alerta_salud_activa)
SELECT 44, 10, true
WHERE NOT EXISTS (SELECT 1 FROM public.reglas_horas_trabajadores);

-- 4. HABILITAR RLS Y PERMISOS PÚBLICOS PARA CARGA DE HORAS
ALTER TABLE public.registro_horas_semanales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglas_horas_trabajadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura general de horas" ON public.registro_horas_semanales;
CREATE POLICY "Permitir lectura general de horas" ON public.registro_horas_semanales FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica de horas" ON public.registro_horas_semanales;
CREATE POLICY "Permitir insercion publica de horas" ON public.registro_horas_semanales FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion publica de horas" ON public.registro_horas_semanales;
CREATE POLICY "Permitir actualizacion publica de horas" ON public.registro_horas_semanales FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura de reglas" ON public.reglas_horas_trabajadores;
CREATE POLICY "Permitir lectura de reglas" ON public.reglas_horas_trabajadores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir edicion de reglas a autenticados" ON public.reglas_horas_trabajadores;
CREATE POLICY "Permitir edicion de reglas a autenticados" ON public.reglas_horas_trabajadores FOR ALL USING (true) WITH CHECK (true);
