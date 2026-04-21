-- =====================================================================
-- 021_stock_y_movimientos.sql
-- R1 del rediseño ERP TURIVAL — paso 4/5
-- =====================================================================
-- QUÉ HACE:
--   1. Tabla reservas_stock: compromisos de material al confirmar pedido.
--   2. Tabla movimientos_stock: auditoría inmutable de cada movimiento
--      (entradas de compra, consumos de producción, ajustes, mermas,
--      reservas y liberaciones).
--
--   NOTA IMPORTANTE: las funciones que RESERVAN, CONSUMEN, AJUSTAN o
--   dan ENTRADA se implementan en el BACKEND TS (R2), no como PL/pgSQL.
--   Motivo: regla 9 del proyecto + bug A (SQL Editor rompe PL/pgSQL
--   con DECLARE). El backend hará transacciones lógicas mediante
--   llamadas encadenadas con rollback manual si una falla.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS movimientos_stock CASCADE;
--   DROP TABLE IF EXISTS reservas_stock CASCADE;
-- =====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. TABLA reservas_stock
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas_stock (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id                uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  material_id              uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
  cantidad_reservada_kg    numeric NOT NULL CHECK (cantidad_reservada_kg > 0),
  estado                   text NOT NULL DEFAULT 'activa'
                           CHECK (estado IN ('activa','consumida','liberada')),
  fecha_reserva            timestamptz NOT NULL DEFAULT now(),
  fecha_cierre             timestamptz,
  observaciones            text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservas_pedido    ON reservas_stock(pedido_id);
CREATE INDEX IF NOT EXISTS idx_reservas_material  ON reservas_stock(material_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado    ON reservas_stock(estado);
CREATE INDEX IF NOT EXISTS idx_reservas_activas
  ON reservas_stock(material_id, estado) WHERE estado = 'activa';

ALTER TABLE reservas_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reservas_stock_all" ON reservas_stock;
CREATE POLICY "reservas_stock_all" ON reservas_stock
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE reservas_stock IS
  'Compromisos de material al confirmar un pedido. Se crean con estado activa, cambian a consumida cuando se completa la tarea de producción, o a liberada si el pedido se cancela.';

-- --------------------------------------------------------------------
-- 2. TABLA movimientos_stock (auditoría inmutable)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha                    timestamptz NOT NULL DEFAULT now(),
  material_id              uuid NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,

  -- Tipo de movimiento
  tipo                     text NOT NULL
                           CHECK (tipo IN (
                             'entrada',              -- compra recibida
                             'consumo',              -- producción real
                             'ajuste',               -- ajuste manual +/-
                             'merma',                -- pérdida imputada
                             'reserva',              -- compromiso al confirmar pedido
                             'liberacion_reserva'    -- cancelación o sobrante al completar
                           )),

  -- Cantidad (signed: + entrada, - consumo)
  cantidad_kg              numeric NOT NULL,

  -- Origen del movimiento (uno de estos suele estar relleno)
  pedido_id                uuid REFERENCES pedidos(id)            ON DELETE SET NULL,
  pieza_id                 uuid REFERENCES piezas(id)             ON DELETE SET NULL,
  tarea_produccion_id      uuid REFERENCES tareas_produccion(id)  ON DELETE SET NULL,
  reserva_id               uuid REFERENCES reservas_stock(id)     ON DELETE SET NULL,
  operario_id              uuid REFERENCES operarios(id)          ON DELETE SET NULL,

  -- Snapshot de stock antes y después (para reconstrucción y auditoría)
  stock_antes_kg           numeric NOT NULL,
  stock_despues_kg         numeric NOT NULL,

  motivo                   text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mov_stock_material  ON movimientos_stock(material_id);
CREATE INDEX IF NOT EXISTS idx_mov_stock_tipo      ON movimientos_stock(tipo);
CREATE INDEX IF NOT EXISTS idx_mov_stock_fecha     ON movimientos_stock(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mov_stock_pedido    ON movimientos_stock(pedido_id);
CREATE INDEX IF NOT EXISTS idx_mov_stock_pieza     ON movimientos_stock(pieza_id);
CREATE INDEX IF NOT EXISTS idx_mov_stock_tarea     ON movimientos_stock(tarea_produccion_id);

ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movimientos_stock_all" ON movimientos_stock;
CREATE POLICY "movimientos_stock_all" ON movimientos_stock
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE movimientos_stock IS
  'Histórico inmutable de todos los movimientos de stock. Cada fila debe enlazar a pedido/pieza/tarea/reserva cuando aplique. Los ajustes manuales por inventario se registran con tipo=ajuste y motivo=texto libre.';

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- SELECT to_regclass('reservas_stock');         -- Debe devolver 'reservas_stock'.
-- SELECT to_regclass('movimientos_stock');      -- Debe devolver 'movimientos_stock'.
-- SELECT COUNT(*) FROM reservas_stock;          -- Debe ser 0.
-- SELECT COUNT(*) FROM movimientos_stock;       -- Debe ser 0.
-- =====================================================================
