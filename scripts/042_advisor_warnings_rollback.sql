-- ============================================================
-- 042_advisor_warnings_rollback.sql
-- ------------------------------------------------------------
-- Rollback del script 042_advisor_warnings.sql.
--   1) Quitar search_path forzado en get_next_sequence.
--   2) Restaurar las policies _all_auth a USING (true).
--   3) Devolver EXECUTE de handle_new_user a anon/authenticated.
-- ============================================================

BEGIN;

-- 1) Search path: quitarlo (vuelve al valor del rol)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS firma
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_next_sequence'
  LOOP
    EXECUTE 'ALTER FUNCTION ' || r.firma || ' RESET search_path';
  END LOOP;
END $$;

-- 2) Policies _all_auth: volver a USING (true)
DROP POLICY IF EXISTS carros_all_auth            ON public.carros;
DROP POLICY IF EXISTS empleados_all_auth         ON public.empleados;
DROP POLICY IF EXISTS lotes_produccion_all_auth  ON public.lotes_produccion;
DROP POLICY IF EXISTS procesos_catalogo_all_auth ON public.procesos_catalogo;
DROP POLICY IF EXISTS procesos_producto_all_auth ON public.procesos_producto;
DROP POLICY IF EXISTS tareas_produccion_all_auth ON public.tareas_produccion;

CREATE POLICY carros_all_auth            ON public.carros            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY empleados_all_auth         ON public.empleados         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY lotes_produccion_all_auth  ON public.lotes_produccion  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY procesos_catalogo_all_auth ON public.procesos_catalogo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY procesos_producto_all_auth ON public.procesos_producto FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY tareas_produccion_all_auth ON public.tareas_produccion FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) handle_new_user: devolver EXECUTE
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

COMMIT;
