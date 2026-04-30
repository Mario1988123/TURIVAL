-- ============================================================
-- 046 ROLLBACK
-- - Quita la columna password_temporal.
-- - NO restaura los operarios borrados (rollback parcial).
-- ============================================================
BEGIN;
ALTER TABLE public.usuario_perfiles DROP COLUMN IF EXISTS password_temporal;
COMMIT;
