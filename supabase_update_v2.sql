-- 1. Agregar columna de categoria en herramientas
ALTER TABLE public.herramientas 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Otros' CHECK (category IN ('Escaleras', 'Amoladoras', 'Taladros', 'Elementos de seguridad', 'Instrumentos de medición', 'Vehículos', 'Otros'));

-- 2. Agregar columnas de estado, especialidad y foto_url en empleados
ALTER TABLE public.empleados 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Disponible' CHECK (status IN ('Disponible', 'En traslado', 'Trabajando', 'Libre')),
ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT 'Electricista',
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 3. Agregar columna photo_url en obras
ALTER TABLE public.obras 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 4. Crear tabla para registro de avance fotográfico de obras
CREATE TABLE IF NOT EXISTS public.obra_avances_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
    photo_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en la nueva tabla
ALTER TABLE public.obra_avances_fotos ENABLE ROW LEVEL SECURITY;

-- Politicas de lectura/escritura para usuarios autenticados
DROP POLICY IF EXISTS "Obra avances viewable by everyone" ON public.obra_avances_fotos;
CREATE POLICY "Obra avances viewable by everyone" ON public.obra_avances_fotos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Obra avances insert/update by authenticated" ON public.obra_avances_fotos;
CREATE POLICY "Obra avances insert/update by authenticated" ON public.obra_avances_fotos FOR ALL USING (true) WITH CHECK (true);
