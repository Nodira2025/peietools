-- ====================================================================
-- RE-ESTABLECER CONTRASEÑA DEL USUARIO MARTIN EN SUPABASE
-- ====================================================================

-- 1. Actualizar la contraseña a "martin123" para martin@peie.com
UPDATE auth.users
SET encrypted_password = crypt('martin123', gen_salt('bf')),
    updated_at = now()
WHERE email = 'martin@peie.com' OR email LIKE 'martin%';

-- 2. Asegurar que la cuenta esté activa en la tabla de perfiles
UPDATE public.profiles
SET active = true
WHERE username = 'martin' OR email = 'martin@peie.com';
