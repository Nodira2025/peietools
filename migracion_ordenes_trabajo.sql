-- ============================================================
-- MIGRACION: Sistema de Órdenes de Trabajo y Tareas
-- ============================================================

-- 1. Crear tabla de órdenes de trabajo
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    objective TEXT,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    due_date TIMESTAMP WITH TIME ZONE,
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Baja', 'Normal', 'Alta', 'Urgente')),
    status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Aceptada', 'En Progreso', 'Realizada', 'Finalizada', 'Cancelada')),
    assigned_to UUID REFERENCES profiles(id) NOT NULL,
    created_by UUID REFERENCES profiles(id) NOT NULL,
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso para órdenes
CREATE POLICY "Ordenes viewable by everyone" ON ordenes_trabajo FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ordenes" ON ordenes_trabajo FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Anyone can update ordenes" ON ordenes_trabajo FOR UPDATE USING (true);

-- 4. Configuración de Storage para adjuntos (Bucket 'ordenes')
-- Nota: El bucket debe crearse en el dashboard o vía API de Storage.
-- Estas políticas asumen que el bucket 'ordenes' existe.

INSERT INTO storage.buckets (id, name, public) 
VALUES ('ordenes', 'ordenes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Adjuntos ordenes son publicos" ON storage.objects FOR SELECT USING (bucket_id = 'ordenes');
CREATE POLICY "Cualquier usuario autenticado puede subir adjuntos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ordenes' AND auth.role() = 'authenticated');
CREATE POLICY "Usuarios pueden borrar sus propios adjuntos" ON storage.objects FOR DELETE USING (bucket_id = 'ordenes' AND auth.uid() = owner);

-- 5. Mejoras en profiles (permitir edición de full_name y active)
-- Ya existen políticas en profiles, nos aseguramos de que permitan el update.
-- DROP POLICY IF EXISTS "Admin can update any profile" ON profiles;
-- CREATE POLICY "Admin can update any profile" ON profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
