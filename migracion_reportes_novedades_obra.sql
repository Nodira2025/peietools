-- ============================================================
-- MIGRACION: Sistema de Reportes de Novedades e Insumos de Obra
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reportes_novedades_obra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    creator_role TEXT DEFAULT 'logistica',
    obra_id UUID REFERENCES public.obras(id) NOT NULL,
    coordinador_id UUID REFERENCES public.profiles(id),
    item_description TEXT NOT NULL,
    tipo_accion TEXT DEFAULT 'reparacion_carga' CHECK (tipo_accion IN ('reparacion_carga', 'mantenimiento', 'ingreso', 'entrega', 'otro')),
    estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En Proceso', 'Completado', 'Cancelado')),
    observaciones TEXT,
    attachment_url TEXT
);

-- Habilitar RLS
ALTER TABLE public.reportes_novedades_obra ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (RLS)
CREATE POLICY "Reportes novedades visibles por todos los autenticados" 
    ON public.reportes_novedades_obra FOR SELECT 
    USING (true);

CREATE POLICY "Reportes novedades insertables por usuarios autenticados" 
    ON public.reportes_novedades_obra FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Reportes novedades actualizables por usuarios autenticados" 
    ON public.reportes_novedades_obra FOR UPDATE 
    USING (true);

CREATE POLICY "Reportes novedades eliminables por admin" 
    ON public.reportes_novedades_obra FOR DELETE 
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
