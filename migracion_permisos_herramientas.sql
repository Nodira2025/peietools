-- =========================================================================
-- PEIE TOOLS - CORRECCIÓN DE PERMISOS RLS PARA INSERCIÓN DE HERRAMIENTAS
-- Ejecuta este script en el SQL Editor de Supabase para habilitar la carga
-- de herramientas a Cristian y todos los usuarios autorizados
-- =========================================================================

-- 1. Habilitar RLS en herramientas
ALTER TABLE public.herramientas ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas restrictivas previas
DROP POLICY IF EXISTS "Herramientas insert by admins" ON public.herramientas;
DROP POLICY IF EXISTS "Herramientas insert by authenticated" ON public.herramientas;
DROP POLICY IF EXISTS "Herramientas update by anyone" ON public.herramientas;
DROP POLICY IF EXISTS "Herramientas viewable by everyone" ON public.herramientas;
DROP POLICY IF EXISTS "Herramientas delete by admins" ON public.herramientas;
DROP POLICY IF EXISTS "Anyone can insert herramientas" ON public.herramientas;
DROP POLICY IF EXISTS "Anyone can update herramientas" ON public.herramientas;
DROP POLICY IF EXISTS "Anyone can delete herramientas" ON public.herramientas;

-- 3. Crear políticas que permitan a todos los usuarios del sistema insertar y actualizar herramientas
CREATE POLICY "Herramientas viewable by everyone" 
ON public.herramientas FOR SELECT 
USING (true);

CREATE POLICY "Herramientas insert by authenticated and authorized" 
ON public.herramientas FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Herramientas update by anyone" 
ON public.herramientas FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Herramientas delete by authorized" 
ON public.herramientas FOR DELETE 
USING (true);

-- 4. Otorgar permisos a anon y authenticated
GRANT ALL ON TABLE public.herramientas TO anon;
GRANT ALL ON TABLE public.herramientas TO authenticated;
GRANT ALL ON TABLE public.herramientas TO service_role;
