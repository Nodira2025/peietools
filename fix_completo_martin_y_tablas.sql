-- ====================================================================
-- SCRIPT AUTORREPARABLE: CREAR TABLA PROFILES Y USUARIO MARTIN
-- ====================================================================

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Asegurar que la tabla profiles exista
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    username TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'solicitante',
    whatsapp TEXT,
    obra_id UUID,
    photo_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar políticas de seguridad si no están activas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- 4. Recrear de forma limpia el usuario Martin
DO $$
DECLARE
  v_user_id UUID := '586d95a0-df23-42c7-926a-892d9b7e52a6';
BEGIN
  -- Limpieza previa en auth
  DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'martin@peie.com') OR user_id = v_user_id;
  DELETE FROM auth.users WHERE email = 'martin@peie.com' OR id = v_user_id;

  -- Crear en auth.users con contraseña "martin123"
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud,
    is_sso_user
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'martin@peie.com',
    crypt('martin123', gen_salt('bf')),
    now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Martin Grande","role":"encargado","whatsapp":"+54 9 3816 69-8316"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated',
    false
  );

  -- Crear identidad en auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    created_at,
    updated_at,
    last_sign_in_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    format('{"sub":"%s","email":"martin@peie.com","email_verified":true}', v_user_id::text)::jsonb,
    'email',
    now(),
    now(),
    now()
  );

  -- Insertar o actualizar en public.profiles
  INSERT INTO public.profiles (
    id,
    full_name,
    username,
    role,
    whatsapp,
    active,
    created_at
  ) VALUES (
    v_user_id,
    'Martin Grande',
    'martin',
    'encargado',
    '+54 9 3816 69-8316',
    true,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = 'martin',
    role = 'encargado',
    whatsapp = '+54 9 3816 69-8316',
    active = true;

END $$;
