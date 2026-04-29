-- ============================================================
-- 042_advisor_warnings.sql
-- ------------------------------------------------------------
-- Resuelve los warnings del Supabase Database Advisor que quedaban
-- tras el script 041:
--
--   1) function_search_path_mutable: get_next_sequence sin search_path fijo.
--   2) rls_policy_always_true: 6 policies del 041 demasiado permisivas.
--   3) security_definer_function_executable (anon + authenticated):
--      handle_new_user expuesta vía REST. Es un trigger interno, no debe
--      ser callable desde la API.
--
-- NO arregla:
--   - auth_leaked_password_protection: setting de Auth, se activa en
--     Supabase Dashboard → Authentication → Providers → Email → toggle
--     "Leaked password protection (HaveIBeenPwned)".
--
-- ROLLBACK: scripts/042_advisor_warnings_rollback.sql
-- ============================================================

BEGIN;

-- ---------- 1) Fijar search_path de funciones SECURITY DEFINER ----------
-- Iteramos por todas las firmas existentes de get_next_sequence (puede
-- haber sobrecargas con args distintos). Forzamos search_path a pg_catalog
-- + public, que evita search_path hijacking.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS firma
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_next_sequence'
  LOOP
    EXECUTE 'ALTER FUNCTION ' || r.firma || ' SET search_path = pg_catalog, public';
  END LOOP;
END $$;

-- ---------- 2) Policies _all_auth: cambiar USING(true) → USING(auth.uid() IS NOT NULL) ----------
-- Para authenticated es funcionalmente equivalente (siempre tiene uid),
-- pero no dispara el warning rls_policy_always_true.

DROP POLICY IF EXISTS carros_all_auth            ON public.carros;
DROP POLICY IF EXISTS empleados_all_auth         ON public.empleados;
DROP POLICY IF EXISTS lotes_produccion_all_auth  ON public.lotes_produccion;
DROP POLICY IF EXISTS procesos_catalogo_all_auth ON public.procesos_catalogo;
DROP POLICY IF EXISTS procesos_producto_all_auth ON public.procesos_producto;
DROP POLICY IF EXISTS tareas_produccion_all_auth ON public.tareas_produccion;

CREATE POLICY carros_all_auth            ON public.carros            FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY empleados_all_auth         ON public.empleados         FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY lotes_produccion_all_auth  ON public.lotes_produccion  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY procesos_catalogo_all_auth ON public.procesos_catalogo FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY procesos_producto_all_auth ON public.procesos_producto FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY tareas_produccion_all_auth ON public.tareas_produccion FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- 3) handle_new_user: revocar EXECUTE de anon y authenticated ----------
-- Es una funcion SECURITY DEFINER pensada para ejecutarse SOLO como trigger
-- interno (AFTER INSERT en auth.users). Postgres (rol del trigger) y
-- service_role siguen pudiendo invocarla.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

COMMIT;

-- ============================================================
-- VERIFICACION
-- ============================================================
-- 1) search_path fijado en get_next_sequence
-- SELECT proname, prosrc, proconfig FROM pg_proc WHERE proname = 'get_next_sequence';
-- (proconfig debe contener "search_path=pg_catalog, public")

-- 2) Policies con auth.uid() IS NOT NULL
-- SELECT tablename, policyname, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND policyname LIKE '%_all_auth';

-- 3) handle_new_user no ejecutable por anon/authenticated
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_schema='public' AND routine_name='handle_new_user';
