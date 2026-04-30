-- ============================================================
-- 042_advisor_warnings.sql  (defensivo, ignora tablas inexistentes)
-- ------------------------------------------------------------
-- Resuelve los warnings del Supabase Database Advisor que quedaban
-- tras el script 041:
--
--   1) function_search_path_mutable: get_next_sequence sin search_path fijo.
--   2) rls_policy_always_true: 6 policies del 041 demasiado permisivas.
--   3) security_definer_function_executable (anon + authenticated):
--      handle_new_user expuesta vía REST.
--
-- Cambia respecto a la version anterior: cada bloque verifica si la
-- tabla / funcion existe antes de tocarla. Asi se puede ejecutar
-- aunque algunas tablas (lotes_produccion, carros, etc.) no estén
-- en este entorno.
--
-- NO arregla auth_leaked_password_protection (toggle del Dashboard).
-- ROLLBACK: scripts/042_advisor_warnings_rollback.sql
-- ============================================================

BEGIN;

-- ---------- 1) Fijar search_path de funciones SECURITY DEFINER ----------
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

-- ---------- 2) Policies _all_auth: USING(true) → USING(auth.uid() IS NOT NULL) ----------
-- Solo si la tabla existe.
DO $$
DECLARE
  t RECORD;
  tablas text[] := ARRAY['carros','empleados','lotes_produccion','procesos_catalogo','procesos_producto','tareas_produccion'];
  nombre_tabla text;
BEGIN
  FOREACH nombre_tabla IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name = nombre_tabla
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_all_auth ON public.%I', nombre_tabla, nombre_tabla);
      EXECUTE format(
        'CREATE POLICY %I_all_auth ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
        nombre_tabla, nombre_tabla
      );
    ELSE
      RAISE NOTICE 'Tabla public.% no existe, se omite.', nombre_tabla;
    END IF;
  END LOOP;
END $$;

-- ---------- 3) handle_new_user: revocar EXECUTE de anon y authenticated ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='handle_new_user'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
  ELSE
    RAISE NOTICE 'Funcion public.handle_new_user no existe, se omite.';
  END IF;
END $$;

COMMIT;
