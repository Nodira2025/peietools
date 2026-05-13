-- =========================================================================
-- PEIE TOOLS - CORRECCIÓN DE PERMISOS DE AUTENTICACIÓN
-- =========================================================================
-- El error "Database error querying schema" viene del servicio GoTrue
-- (autenticación) que necesita permisos especiales para consultar el
-- esquema public, específicamente la tabla profiles y el trigger.
-- =========================================================================

-- 1. Permisos para el rol de autenticación de Supabase
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO supabase_auth_admin;

-- 2. Permisos para el rol authenticator (proxy de GoTrue)
GRANT USAGE ON SCHEMA public TO authenticator;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticator;

-- 3. Permisos para postgres (owner)
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- 4. Permisos para el dashboard de Supabase
GRANT USAGE ON SCHEMA public TO dashboard_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO dashboard_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO dashboard_user;

-- 5. Permisos para supabase_admin
GRANT ALL ON SCHEMA public TO supabase_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO supabase_admin;

-- 6. Asegurar que anon y authenticated tienen USAGE del schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 7. Verificar que las funciones de trigger están accesibles
-- El trigger handle_new_user() corre como SECURITY DEFINER, pero
-- necesita que el schema sea accesible
ALTER FUNCTION public.handle_new_user() OWNER TO supabase_admin;

-- 8. Defaults para futuras tablas/funciones
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, supabase_auth_admin;

-- 9. Asegurar ownership del schema
ALTER SCHEMA public OWNER TO postgres;
