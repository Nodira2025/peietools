-- =========================================================================
-- MIGRACION: Actualización de Usuarios y Admins (Mayo 2026)
-- Ejecutar este script en el SQL Editor de Supabase
-- =========================================================================

-- 1. Actualizar Martin Grande (Nuevo número)
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"whatsapp": "+54 9 3816 69-8316"}'::jsonb
WHERE email = 'martin@peie.com';

UPDATE public.profiles 
SET whatsapp = '+54 9 3816 69-8316'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'martin@peie.com');

-- 2. Actualizar Federico Grande (Ascender a Admin y actualizar número)
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin", "whatsapp": "+54 9 3814 01-5738"}'::jsonb
WHERE email = 'federico@peie.com';

UPDATE public.profiles 
SET role = 'admin', whatsapp = '+54 9 3814 01-5738'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'federico@peie.com');

-- 3. Crear Florencia Grande (Admin)
DO $$
DECLARE
  new_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'florencia@peie.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at, role, aud, is_sso_user
    ) VALUES (
      new_id, '00000000-0000-0000-0000-000000000000', 'florencia@peie.com', 
      crypt('admin123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Florencia Grande","role":"admin","whatsapp":"+54 9 3813 32-3666"}',
      now(), now(), 'authenticated', 'authenticated', false
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    VALUES (gen_random_uuid(), new_id, new_id, format('{"sub":"%s","email":"florencia@peie.com","email_verified":true}', new_id::text)::jsonb, 'email', now(), now(), now());
  END IF;
END $$;

-- 4. Crear Melisa Gonzales (Admin)
DO $$
DECLARE
  new_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'melisa@peie.com') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at, role, aud, is_sso_user
    ) VALUES (
      new_id, '00000000-0000-0000-0000-000000000000', 'melisa@peie.com', 
      crypt('admin123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Melisa Gonzales","role":"admin","whatsapp":"+54 9 3816 29-5626"}',
      now(), now(), 'authenticated', 'authenticated', false
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    VALUES (gen_random_uuid(), new_id, new_id, format('{"sub":"%s","email":"melisa@peie.com","email_verified":true}', new_id::text)::jsonb, 'email', now(), now(), now());
  END IF;
END $$;
