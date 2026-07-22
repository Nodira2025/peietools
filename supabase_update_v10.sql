-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN DE ACTUALIZACIÓN V10
-- PERMITIR ELIMINACIÓN DE REGISTROS (RLS DELETE POLICIES)
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Políticas RLS de eliminación para Movimientos
DROP POLICY IF EXISTS "Anyone can delete movimientos" ON public.movimientos;
CREATE POLICY "Anyone can delete movimientos" ON public.movimientos FOR DELETE USING (true);

-- 2. Políticas RLS de eliminación para Solicitudes
DROP POLICY IF EXISTS "Anyone can delete solicitudes" ON public.solicitudes;
CREATE POLICY "Anyone can delete solicitudes" ON public.solicitudes FOR DELETE USING (true);

-- 3. Políticas RLS de eliminación para Herramientas
DROP POLICY IF EXISTS "Anyone can delete herramientas" ON public.herramientas;
CREATE POLICY "Anyone can delete herramientas" ON public.herramientas FOR DELETE USING (true);

-- 4. Políticas RLS de eliminación para Solicitudes de Compras
DROP POLICY IF EXISTS "Anyone can delete solicitudes_compras" ON public.solicitudes_compras;
CREATE POLICY "Anyone can delete solicitudes_compras" ON public.solicitudes_compras FOR DELETE USING (true);

-- 5. Políticas RLS de eliminación para Traslados de Personal
DROP POLICY IF EXISTS "Anyone can delete traslados_personal" ON public.traslados_personal;
CREATE POLICY "Anyone can delete traslados_personal" ON public.traslados_personal FOR DELETE USING (true);
