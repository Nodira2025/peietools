-- ============================================================
-- API DE GESTIÓN DE USUARIOS (ADMIN)
-- Permite a los administradores crear y actualizar usuarios 
-- saltándose la confirmación de email y actualizando contraseñas.
-- ============================================================

-- 1. Función para crear usuario con confirmación automática
CREATE OR REPLACE FUNCTION admin_create_user(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_whatsapp TEXT
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  -- Verificar si el que llama es admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta acción';
  END IF;

  v_email := p_username || '@peie.com';

  -- Crear el usuario en auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(), -- Confirmación automática
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'role', p_role, 'whatsapp', p_whatsapp),
    now(),
    now(),
    '', '', '', false
  ) RETURNING id INTO v_user_id;

  -- Crear identidad (requerido para login)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id,
    format('{"sub":"%s","email":"%s","email_verified":true}', v_user_id::text, v_email)::jsonb,
    'email',
    now(),
    now(),
    now()
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para actualizar usuario (incluye contraseña)
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

  -- 1. Actualizar auth.users
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
