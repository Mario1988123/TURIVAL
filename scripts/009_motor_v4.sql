-- =====================================================================
-- 009 — MOTOR DE CÁLCULO v4: soporte metro lineal + tipos de pieza
-- =====================================================================
-- Añade al esquema:
--   · tarifas.precio_metro_lineal + tiempo_estimado_metro_lineal
--   · tarifas.modo_precio acepta ahora 'metro_lineal' y 'todos'
--   · lineas_presupuesto.tipo_pieza (tablero/frente/moldura/irregular)
--   · lineas_presupuesto.longitud_ml (para molduras)
--   · lineas_presupuesto.modo_precio acepta 'metro_lineal'
-- Idempotente. Se puede ejecutar múltiples veces sin romper datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TARIFAS: añadir campos metro lineal
-- ---------------------------------------------------------------------
ALTER TABLE tarifas 
  ADD COLUMN IF NOT EXISTS precio_metro_lineal NUMERIC;

ALTER TABLE tarifas 
  ADD COLUMN IF NOT EXISTS tiempo_estimado_metro_lineal NUMERIC;


-- ---------------------------------------------------------------------
-- 2. TARIFAS: ampliar check de modo_precio
-- ---------------------------------------------------------------------
-- Si el check anterior solo aceptaba 'm2' | 'pieza' | 'ambos',
-- lo eliminamos y creamos uno nuevo con los 5 valores posibles.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tarifas_modo_precio_check' 
      AND table_name = 'tarifas'
  ) THEN
    ALTER TABLE tarifas DROP CONSTRAINT tarifas_modo_precio_check;
  END IF;
END $$;

ALTER TABLE tarifas 
  ADD CONSTRAINT tarifas_modo_precio_check 
  CHECK (modo_precio IN ('m2', 'pieza', 'metro_lineal', 'ambos', 'todos'));


-- ---------------------------------------------------------------------
-- 3. LINEAS_PRESUPUESTO: tipo_pieza
-- ---------------------------------------------------------------------
ALTER TABLE lineas_presupuesto 
  ADD COLUMN IF NOT EXISTS tipo_pieza TEXT 
    CHECK (tipo_pieza IN ('tablero', 'frente', 'moldura', 'irregular'));


-- ---------------------------------------------------------------------
-- 4. LINEAS_PRESUPUESTO: longitud_ml (para molduras)
-- ---------------------------------------------------------------------
ALTER TABLE lineas_presupuesto 
  ADD COLUMN IF NOT EXISTS longitud_ml NUMERIC;


-- ---------------------------------------------------------------------
-- 5. LINEAS_PRESUPUESTO: ampliar modo_precio
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lineas_presupuesto_modo_precio_check' 
      AND table_name = 'lineas_presupuesto'
  ) THEN
    ALTER TABLE lineas_presupuesto DROP CONSTRAINT lineas_presupuesto_modo_precio_check;
  END IF;
END $$;

ALTER TABLE lineas_presupuesto 
  ADD CONSTRAINT lineas_presupuesto_modo_precio_check 
  CHECK (modo_precio IN ('m2', 'pieza', 'metro_lineal'));


-- ---------------------------------------------------------------------
-- 6. Índices para mejorar rendimiento en listados
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lineas_presupuesto_tipo_pieza 
  ON lineas_presupuesto(tipo_pieza);

CREATE INDEX IF NOT EXISTS idx_tarifas_modo_precio 
  ON tarifas(modo_precio);
