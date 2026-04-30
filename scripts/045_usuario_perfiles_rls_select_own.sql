-- ============================================================
-- 045_usuario_perfiles_rls_select_own.sql
-- ------------------------------------------------------------
-- Bug: tras el 041 (RLS habilitada en todas las tablas), la tabla
-- usuario_perfiles quedó sin policies. El cliente authenticated del
-- AppLayout no puede leer su propia fila → la cascada cae a 'operario'
-- y todos los admins aparecen como operarios.
--
-- Fix: añadir policy de SELECT que permita a cada user leer su
-- propia fila. El listado completo (admin) sigue yendo por la RPC
-- listar_perfiles_admin (SECURITY DEFINER, no afectada por RLS).
-- Las operaciones de escritura van por service_role (admin client),
-- asi que no necesitan policies abiertas.
--
-- ROLLBACK: scripts/045_usuario_perfiles_rls_select_own_rollback.sql
-- ============================================================

BEGIN;

-- Asegurar RLS habilitada (puede haberse quedado sin tras runs parciales)
ALTER TABLE public.usuario_perfiles ENABLE ROW LEVEL SECURITY;

-- Policy: cada usuario puede leer SU propia fila
DROP POLICY IF EXISTS usuario_perfiles_select_own ON public.usuario_perfiles;
CREATE POLICY usuario_perfiles_select_own
  ON public.usuario_perfiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: cada usuario puede actualizar SU propia fila (nombre, etc.)
-- pero NO puede cambiarse a sí mismo el rol ni los modulos (eso solo
-- via RPC asignar_rol_usuario que hace check de admin).
DROP POLICY IF EXISTS usuario_perfiles_update_own ON public.usuario_perfiles;
CREATE POLICY usuario_perfiles_update_own
  ON public.usuario_perfiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;

-- ============================================================
-- VERIFICACION
-- ============================================================
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND tablename='usuario_perfiles';
