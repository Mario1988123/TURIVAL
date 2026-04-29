-- ============================================================
-- 043_especialidades_operario_rollback.sql
-- ------------------------------------------------------------
-- Rollback del script 043. Borra ambas tablas (perdiendo datos
-- de especialidades asignadas).
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS public.operario_especialidades;
DROP TABLE IF EXISTS public.especialidades;

COMMIT;
