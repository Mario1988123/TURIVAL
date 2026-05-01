-- ============================================================
-- 047_clientes_policies_simples.sql
-- ------------------------------------------------------------
-- Las policies clientes_*_own que vienen del 002 antiguo asumen
-- multi-tenant (cada user solo ve/edita sus propios clientes via
-- auth.uid() = user_id). En Turiaval mono-empresa, Mario y Pablo
-- (los dos admins) deben poder ver y editar TODOS los clientes,
-- independientemente de quien los haya creado.
--
-- Este script reemplaza las policies _own por simples
-- "authenticated puede todo". Sin esto, si un admin intenta editar
-- un cliente creado por otro admin, falla por RLS.
--
-- ROLLBACK: scripts/047_clientes_policies_simples_rollback.sql
-- ============================================================

BEGIN;

-- Borrar policies viejas (incluidas las que crea el 002 con nombre
-- distinto y las _own que aparecieron en el advisor)
DROP POLICY IF EXISTS clientes_select        ON public.clientes;
DROP POLICY IF EXISTS clientes_select_all    ON public.clientes;
DROP POLICY IF EXISTS clientes_select_own    ON public.clientes;
DROP POLICY IF EXISTS clientes_insert        ON public.clientes;
DROP POLICY IF EXISTS clientes_insert_own    ON public.clientes;
DROP POLICY IF EXISTS clientes_insert_auth   ON public.clientes;
DROP POLICY IF EXISTS clientes_update        ON public.clientes;
DROP POLICY IF EXISTS clientes_update_own    ON public.clientes;
DROP POLICY IF EXISTS clientes_update_auth   ON public.clientes;
DROP POLICY IF EXISTS clientes_delete        ON public.clientes;
DROP POLICY IF EXISTS clientes_delete_own    ON public.clientes;
DROP POLICY IF EXISTS clientes_delete_auth   ON public.clientes;
DROP POLICY IF EXISTS clientes_public_read   ON public.clientes;

-- Asegurar RLS activada
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Crear policies nuevas simples para mono-empresa
CREATE POLICY clientes_select_auth ON public.clientes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY clientes_insert_auth ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY clientes_update_auth ON public.clientes
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY clientes_delete_auth ON public.clientes
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

COMMIT;

-- ============================================================
-- VERIFICACION
-- ============================================================
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname='public' AND tablename='clientes';
-- Debe mostrar las 4 nuevas: clientes_*_auth.
