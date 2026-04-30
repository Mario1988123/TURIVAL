-- ============================================================
-- 045 ROLLBACK: borra las policies SELECT/UPDATE creadas en el 045.
-- NO desactiva RLS (eso lo hace el rollback del 041).
-- ============================================================
BEGIN;
DROP POLICY IF EXISTS usuario_perfiles_select_own ON public.usuario_perfiles;
DROP POLICY IF EXISTS usuario_perfiles_update_own ON public.usuario_perfiles;
COMMIT;
