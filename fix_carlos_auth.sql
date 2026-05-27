-- =========================================================================
-- PEIE TOOLS - CORRECCIÓN DE USUARIO CARLOS GRANDE Y FUNCIÓN DE ACTUALIZACIÓN
-- Ejecuta este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Confirmar el correo de Carlos Grande
UPDATE auth.users 
SET email_confirmed_at = now(), 
    updated_at = now() 
WHERE email = 'carlos@peie.com';

-- 2. Asegurar que su perfil público tiene el rol 'admin' y está activo
UPDATE public.profiles 
SET role = 'admin',
    active = true
WHERE username = 'Carlos';

-- 3. Actualizar la función admin_update_user para asegurar confirmación de email automática en el futuro
CREATE OR REPLACE FUNCTION admin_update_user(
  p_user_id UUID,
  p_new_username TEXT,
  p_new_password TEXT DEFAULT NULL,
  p_new_full_name TEXT DEFAULT NULL,
  p_new_role TEXT DEFAULT NULL,
  p_new_whatsapp TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_new_email TEXT;
BEGIN
  -- Verificar si el que llama es admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta acción';
  END IF;

  v_new_email := p_new_username || '@peie.com';

  -- 1. Actualizar auth.users (y auto-confirmar email si no lo estaba)
  UPDATE auth.users SET
    email = v_new_email,
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    encrypted_password = CASE WHEN p_new_password IS NOT NULL THEN crypt(p_new_password, gen_salt('bf')) ELSE encrypted_password END,
    updated_at = now()
  WHERE id = p_user_id;

  -- 2. Actualizar auth.identities
  UPDATE auth.identities SET
    identity_data = format('{"sub":"%s","email":"%s","email_verified":true}', p_user_id::text, v_new_email)::jsonb,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- 3. Actualizar public.profiles
  UPDATE public.profiles SET
    username = p_new_username,
    full_name = COALESCE(p_new_full_name, full_name),
    role = COALESCE(p_new_role, role),
    whatsapp = COALESCE(p_new_whatsapp, whatsapp)
  WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
