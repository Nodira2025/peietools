-- =========================================================================
-- SEED DATA DE PRUEBA: PEIE TOOLS
-- Ejecutar este script en el SQL Editor de Supabase
-- Nota: La extensión pgcrypto se requiere para encriptar la contraseña
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  encargado_id UUID := gen_random_uuid();
  logistica_id UUID := gen_random_uuid();
  obra_id UUID := gen_random_uuid();
BEGIN

  -- 1. Crear Usuario: Encargado de obra
  INSERT INTO auth.users (
    id, 
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at, 
    role, 
    aud
  ) VALUES (
    encargado_id,
    '00000000-0000-0000-0000-000000000000',
    'encargado@peie.local',
    crypt('12345678', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Usuario Encargado","role":"encargado","whatsapp":"+543816490060"}',
    now(),
    now(),
    'authenticated',
    'authenticated'
  );

  -- 2. Crear Usuario: Logística
  INSERT INTO auth.users (
    id, 
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at, 
    role, 
    aud
  ) VALUES (
    logistica_id,
    '00000000-0000-0000-0000-000000000000',
    'logistica@peie.local',
    crypt('12345678', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Usuario Logística","role":"logistica","whatsapp":"+543815158212"}',
    now(),
    now(),
    'authenticated',
    'authenticated'
  );

  -- 3. Crear Obra de Prueba
  INSERT INTO obras (id, code, name, address, active)
  VALUES (
    obra_id,
    'OBRA-001',
    'Obra Central',
    'Santiago del Estero, Argentina',
    true
  );

  -- 4. Crear Herramienta de Prueba asignada a la Obra
  INSERT INTO herramientas (
    code, 
    name, 
    brand, 
    model, 
    status, 
    current_obra_id
  ) VALUES (
    'TAL-001',
    'Taladro Bosch',
    'Bosch',
    'GSB 13 RE',
    'Disponible',
    obra_id
  );

END $$;
