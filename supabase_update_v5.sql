-- =========================================================================
-- PEIE TOOLS - DEFINITIVE DATABASE WIPE & RESET SCRIPT (v5)
-- Generated based on DDBB - 06-2026 (1).xlsx
-- Wipes test/dummy logs, orders, profiles, and initializes clean production DB
-- =========================================================================

BEGIN;

-- A. WIPE TEST/LOG DATA AND RESET TABLES
UPDATE public.herramientas SET current_obra_id = NULL;
TRUNCATE TABLE public.tracking_history CASCADE;
TRUNCATE TABLE public.movimientos CASCADE;
TRUNCATE TABLE public.mantenimientos CASCADE;
TRUNCATE TABLE public.solicitudes_compras CASCADE;
TRUNCATE TABLE public.solicitudes CASCADE;
TRUNCATE TABLE public.traslados_personal CASCADE;
TRUNCATE TABLE public.empleados CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- B. INITIALIZE ROLES
INSERT INTO public.roles (name) VALUES ('admin'), ('solicitante'), ('logistica'), ('compras'), ('encargado') ON CONFLICT DO NOTHING;

-- C. POPULATE PRODUCTION OBRAS
INSERT INTO public.obras (name, address, active) VALUES ('#300 - LINK', '#300 - LINK, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('AEROPUERTO', 'AEROPUERTO, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('ALBERDI 152', 'ALBERDI 152, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('ARQUITECTOS Y ASOCIADOS', 'ARQUITECTOS Y ASOCIADOS, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('AUSENTES / LIC. MEDICA', 'AUSENTES / LIC. MEDICA, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('BAMBOO', 'BAMBOO, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('CIRCUNVALACION', 'CIRCUNVALACION, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('CLINICA MAYO', 'CLINICA MAYO, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('COLETTI - WALDHAUS', 'COLETTI - WALDHAUS, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('COUNTRY CANTARES', 'COUNTRY CANTARES, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('DEPOSITO PEIE', 'DEPOSITO PEIE, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('DOMUS', 'DOMUS, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('LA RIOJA 846', 'LA RIOJA 846, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('LIVE', 'LIVE, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('MANTENIMIENTO', 'MANTENIMIENTO, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('OBRA CENTRAL', 'OBRA CENTRAL, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('ONE BOULEVARD', 'ONE BOULEVARD, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('ONE RESIDENCE', 'ONE RESIDENCE, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('PEDRO DE VILLALBA', 'PEDRO DE VILLALBA, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('QUALITY BARRIO NORTE', 'QUALITY BARRIO NORTE, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('SAN PABLO', 'SAN PABLO, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('SHELL OASIS', 'SHELL OASIS, Tucumán', true);
INSERT INTO public.obras (name, address, active) VALUES ('TORRE DUO - LINK', 'TORRE DUO - LINK, Tucumán', true);

-- D. POPULATE PRODUCTION USERS
-- Account: Administrador General
DO $$
DECLARE
  u_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    u_id, '00000000-0000-0000-0000-000000000000', 'admin@peie.com', 
    crypt('admin123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Administrador General","role":"admin","whatsapp":"+543810000000"}',
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), u_id, u_id, format('{"sub":"%s","email":"admin@peie.com","email_verified":true}', u_id::text)::jsonb, 'email', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, role, whatsapp, active)
  VALUES (u_id, 'Administrador General', 'admin', '+543810000000', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    whatsapp = EXCLUDED.whatsapp,
    active = EXCLUDED.active;
END $$;
-- Account: Franco Lobo
DO $$
DECLARE
  u_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    u_id, '00000000-0000-0000-0000-000000000000', 'franco@peie.com', 
    crypt('franco123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Franco Lobo","role":"encargado","whatsapp":"+54 9 381 402-2910"}',
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), u_id, u_id, format('{"sub":"%s","email":"franco@peie.com","email_verified":true}', u_id::text)::jsonb, 'email', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, role, whatsapp, active)
  VALUES (u_id, 'Franco Lobo', 'encargado', '+54 9 381 402-2910', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    whatsapp = EXCLUDED.whatsapp,
    active = EXCLUDED.active;
END $$;
-- Account: Cristian Perez
DO $$
DECLARE
  u_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    u_id, '00000000-0000-0000-0000-000000000000', 'cristian@peie.com', 
    crypt('cristian123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Cristian Perez","role":"encargado","whatsapp":"+543816490060"}',
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), u_id, u_id, format('{"sub":"%s","email":"cristian@peie.com","email_verified":true}', u_id::text)::jsonb, 'email', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, role, whatsapp, active)
  VALUES (u_id, 'Cristian Perez', 'encargado', '+543816490060', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    whatsapp = EXCLUDED.whatsapp,
    active = EXCLUDED.active;
END $$;
-- Account: Santiago Moreno
DO $$
DECLARE
  u_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    u_id, '00000000-0000-0000-0000-000000000000', 'santiago@peie.com', 
    crypt('santiago123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Santiago Moreno","role":"logistica","whatsapp":"+543815158212"}',
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), u_id, u_id, format('{"sub":"%s","email":"santiago@peie.com","email_verified":true}', u_id::text)::jsonb, 'email', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, role, whatsapp, active)
  VALUES (u_id, 'Santiago Moreno', 'logistica', '+543815158212', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    whatsapp = EXCLUDED.whatsapp,
    active = EXCLUDED.active;
END $$;
-- Account: Martin Grande
DO $$
DECLARE
  u_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    u_id, '00000000-0000-0000-0000-000000000000', 'martin@peie.com', 
    crypt('martin123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Martin Grande","role":"admin","whatsapp":"+54 9 3816 69-8316"}',
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), u_id, u_id, format('{"sub":"%s","email":"martin@peie.com","email_verified":true}', u_id::text)::jsonb, 'email', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, role, whatsapp, active)
  VALUES (u_id, 'Martin Grande', 'admin', '+54 9 3816 69-8316', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    whatsapp = EXCLUDED.whatsapp,
    active = EXCLUDED.active;
END $$;
-- Account: Carlos Grande
DO $$
DECLARE
  u_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    u_id, '00000000-0000-0000-0000-000000000000', 'carlos@peie.com', 
    crypt('carlos123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Carlos Grande","role":"admin","whatsapp":"+54 9 381 604-4615"}',
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), u_id, u_id, format('{"sub":"%s","email":"carlos@peie.com","email_verified":true}', u_id::text)::jsonb, 'email', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, role, whatsapp, active)
  VALUES (u_id, 'Carlos Grande', 'admin', '+54 9 381 604-4615', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    whatsapp = EXCLUDED.whatsapp,
    active = EXCLUDED.active;
END $$;
-- Account: Melisa Gonzalez
DO $$
DECLARE
  u_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    u_id, '00000000-0000-0000-0000-000000000000', 'melisa@peie.com', 
    crypt('melisa123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Melisa Gonzalez","role":"admin","whatsapp":"+54 9 3816 29-5626"}',
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), u_id, u_id, format('{"sub":"%s","email":"melisa@peie.com","email_verified":true}', u_id::text)::jsonb, 'email', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, role, whatsapp, active)
  VALUES (u_id, 'Melisa Gonzalez', 'admin', '+54 9 3816 29-5626', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    whatsapp = EXCLUDED.whatsapp,
    active = EXCLUDED.active;
END $$;
-- Account: Federico Grande
DO $$
DECLARE
  u_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    u_id, '00000000-0000-0000-0000-000000000000', 'federico@peie.com', 
    crypt('federico123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Federico Grande","role":"admin","whatsapp":"+54 9 3814 01-5738"}',
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), u_id, u_id, format('{"sub":"%s","email":"federico@peie.com","email_verified":true}', u_id::text)::jsonb, 'email', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, role, whatsapp, active)
  VALUES (u_id, 'Federico Grande', 'admin', '+54 9 3814 01-5738', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    whatsapp = EXCLUDED.whatsapp,
    active = EXCLUDED.active;
END $$;
-- Account: Alejandra Guzman
DO $$
DECLARE
  u_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    u_id, '00000000-0000-0000-0000-000000000000', 'alejandra@peie.com', 
    crypt('alejandra123', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alejandra Guzman","role":"admin","whatsapp":"+543810000000"}',
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES (gen_random_uuid(), u_id, u_id, format('{"sub":"%s","email":"alejandra@peie.com","email_verified":true}', u_id::text)::jsonb, 'email', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, role, whatsapp, active)
  VALUES (u_id, 'Alejandra Guzman', 'admin', '+543810000000', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    whatsapp = EXCLUDED.whatsapp,
    active = EXCLUDED.active;
END $$;

-- E. POPULATE PRODUCTION EMPLOYEES
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Acosta, Leonel', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'BAMBOO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Aguirresarobe, Marcelo', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'QUALITY BARRIO NORTE' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Alanis, Agustín Alejo', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'DOMUS' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Ale, Héctor Antonio', 'Oficial especializado', 'Disponible', id FROM public.obras WHERE name = 'TORRE DUO - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Altamiranda, Esteban German', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'AEROPUERTO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Alvarez, Carlos Antonio', 'Oficial especializado', 'Disponible', id FROM public.obras WHERE name = '#300 - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Blanco Medina, Juan José', 'Medio Oficial', 'Disponible', id FROM public.obras WHERE name = 'TORRE DUO - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Blanco Medina, Yonatan Gabriel', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Carrizo, Luis Fabián', 'Oficial especializado', 'Disponible', id FROM public.obras WHERE name = 'CLINICA MAYO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Castro, Gustavo Mauricio', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'AEROPUERTO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Catán, Cristian Alejandro', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = '#300 - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Catán, David Nazareno', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Cruz, Gustavo Manuel', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'TORRE DUO - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'De la Rosa, Christian', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'AEROPUERTO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Espinoza, Facundo', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'DOMUS' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Figueroa, Rubén Antonio', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'DOMUS' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Flores, Hector Alexis', 'Medio Oficial', 'Disponible', id FROM public.obras WHERE name = 'DOMUS' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Ibañez, Manuel Enrique', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'SHELL OASIS' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Jimenez, Santiago Emanuel', 'Medio Oficial', 'Disponible', id FROM public.obras WHERE name = 'SHELL OASIS' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Ledesma, Marcos German', 'Oficial', 'Disponible', id FROM public.obras WHERE name = '#300 - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Lizarraga, Gustavo Matías', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'QUALITY BARRIO NORTE' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Lobos, Eduardo Marcelo', 'Oficial especializado', 'Disponible', id FROM public.obras WHERE name = 'AEROPUERTO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Lopez, Leonardo Andrés', 'Oficial especializado', 'Disponible', id FROM public.obras WHERE name = 'TORRE DUO - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Lopez, Nicolas Eduardo', 'Medio Oficial', 'Disponible', id FROM public.obras WHERE name = 'AEROPUERTO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Lopez, Ramon Edgardo', 'Medio Oficial', 'Disponible', id FROM public.obras WHERE name = 'AEROPUERTO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Lucena, Enzo Emanuel', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'AEROPUERTO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Martinez, Guillermo Ariel', 'Oficial especializado', 'Disponible', id FROM public.obras WHERE name = 'TORRE DUO - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Medina, Franco Daniel', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'AEROPUERTO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Mendoza, Rene Néstor', 'Ayudante', 'Disponible', id FROM public.obras WHERE name = 'TORRE DUO - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Olivera, Cristhian Gastón', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Paz, Jorge Gastón', 'Medio Oficial', 'Disponible', id FROM public.obras WHERE name = 'BAMBOO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Rivero, Leandro Nicolas', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'TORRE DUO - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Rojas, Carlos Daniel', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'BAMBOO' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Torres, Jorge Manuel', 'Oficial especializado', 'Disponible', id FROM public.obras WHERE name = 'TORRE DUO - LINK' LIMIT 1;
INSERT INTO public.empleados (full_name, specialty, status, obra_id) SELECT 'Ybañez, Pablo Alejandro', 'Oficial', 'Disponible', id FROM public.obras WHERE name = 'CLINICA MAYO' LIMIT 1;

-- F. POPULATE AND SYNC TOOLS
-- Tool: A-41/2-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'A-41/2-01', 'A-41/2-01', 'Amoladora (4 1/2")', 'Hamilton', 'Hamilton', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: A-41/2-O2
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'A-41/2-O2', 'A-41/2-O2', 'Amoladora (4 1/2")', 'Skil', 'Skil', 'Disponible', id 
FROM public.obras WHERE name = 'DOMUS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: A-41/2-O3
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'A-41/2-O3', 'A-41/2-O3', 'Amoladora (4 1/2")', 'Hamilton', 'Hamilton', 'Disponible', id 
FROM public.obras WHERE name = 'QUALITY BARRIO NORTE' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: A-41/2-O4
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'A-41/2-O4', 'A-41/2-O4', 'Amoladora (4 1/2")', 'Black&Decker', 'Black&Decker', 'Disponible', id 
FROM public.obras WHERE name = 'MANTENIMIENTO' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: A-7-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'A-7-01', 'A-7-01', 'Amoladora (7")', 'Total', 'Total', 'Disponible', id 
FROM public.obras WHERE name = 'SHELL OASIS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: A-7-02
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'A-7-02', 'A-7-02', 'Amoladora (7")', 'Total', 'Total', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ANC-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ANC-01', 'ANC-01', 'Cuerpo Andamio 1', '', '', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ANC-02
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ANC-02', 'ANC-02', 'Cuerpo Andamio 2', '', '', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ANC-03
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ANC-03', 'ANC-03', 'Cuerpo Andamio 3', '', '', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ARN-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ARN-01', 'ARN-01', 'Arnés', 'Amarillo', 'Amarillo', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ESC-03
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ESC-03', 'ESC-03', 'Escalera 3', 'Cant peldaños', 'Cant peldaños', 'Disponible', id 
FROM public.obras WHERE name = 'DOMUS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ESC-04
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ESC-04', 'ESC-04', 'Escalera 4', 'Cant peldaños', 'Cant peldaños', 'Disponible', id 
FROM public.obras WHERE name = 'DOMUS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ESC-05
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ESC-05', 'ESC-05', 'Escalera 5', 'Cant peldaños', 'Cant peldaños', 'Disponible', id 
FROM public.obras WHERE name = 'DOMUS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ESC01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ESC01', 'ESC01', 'Escalera 1', 'Cant peldaños', 'Cant peldaños', 'Disponible', id 
FROM public.obras WHERE name = 'SHELL OASIS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ESC02
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ESC02', 'ESC02', 'Escalera 2', 'Cant peldaños', 'Cant peldaños', 'Disponible', id 
FROM public.obras WHERE name = 'SHELL OASIS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: GA-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'GA-01', 'GA-01', 'Garrafa', 'Negra', 'Negra', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: GA-02
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'GA-02', 'GA-02', 'Garrafa', 'Roja', 'Roja', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: PI-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'PI-01', 'PI-01', 'Pinza de identar', '', '', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: PI-02
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'PI-02', 'PI-02', 'Pinza de identar', '', '', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: RES-20-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'RES-20-01', 'RES-20-01', 'Resorte', '20mm (3/4")', '20mm (3/4")', 'Disponible', id 
FROM public.obras WHERE name = 'SHELL OASIS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: RES-22-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'RES-22-01', 'RES-22-01', 'Resorte', '22mm (7/8")', '22mm (7/8")', 'Disponible', id 
FROM public.obras WHERE name = 'SHELL OASIS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: RES-25-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'RES-25-01', 'RES-25-01', 'Resorte', '25mm (1")', '25mm (1")', 'Disponible', id 
FROM public.obras WHERE name = 'SHELL OASIS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: RTD01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'RTD01', 'RTD01', 'Rotomartillo demoledor', 'Barovo', 'Barovo', 'Disponible', id 
FROM public.obras WHERE name = 'SHELL OASIS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: RTP-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'RTP-01', 'RTP-01', 'Rotomartillo percutor', 'Barovo', 'Barovo', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: TCC-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'TCC-01', 'TCC-01', 'Tijera corta cable', '', '', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: TCC-02
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'TCC-02', 'TCC-02', 'Tijera corta cable', '', '', 'Disponible', id 
FROM public.obras WHERE name = 'COUNTRY CANTARES' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: TP-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'TP-01', 'TP-01', 'Taladro percutor', 'Total', 'Total', 'Disponible', id 
FROM public.obras WHERE name = 'DOMUS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: TP-02
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'TP-02', 'TP-02', 'Taladro chico', 'Barovo', 'Barovo', 'Disponible', id 
FROM public.obras WHERE name = 'QUALITY BARRIO NORTE' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: TRP-01
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'TRP-01', 'TRP-01', 'Taladro rotopercutor', 'Dewalt', 'Dewalt', 'Disponible', id 
FROM public.obras WHERE name = 'DOMUS' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: TRP-02
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'TRP-02', 'TRP-02', 'Taladro rotopercutor', 'Barovo', 'Barovo', 'Disponible', id 
FROM public.obras WHERE name = 'QUALITY BARRIO NORTE' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;
-- Tool: ESC-06
INSERT INTO public.herramientas (code, qr_code, name, brand, model, status, current_obra_id)
SELECT 'ESC-06', 'ESC-06', 'Escalera', 'Cant peldaños', 'Cant peldaños', 'Disponible', id 
FROM public.obras WHERE name = 'AEROPUERTO' LIMIT 1
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  current_obra_id = EXCLUDED.current_obra_id;

-- Delete any tool in DB that is not in the official excel sheet
DELETE FROM public.herramientas WHERE code NOT IN ('A-41/2-01', 'A-41/2-O2', 'A-41/2-O3', 'A-41/2-O4', 'A-7-01', 'A-7-02', 'ANC-01', 'ANC-02', 'ANC-03', 'ARN-01', 'ESC-03', 'ESC-04', 'ESC-05', 'ESC01', 'ESC02', 'GA-01', 'GA-02', 'PI-01', 'PI-02', 'RES-20-01', 'RES-22-01', 'RES-25-01', 'RTD01', 'RTP-01', 'TCC-01', 'TCC-02', 'TP-01', 'TP-02', 'TRP-01', 'TRP-02', 'ESC-06');

COMMIT;