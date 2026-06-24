-- =========================================================================
-- MIGRACIÓN DE BASE DE DATOS: AUTOGESTIÓN DE CONTRASEÑAS Y TERMINOLOGÍA
-- =========================================================================

-- 1. Crear tabla para almacenar contraseñas en texto claro de forma segura
CREATE TABLE IF NOT EXISTS public.user_passwords (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clear_password TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.user_passwords ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas si existen
DROP POLICY IF EXISTS "Admins can view all passwords" ON public.user_passwords;
DROP POLICY IF EXISTS "Users can view own password" ON public.user_passwords;
DROP POLICY IF EXISTS "Admins can insert/update all passwords" ON public.user_passwords;
DROP POLICY IF EXISTS "Users can update own password" ON public.user_passwords;

-- Crear políticas
CREATE POLICY "Admins can view all passwords" ON public.user_passwords
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view own password" ON public.user_passwords
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert/update all passwords" ON public.user_passwords
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update own password" ON public.user_passwords
  FOR UPDATE USING (auth.uid() = user_id);

-- 2. Modificar trigger handle_new_user para guardar la contraseña en texto claro
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, whatsapp, photo_url)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'solicitante'),
    new.raw_user_meta_data->>'whatsapp',
    new.raw_user_meta_data->>'photo_url'
  );

  -- Si se pasa una contraseña en texto claro al crearse en auth.users, la guardamos
  IF new.raw_user_meta_data->>'clear_password' IS NOT NULL THEN
    INSERT INTO public.user_passwords (user_id, clear_password)
    VALUES (new.id, new.raw_user_meta_data->>'clear_password')
    ON CONFLICT (user_id) DO UPDATE SET clear_password = EXCLUDED.clear_password, updated_at = now();
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Modificar admin_create_user para guardar la contraseña en metadata
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

  -- Crear el usuario en auth.users (incluye clear_password en metadata para el trigger)
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
    jsonb_build_object('full_name', p_full_name, 'role', p_role, 'whatsapp', p_whatsapp, 'clear_password', p_password),
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

-- 4. Modificar admin_update_user para guardar la contraseña actualizada en texto claro
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

  -- 4. Actualizar public.user_passwords si se provee una nueva contraseña
  IF p_new_password IS NOT NULL THEN
    INSERT INTO public.user_passwords (user_id, clear_password)
    VALUES (p_user_id, p_new_password)
    ON CONFLICT (user_id) DO UPDATE SET clear_password = EXCLUDED.clear_password, updated_at = now();
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear la función para cambiar la propia contraseña (autogestión)
CREATE OR REPLACE FUNCTION change_own_password(
  p_new_password TEXT
) RETURNS VOID AS $$
BEGIN
  -- 1. Actualizar auth.users
  UPDATE auth.users SET
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = auth.uid();

  -- 2. Actualizar/insertar en public.user_passwords
  INSERT INTO public.user_passwords (user_id, clear_password)
  VALUES (auth.uid(), p_new_password)
  ON CONFLICT (user_id) DO UPDATE SET clear_password = EXCLUDED.clear_password, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
