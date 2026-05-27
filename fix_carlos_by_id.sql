-- =========================================================================
-- PEIE TOOLS - CORRECCIÓN DEFINITIVA POR ID (EVITA PROBLEMAS DE MAYÚSCULAS)
-- Ejecuta este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Confirmar el correo y forzar email correcto para Carlos usando su ID exacto
UPDATE auth.users 
SET email = 'carlos@peie.com',
    email_confirmed_at = now(), 
    updated_at = now() 
WHERE id = '90702240-ad72-44a1-b19c-f47e7e3f60a7';

-- 2. Asegurar que su perfil público tiene el rol 'admin' y está activo
UPDATE public.profiles 
SET role = 'admin',
    active = true
WHERE id = '90702240-ad72-44a1-b19c-f47e7e3f60a7';

-- 3. Confirmar cuántas filas fueron afectadas para verificar éxito
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE id = '90702240-ad72-44a1-b19c-f47e7e3f60a7';
