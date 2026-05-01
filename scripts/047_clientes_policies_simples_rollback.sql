-- ============================================================
-- 047 ROLLBACK
-- Restaura las policies clientes_*_own (multi-tenant) que estaban
-- antes del 047. Solo si quieres volver a un esquema donde cada
-- user solo ve/edita sus propios clientes.
-- ============================================================
BEGIN;

DROP POLICY IF EXISTS clientes_select_auth ON public.clientes;
DROP POLICY IF EXISTS clientes_insert_auth ON public.clientes;
DROP POLICY IF EXISTS clientes_update_auth ON public.clientes;
DROP POLICY IF EXISTS clientes_delete_auth ON public.clientes;

CREATE POLICY clientes_select_all ON public.clientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY clientes_insert_own ON public.clientes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY clientes_update_own ON public.clientes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY clientes_delete_own ON public.clientes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
