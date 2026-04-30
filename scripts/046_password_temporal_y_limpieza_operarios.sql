-- ============================================================
-- 046_password_temporal_y_limpieza_operarios.sql
-- ------------------------------------------------------------
-- 1) Añade columna `password_temporal` a usuario_perfiles para
--    forzar el cambio de contraseña al primer login (al crear
--    un user con pass por defecto "1234" o tras un reset por admin).
-- 2) Limpia operarios huérfanos: filas en `operarios` sin user_id
--    asociado a auth.users (los seeds antiguos Juan/Julio/Paco que
--    no se ligaron a ninguna cuenta).
--
-- ROLLBACK: scripts/046_password_temporal_y_limpieza_operarios_rollback.sql
-- ============================================================

BEGIN;

-- ---------- 1) Columna password_temporal ----------
ALTER TABLE public.usuario_perfiles
  ADD COLUMN IF NOT EXISTS password_temporal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.usuario_perfiles.password_temporal IS
  'true cuando el admin acaba de crear/resetear la contraseña. El proximo login fuerza al usuario a cambiarla antes de entrar al CRM.';

-- ---------- 2) Limpieza de operarios huerfanos ----------
-- Solo borramos los que NO tienen user_id (no ligados a auth.users).
-- Los huerfanos producian la incongruencia entre el panel "Usuarios y
-- roles" (lista los de auth) y el panel "Operarios" (lista los de la
-- tabla operarios).

-- Antes de borrar: quitamos cualquier asignación de especialidades
-- (FK CASCADE ya lo hace, pero es explicito).
DELETE FROM public.operario_especialidades
WHERE operario_id IN (SELECT id FROM public.operarios WHERE user_id IS NULL);

-- Quitamos sus apariciones en operarios_tareas_candidatos si existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='operarios_tareas_candidatos') THEN
    DELETE FROM public.operarios_tareas_candidatos
    WHERE operario_id IN (SELECT id FROM public.operarios WHERE user_id IS NULL);
  END IF;
END $$;

-- Borrar operarios sin user_id
DELETE FROM public.operarios WHERE user_id IS NULL;

COMMIT;

-- ============================================================
-- VERIFICACION
-- ============================================================
-- SELECT count(*) AS operarios_total FROM public.operarios;
-- SELECT email, password_temporal FROM public.usuario_perfiles;
