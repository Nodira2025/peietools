-- Reparacion de acceso de Patricio y prevencion en altas nuevas.
-- Proyecto PEIE: kwgzivpokkhaeyrvhkbm.
-- Aplicada el 2026-10-19 tras verificar email_change NULL y la funcion instalada.
-- Conserva identificador, contrasena, rol, perfil e identidades existentes.
-- No modifica el esquema administrado por Supabase ni reinicia tablas.

BEGIN;

DO $repair$
DECLARE
  v_target CONSTANT uuid := '389a69d0-f06e-4ccf-99e5-af9cd5f1828f';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id = u.id
    WHERE u.id = v_target
      AND lower(u.email) = 'patricio@peie.com'
      AND lower(p.username) = 'patricio'
      AND p.full_name = 'Patricio Porcelo Zakelj'
      AND p.role = 'solicitante' AND p.active IS TRUE
  ) THEN
    RAISE EXCEPTION 'No coincide la cuenta de Patricio: revisar proyecto e identidad antes de continuar';
  END IF;

  -- Solo completa valores NULL. Conserva cualquier token o cambio pendiente.
  UPDATE auth.users SET
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '')
  WHERE id = v_target AND (
    confirmation_token IS NULL OR recovery_token IS NULL OR
    email_change_token_new IS NULL OR email_change IS NULL OR
    email_change_token_current IS NULL OR phone_change IS NULL OR
    phone_change_token IS NULL OR reauthentication_token IS NULL
  );
END;
$repair$;

-- Mantiene la API y la comprobacion de administrador existentes.
CREATE OR REPLACE FUNCTION public.admin_create_user(
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
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
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
    -- Supabase Auth lee estos campos como strings; NULL provoca un error 500.
    '', '', '', '', '', '', '', '', false
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

COMMIT;

-- Verificacion sin exponer contrasenas ni tokens.
SELECT p.full_name, p.username, p.role, p.active,
  u.confirmation_token IS NOT NULL AND u.recovery_token IS NOT NULL AND
  u.email_change_token_new IS NOT NULL AND u.email_change IS NOT NULL AND
  u.email_change_token_current IS NOT NULL AND u.phone_change IS NOT NULL AND
  u.phone_change_token IS NOT NULL AND u.reauthentication_token IS NOT NULL
  AS campos_auth_completos
FROM auth.users u JOIN public.profiles p ON p.id = u.id
WHERE u.id = '389a69d0-f06e-4ccf-99e5-af9cd5f1828f';
