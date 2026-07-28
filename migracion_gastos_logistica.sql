-- ============================================================
-- MIGRACION: Tabla de Gastos de Logística para Historial y Reportes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gastos_logistica (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concepto TEXT NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    obra_id UUID REFERENCES public.obras(id),
    obra_name TEXT,
    empleado_name TEXT,
    metodo_pago TEXT DEFAULT 'Cuenta corriente BP',
    detalle TEXT,
    registered_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.gastos_logistica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gastos logistica viewable by everyone" ON public.gastos_logistica;
CREATE POLICY "Gastos logistica viewable by everyone" ON public.gastos_logistica FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert gastos_logistica" ON public.gastos_logistica;
CREATE POLICY "Anyone can insert gastos_logistica" ON public.gastos_logistica FOR INSERT WITH CHECK (true);
