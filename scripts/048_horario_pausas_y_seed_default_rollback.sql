-- ============================================================
-- 048 ROLLBACK
-- Quita la columna pausas. NO borra los horarios sembrados.
-- ============================================================
BEGIN;
ALTER TABLE public.horarios_operario DROP COLUMN IF EXISTS pausas;
COMMIT;
