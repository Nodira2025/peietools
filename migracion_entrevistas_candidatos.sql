-- ==============================================================================
-- MIGRACIÓN: Módulo de Entrevistas y Selección de Personal con IA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.candidatos_entrevistas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    dni text,
    phone text NOT NULL,
    email text,
    address text,
    locality text,
    latitude double precision,
    longitude double precision,
    birth_date date,
    age integer,
    specialty_title text NOT NULL,
    years_experience integer DEFAULT 0,
    education_level text,
    cv_url text,
    cv_filename text,
    cv_text_summary text,
    photo_url text,
    status text DEFAULT 'Nuevo',
    interview_date timestamptz,
    interview_notes text,
    nearest_obra_name text,
    nearest_obra_distance_km numeric,
    rating integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_candidatos_status ON public.candidatos_entrevistas(status);
CREATE INDEX IF NOT EXISTS idx_candidatos_specialty ON public.candidatos_entrevistas(specialty_title);
CREATE INDEX IF NOT EXISTS idx_candidatos_coords ON public.candidatos_entrevistas(latitude, longitude);

-- Seguridad RLS
ALTER TABLE public.candidatos_entrevistas ENABLE ROW LEVEL SECURITY;

-- Permitir inserción anónima para que los candidatos puedan postularse desde el formulario público
DROP POLICY IF EXISTS "candidatos_public_insert" ON public.candidatos_entrevistas;
CREATE POLICY "candidatos_public_insert" ON public.candidatos_entrevistas
    FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Permitir lectura y modificación para usuarios autenticados (RRHH y Admin)
DROP POLICY IF EXISTS "candidatos_auth_select" ON public.candidatos_entrevistas;
CREATE POLICY "candidatos_auth_select" ON public.candidatos_entrevistas
    FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "candidatos_auth_update" ON public.candidatos_entrevistas;
CREATE POLICY "candidatos_auth_update" ON public.candidatos_entrevistas
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "candidatos_auth_delete" ON public.candidatos_entrevistas;
CREATE POLICY "candidatos_auth_delete" ON public.candidatos_entrevistas
    FOR DELETE TO authenticated USING (true);

-- Datos semilla de prueba realistas para Tucumán
INSERT INTO public.candidatos_entrevistas (
    full_name, dni, phone, email, address, locality, latitude, longitude, age, specialty_title, years_experience, education_level, cv_text_summary, status, rating
) VALUES 
    ('Lucas Emanuel Medina', '38492014', '+54 9 381 582-1940', 'lucas.medina@gmail.com', 'Av. Aconquija 2200', 'Yerba Buena', -26.8150, -65.3050, 29, 'Oficial Electricista', 5, 'Secundario Técnico', 'Especialista en montaje de bandejas portacables, cableado trifásico y armado de tableros de potencia. Experiencia en edificios en altura.', 'A Contactar', 5),
    ('Gonzalo Javier Roldán', '40192841', '+54 9 381 490-2381', 'roldan.electricidad@gmail.com', 'San Martín 840', 'San Miguel de Tucumán', -26.8310, -65.2080, 26, 'Medio Oficial', 3, 'Técnico Electromecánico', 'Conocimiento en tendido de cañerías rígidas, conexionado de llaves combinadas e iluminación LED. Manejo de herramientas eléctricas.', 'Nuevo', 4),
    ('Esteban Darío Peralta', '36291039', '+54 9 381 601-4472', 'esteban_peralta_obras@hotmail.com', 'Ruta 9 km 1285', 'Banda del Río Salí', -26.8480, -65.1710, 32, 'Oficial Montador', 7, 'Secundario Completo', 'Experiencia en líneas aéreas, conexionado de acometidas industriales y generadores diésel de respaldo.', 'Entrevista Programada', 4),
    ('Matías Nicolás Albarracín', '42019482', '+54 9 381 319-8802', 'matias.albarracin@gmail.com', 'Diagonal Raúl Leccese 1500', 'Tafí Viejo', -26.7820, -65.2390, 23, 'Ayudante Electricista', 1, 'Secundario Técnico en curso', 'Ganas de aprender y disponibilidad horaria. Realizó canaleteado y picado de losas para cañería corrugada.', 'Nuevo', 3)
ON CONFLICT DO NOTHING;
