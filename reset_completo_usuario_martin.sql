-- ====================================================================
-- SCRIPT COMPLETO DE RECONSTRUCCIÓN Y ACCESO PARA EL USUARIO MARTIN
-- ====================================================================

DO $$
DECLARE
  v_user_id UUID := '586d95a0-df23-42c7-926a-892d9b7e52a6';
BEGIN
  -- 1. Limpiar registros previos de auth para evitar conflictos de ID o tokens corruptos
  DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'martin@peie.com') OR user_id = v_user_id;
  DELETE FROM auth.users WHERE email = 'martin@peie.com' OR id = v_user_id;

  -- 2. Crear usuario oficial en auth.users con contraseña "martin123" y email confirmado
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

  -- 3. Crear identidad correspondiente en auth.identities
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

  -- 4. Recrear / Actualizar perfil en public.profiles
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

  -- 5. Actualizar en user_passwords si existe la tabla
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_passwords') THEN
    INSERT INTO public.user_passwords (user_id, clear_password, updated_at)
    VALUES (v_user_id, 'martin123', now())
    ON CONFLICT (user_id) DO UPDATE SET
      clear_password = 'martin123',
      updated_at = now();
  END IF;

END $$;
