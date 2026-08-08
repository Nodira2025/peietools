-- ====================================================================
-- MIGRACIÓN: Tabla de Categorías de Herramientas y Gestión Dinámica
-- Archivo: migracion_categorias_herramientas.sql
-- Rollback script: down_migracion_categorias_herramientas.sql
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.categorias_herramientas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon_name TEXT DEFAULT 'Wrench',
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.categorias_herramientas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Permitir lectura de categorias a todos los autenticados" ON public.categorias_herramientas;
CREATE POLICY "Permitir lectura de categorias a todos los autenticados" ON public.categorias_herramientas 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir insercion de categorias a usuarios autenticados" ON public.categorias_herramientas;
CREATE POLICY "Permitir insercion de categorias a usuarios autenticados" ON public.categorias_herramientas 
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir edicion de categorias a usuarios autenticados" ON public.categorias_herramientas;
CREATE POLICY "Permitir edicion de categorias a usuarios autenticados" ON public.categorias_herramientas 
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion de categorias a usuarios autenticados" ON public.categorias_herramientas;
CREATE POLICY "Permitir eliminacion de categorias a usuarios autenticados" ON public.categorias_herramientas 
  FOR DELETE TO authenticated USING (true);

-- Insertar categorías por defecto
INSERT INTO public.categorias_herramientas (name, description, icon_name, color)
VALUES 
  ('Amoladoras', 'Amoladoras angulares, de banco y de corte', 'Disc', '#3b82f6'),
  ('Taladros / Rotomartillos', 'Taladros de banco, inalámbricos y rotomartillos SDS', 'Wrench', '#10b981'),
  ('Escaleras', 'Escaleras dieléctricas, de aluminio y tijera', 'Layers', '#f59e0b'),
  ('Medición y Prueba', 'Multímetros, pinzas amperométricas y niveles láser', 'Ruler', '#8b5cf6'),
  ('Generadores y Motores', 'Grupos electrógenos, generadores y tableros', 'Zap', '#ef4444'),
  ('Herramientas de Mano', 'Pinzas, destornilladores, martillos y llaves', 'Hammer', '#64748b'),
  ('Seguridad y Protección', 'Cascos, arneses, guantes y protección auditiva', 'Shield', '#06b6d4'),
  ('Otros', 'Categoría general y accesorios varios', 'Package', '#6b7280')
ON CONFLICT (name) DO NOTHING;
