-- =========================================================================
-- PEIE TOOLS - MIGRACIÓN DE ACTUALIZACIÓN V8
-- HABILITAR POLÍTICAS DE ELIMINACIÓN (DELETE) PARA ROLES ADMINISTRATIVOS
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Políticas de eliminación para la tabla: herramientas
DROP POLICY IF EXISTS "Herramientas delete by admins" ON public.herramientas;
CREATE POLICY "Herramientas delete by admins" ON public.herramientas FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'logistica' OR role = 'compras')
  )
);

-- 2. Políticas de eliminación para la tabla: solicitudes
DROP POLICY IF EXISTS "Solicitudes delete by admins" ON public.solicitudes;
CREATE POLICY "Solicitudes delete by admins" ON public.solicitudes FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'logistica' OR role = 'compras')
  )
);

-- 3. Políticas de eliminación para la tabla: movimientos
DROP POLICY IF EXISTS "Movimientos delete by admins" ON public.movimientos;
CREATE POLICY "Movimientos delete by admins" ON public.movimientos FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'logistica' OR role = 'compras')
  )
);

-- 4. Políticas de eliminación para la tabla: mantenimientos
DROP POLICY IF EXISTS "Mantenimientos delete by admins" ON public.mantenimientos;
CREATE POLICY "Mantenimientos delete by admins" ON public.mantenimientos FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'logistica' OR role = 'compras')
  )
);

-- 5. Políticas de eliminación para la tabla: tracking_history (Por seguridad)
DROP POLICY IF EXISTS "Tracking history delete by admins" ON public.tracking_history;
CREATE POLICY "Tracking history delete by admins" ON public.tracking_history FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'logistica' OR role = 'compras')
  )
);
