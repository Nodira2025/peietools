-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN: ASISTENCIA DIARIA, NOVEDADES Y BOT N8N
-- Ejecutar en el SQL Editor de Supabase
-- =========================================================================

-- 1. TABLA: NOVEDADES DIARIAS Y ASISTENCIA DE TRABAJADORES
CREATE TABLE IF NOT EXISTS public.novedades_diarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
    empleado_nombre TEXT NOT NULL,
    empleado_dni TEXT,
    fecha DATE NOT NULL,
    mes TEXT NOT NULL DEFAULT 'AGOSTO',
    quincena TEXT NOT NULL DEFAULT '2Q',
    obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
    obra_nombre TEXT,
    hora_ingreso TEXT DEFAULT '08:00',
    hora_egreso TEXT DEFAULT '18:00',
    almuerzo BOOLEAN DEFAULT false,
    horas_ausente NUMERIC DEFAULT 0,
    horas_trabajadas NUMERIC NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'PRESENTE' CHECK (estado IN ('PRESENTE', 'AUSENTE', 'LLEGADA TARDE', 'SE RETIRO')),
    tipo_licencia TEXT NOT NULL DEFAULT 'Ninguno' CHECK (tipo_licencia IN ('Ninguno', 'Enfermedad Trabajador', 'Familiar Enfermo', 'Fallecimiento', 'No justificado', 'Llegada tarde', 'Otro')),
    certificado_medico BOOLEAN DEFAULT false,
    certificado_url TEXT,
    desde DATE,
    hasta DATE,
    observaciones TEXT,
    fuente TEXT NOT NULL DEFAULT 'APP_WEB' CHECK (fuente IN ('APP_WEB', 'WHATSAPP_N8N', 'MANUAL_COORDINADOR')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. AMPLIAR TABLA DE REGLAS CON VENTANA HORARIA ANTI-FRAUDE
ALTER TABLE public.reglas_horas_trabajadores 
ADD COLUMN IF NOT EXISTS hora_inicio_permitida TEXT DEFAULT '06:30',
ADD COLUMN IF NOT EXISTS hora_fin_permitida TEXT DEFAULT '19:30',
ADD COLUMN IF NOT EXISTS hora_limite_puntualidad TEXT DEFAULT '08:15',
ADD COLUMN IF NOT EXISTS horas_objetivo_quincena NUMERIC DEFAULT 88,
ADD COLUMN IF NOT EXISTS porcentaje_premio_asistencia NUMERIC DEFAULT 10;

-- 3. HABILITAR RLS Y PERMISOS PÚBLICOS PARA INTEGRACIÓN CON N8N Y APP
ALTER TABLE public.novedades_diarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura general de novedades" ON public.novedades_diarias;
CREATE POLICY "Permitir lectura general de novedades" ON public.novedades_diarias FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion de novedades publica y n8n" ON public.novedades_diarias;
CREATE POLICY "Permitir insercion de novedades publica y n8n" ON public.novedades_diarias FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de novedades" ON public.novedades_diarias;
CREATE POLICY "Permitir actualizacion de novedades" ON public.novedades_diarias FOR UPDATE USING (true) WITH CHECK (true);

-- 4. ÍNDICES PARA CONSULTAS RÁPIDAS
CREATE INDEX IF NOT EXISTS idx_novedades_fecha ON public.novedades_diarias(fecha);
CREATE INDEX IF NOT EXISTS idx_novedades_empleado ON public.novedades_diarias(empleado_id);
CREATE INDEX IF NOT EXISTS idx_novedades_quincena ON public.novedades_diarias(mes, quincena);
