-- =========================================================================
-- PEIE TOOLS: MIGRACIÓN COMPLETA DE HORAS, NOVEDADES Y ASISTENCIA
-- =========================================================================

-- 1. TABLA: REGISTRO DE HORAS SEMANALES
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

-- 2. TABLA: NOVEDADES DIARIAS Y ASISTENCIA
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

-- 3. TABLA: REGLAS DE HORAS Y ANTI-FRAUDE
CREATE TABLE IF NOT EXISTS public.reglas_horas_trabajadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    horas_objetivo_semanal NUMERIC NOT NULL DEFAULT 44,
    porcentaje_bono NUMERIC NOT NULL DEFAULT 10,
    alerta_salud_activa BOOLEAN DEFAULT true,
    hora_inicio_permitida TEXT DEFAULT '06:30',
    hora_fin_permitida TEXT DEFAULT '19:30',
    hora_limite_puntualidad TEXT DEFAULT '08:15',
    horas_objetivo_quincena NUMERIC DEFAULT 88,
    porcentaje_premio_asistencia NUMERIC DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar regla inicial si no existe
INSERT INTO public.reglas_horas_trabajadores (
    horas_objetivo_semanal, porcentaje_bono, alerta_salud_activa,
    hora_inicio_permitida, hora_fin_permitida, hora_limite_puntualidad
)
SELECT 44, 10, true, '06:30', '19:30', '08:15'
WHERE NOT EXISTS (SELECT 1 FROM public.reglas_horas_trabajadores);

-- 4. POLÍTICAS DE ACCESO (RLS)
ALTER TABLE public.registro_horas_semanales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedades_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglas_horas_trabajadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura general de horas" ON public.registro_horas_semanales;
CREATE POLICY "Permitir lectura general de horas" ON public.registro_horas_semanales FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica de horas" ON public.registro_horas_semanales;
CREATE POLICY "Permitir insercion publica de horas" ON public.registro_horas_semanales FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion publica de horas" ON public.registro_horas_semanales;
CREATE POLICY "Permitir actualizacion publica de horas" ON public.registro_horas_semanales FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura general de novedades" ON public.novedades_diarias;
CREATE POLICY "Permitir lectura general de novedades" ON public.novedades_diarias FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion de novedades publica y n8n" ON public.novedades_diarias;
CREATE POLICY "Permitir insercion de novedades publica y n8n" ON public.novedades_diarias FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de novedades" ON public.novedades_diarias;
CREATE POLICY "Permitir actualizacion de novedades" ON public.novedades_diarias FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura de reglas" ON public.reglas_horas_trabajadores;
CREATE POLICY "Permitir lectura de reglas" ON public.reglas_horas_trabajadores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir edicion de reglas a autenticados" ON public.reglas_horas_trabajadores;
CREATE POLICY "Permitir edicion de reglas a autenticados" ON public.reglas_horas_trabajadores FOR ALL USING (true) WITH CHECK (true);

-- 5. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_novedades_fecha ON public.novedades_diarias(fecha);
CREATE INDEX IF NOT EXISTS idx_novedades_empleado ON public.novedades_diarias(empleado_id);
CREATE INDEX IF NOT EXISTS idx_novedades_quincena ON public.novedades_diarias(mes, quincena);
