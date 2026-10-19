-- API de usuarios PEIE. Validacion en servidor y operaciones atomicas.
-- Los permisos de negocio se guardan en profiles, no en metadata editable.

CREATE OR REPLACE FUNCTION public.peie_username(p_value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE v text := lower(btrim(coalesce(p_value, '')));
BEGIN
  IF length(v) - length(replace(v, '@', '')) > 1 THEN
    RAISE EXCEPTION 'El usuario debe contener un solo dominio de correo.' USING ERRCODE = '22023';
  END IF;
  v := regexp_replace(v, '@peie[.]com$', '');
  IF v = '' OR length(v) > 254 OR v !~ '^[a-z0-9][a-z0-9._+-]*(@[a-z0-9][a-z0-9.-]*[.][a-z]{2,})?$' THEN
    RAISE EXCEPTION 'El usuario debe contener letras, numeros, punto, guion o un correo valido; sin espacios.' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.peie_require_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND active IS TRUE) THEN
    RAISE EXCEPTION 'Solo un administrador activo puede gestionar usuarios.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.peie_validate_password(p_password text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
BEGIN
  IF p_password IS NULL OR length(p_password) < 6 OR btrim(p_password) = '' OR octet_length(p_password) > 72 THEN
    RAISE EXCEPTION 'La contrasena debe tener al menos 6 caracteres y hasta 72 bytes.' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, username, role, whatsapp, photo_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name',
    CASE WHEN new.email IS NOT NULL THEN regexp_replace(lower(new.email), '@peie[.]com$', '') ELSE NULL END,
    'solicitante', new.raw_user_meta_data->>'whatsapp', new.raw_user_meta_data->>'photo_url');
  -- Compatibilidad con la gestion existente; solo admin_create_user asigna el rol solicitado.
  IF new.raw_user_meta_data->>'clear_password' IS NOT NULL THEN
    INSERT INTO public.user_passwords(user_id, clear_password)
    VALUES (new.id, new.raw_user_meta_data->>'clear_password')
    ON CONFLICT (user_id) DO UPDATE SET clear_password = EXCLUDED.clear_password, updated_at = now();
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_username text, p_password text, p_full_name text, p_role text, p_whatsapp text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
DECLARE
  v_user_id uuid;
  v_username text;
  v_email text;
BEGIN
  PERFORM public.peie_require_admin();
  v_username := public.peie_username(p_username);
  v_email := CASE WHEN strpos(v_username, '@') > 0 THEN v_username ELSE v_username || '@peie.com' END;
  PERFORM public.peie_validate_password(p_password);
  IF coalesce(btrim(p_full_name), '') = '' THEN RAISE EXCEPTION 'Completa el nombre del usuario.' USING ERRCODE = '22023'; END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin', 'solicitante', 'encargado', 'logistica') THEN
    RAISE EXCEPTION 'Selecciona un rol valido.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_email, 0));
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE lower(btrim(username)) = v_username) THEN
    RAISE EXCEPTION 'Ese usuario ya existe. Edita la cuenta existente.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO auth.users(
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', btrim(p_full_name), 'username', v_username, 'role', p_role,
      'whatsapp', p_whatsapp, 'clear_password', p_password), now(), now(),
    '', '', '', '', '', '', '', '', false
  ) RETURNING id INTO v_user_id;
  UPDATE public.profiles SET username = v_username, role = p_role WHERE id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo completar el perfil. No se creo la cuenta.'; END IF;
  INSERT INTO auth.identities(id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true), 'email', NULL, now(), now());
  RETURN v_user_id;
END;
$$;

-- Mantiene la firma anterior para los clientes que todavia tengan la pagina abierta.
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id uuid, p_new_username text, p_new_password text DEFAULT NULL,
  p_new_full_name text DEFAULT NULL, p_new_role text DEFAULT NULL, p_new_whatsapp text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
DECLARE
  v_username text;
  v_email text;
  v_profile public.profiles%ROWTYPE;
BEGIN
  PERFORM public.peie_require_admin();
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'No se encontro la cuenta a modificar.' USING ERRCODE = '22023';
  END IF;
  v_username := public.peie_username(p_new_username);
  v_email := CASE WHEN strpos(v_username, '@') > 0 THEN v_username ELSE v_username || '@peie.com' END;
  IF p_new_password IS NOT NULL THEN PERFORM public.peie_validate_password(p_new_password); END IF;
  IF p_new_full_name IS NOT NULL AND btrim(p_new_full_name) = '' THEN RAISE EXCEPTION 'Completa el nombre del usuario.' USING ERRCODE = '22023'; END IF;
  IF p_new_role IS NOT NULL AND p_new_role NOT IN ('admin', 'solicitante', 'encargado', 'logistica') THEN
    RAISE EXCEPTION 'Selecciona un rol valido.' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = auth.uid() AND coalesce(p_new_role, v_profile.role) <> 'admin' THEN
    RAISE EXCEPTION 'No puedes quitarte tus propios permisos de administrador.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_email, 0));
  IF EXISTS (SELECT 1 FROM auth.users WHERE id <> p_user_id AND lower(email) = v_email)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id <> p_user_id AND lower(btrim(username)) = v_username) THEN
    RAISE EXCEPTION 'Ese usuario ya existe. Elige otro nombre de acceso.' USING ERRCODE = '23505';
  END IF;
  UPDATE auth.users SET email = v_email,
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    encrypted_password = CASE WHEN p_new_password IS NOT NULL THEN crypt(p_new_password, gen_salt('bf')) ELSE encrypted_password END,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'username', v_username, 'full_name', coalesce(btrim(p_new_full_name), v_profile.full_name),
      'role', coalesce(p_new_role, v_profile.role), 'whatsapp', coalesce(p_new_whatsapp, v_profile.whatsapp)),
    updated_at = now()
  WHERE id = p_user_id;
  UPDATE auth.identities SET identity_data = coalesce(identity_data, '{}'::jsonb) ||
    jsonb_build_object('sub', p_user_id::text, 'email', v_email, 'email_verified', true), updated_at = now()
  WHERE user_id = p_user_id AND provider = 'email';
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no tiene identidad de acceso. No se guardaron cambios.'; END IF;
  UPDATE public.profiles SET username = v_username,
    full_name = coalesce(btrim(p_new_full_name), full_name), role = coalesce(p_new_role, role),
    whatsapp = coalesce(p_new_whatsapp, whatsapp) WHERE id = p_user_id;
  IF p_new_password IS NOT NULL THEN
    INSERT INTO public.user_passwords(user_id, clear_password) VALUES (p_user_id, p_new_password)
    ON CONFLICT (user_id) DO UPDATE SET clear_password = EXCLUDED.clear_password, updated_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_v2(
  p_user_id uuid, p_new_username text, p_new_password text, p_new_full_name text,
  p_new_role text, p_new_whatsapp text, p_new_active boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.peie_require_admin();
  IF p_new_active IS NULL THEN RAISE EXCEPTION 'Indica si el usuario esta activo.' USING ERRCODE = '22023'; END IF;
  IF p_user_id = auth.uid() AND NOT p_new_active THEN
    RAISE EXCEPTION 'No puedes desactivar tu propia cuenta.' USING ERRCODE = '22023';
  END IF;
  PERFORM public.admin_update_user(p_user_id, p_new_username, p_new_password, p_new_full_name, p_new_role, p_new_whatsapp);
  UPDATE public.profiles SET active = p_new_active WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_own_password(p_new_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active IS TRUE) THEN
    RAISE EXCEPTION 'Inicia sesion con una cuenta activa.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.peie_validate_password(p_new_password);
  UPDATE auth.users SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now() WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontro tu cuenta.'; END IF;
  INSERT INTO public.user_passwords(user_id, clear_password) VALUES (auth.uid(), p_new_password)
  ON CONFLICT (user_id) DO UPDATE SET clear_password = EXCLUDED.clear_password, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_user(uuid,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_user_v2(uuid,text,text,text,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_own_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text,text,text,text,text),
  public.admin_update_user(uuid,text,text,text,text,text),
  public.admin_update_user_v2(uuid,text,text,text,text,text,boolean), public.change_own_password(text) TO authenticated;
