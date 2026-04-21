-- =====================================================================
-- 023_ampliar_check_modo_precio.sql
-- R5 del rediseño ERP TURIVAL — REQUISITO PREVIO al presupuestador v2
-- =====================================================================
-- QUÉ HACE:
--   Amplía el CHECK de modo_precio en lineas_presupuesto y lineas_pedido
--   para admitir 'ml' (metro lineal) y 'manual' (línea irregular sin motor).
--
--   Antes: modo_precio IN ('m2', 'pieza')
--   Ahora: modo_precio IN ('m2', 'pieza', 'ml', 'manual')
--
-- ROLLBACK:
--   ALTER TABLE lineas_presupuesto DROP CONSTRAINT lineas_presupuesto_modo_precio_check;
--   ALTER TABLE lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_modo_precio_check
--     CHECK (modo_precio IN ('m2', 'pieza'));
--   (y lo mismo con lineas_pedido)
-- =====================================================================

BEGIN;

-- lineas_presupuesto
ALTER TABLE lineas_presupuesto
  DROP CONSTRAINT IF EXISTS lineas_presupuesto_modo_precio_check;

ALTER TABLE lineas_presupuesto
  ADD CONSTRAINT lineas_presupuesto_modo_precio_check
  CHECK (modo_precio IN ('m2', 'pieza', 'ml', 'manual'));

-- lineas_pedido
ALTER TABLE lineas_pedido
  DROP CONSTRAINT IF EXISTS lineas_pedido_modo_precio_check;

ALTER TABLE lineas_pedido
  ADD CONSTRAINT lineas_pedido_modo_precio_check
  CHECK (modo_precio IN ('m2', 'pieza', 'ml', 'manual'));

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname LIKE '%modo_precio_check%';
-- Debe mostrar los dos CHECKs con los 4 valores permitidos.
-- =====================================================================
