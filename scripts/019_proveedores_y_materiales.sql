-- =====================================================================
-- 019_proveedores_y_materiales.sql
-- R1 del rediseño ERP TURIVAL — paso 2/5
-- =====================================================================
-- QUÉ HACE:
--   1. Crea tabla proveedores con 8 proveedores placeholder (3 lacado +
--      3 fondo + 1 catalizador + 1 disolvente). Mario los renombrará
--      después en /configuracion/proveedores.
--   2. Crea tabla materiales (tipos: lacado, fondo, catalizador, disolvente).
--   3. Migra los 272 colores existentes a materiales con tipo='lacado',
--      asignándoles "Proveedor Lacado 1" como placeholder.
--   4. Añade placeholders de 1 fondo, 1 catalizador y 1 disolvente para
--      que el sistema pueda arrancar.
--   5. Renombra tabla colores → colores_legacy (se borra en R7 tras
--      verificar que nada del backend la usa ya).
--
-- ROLLBACK (desastre):
--   ALTER TABLE colores_legacy RENAME TO colores;
--   DROP TABLE IF EXISTS materiales CASCADE;
--   DROP TABLE IF EXISTS proveedores CASCADE;
-- =====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. TABLA proveedores
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               text NOT NULL,
  tipo_material        text NOT NULL
                       CHECK (tipo_material IN ('lacado','fondo','catalizador','disolvente')),
  precio_base_kg       numeric NOT NULL DEFAULT 0,
  telefono             text,
  email                text,
  notas                text,
  activo               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_tipo   ON proveedores(tipo_material);
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proveedores_all" ON proveedores;
CREATE POLICY "proveedores_all" ON proveedores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seeds placeholder (renombrar en /configuracion/proveedores)
INSERT INTO proveedores (nombre, tipo_material, precio_base_kg, notas)
VALUES
  ('Proveedor Lacado 1',      'lacado',      0, 'Renombrar con datos reales'),
  ('Proveedor Lacado 2',      'lacado',      0, 'Renombrar'),
  ('Proveedor Lacado 3',      'lacado',      0, 'Renombrar'),
  ('Proveedor Fondo 1',       'fondo',       0, 'Renombrar'),
  ('Proveedor Fondo 2',       'fondo',       0, 'Renombrar'),
  ('Proveedor Fondo 3',       'fondo',       0, 'Renombrar'),
  ('Proveedor Catalizador 1', 'catalizador', 0, 'Renombrar'),
  ('Proveedor Disolvente 1',  'disolvente',  0, 'Renombrar');

-- --------------------------------------------------------------------
-- 2. TABLA materiales
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materiales (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                           text NOT NULL
                                 CHECK (tipo IN ('lacado','fondo','catalizador','disolvente')),

  -- Identificación
  codigo                         text,          -- RAL 9010, NCS S0500-N, etc.
  nombre                         text NOT NULL,
  familia                        text,          -- 'RAL','NCS','referencia_interna','muestra_cliente','generico'
  hex_aproximado                 text,          -- solo para lacados y fondos con color visual

  -- Proveedor y precio
  proveedor_id                   uuid REFERENCES proveedores(id) ON DELETE RESTRICT,
  precio_kg_sobrescrito          numeric,       -- NULL = usa proveedor.precio_base_kg
  formato_compra_kg              numeric,       -- 5, 10, 25. Informativo.

  -- Rendimiento
  rendimiento_kg_m2_sobrescrito  numeric,       -- NULL = usa configuracion_empresa según tipo

  -- Stock (en kg con decimales)
  stock_fisico_kg                numeric NOT NULL DEFAULT 0,
  stock_reservado_kg             numeric NOT NULL DEFAULT 0,
  stock_minimo_kg                numeric NOT NULL DEFAULT 0,

  -- Metadata
  observaciones                  text,
  activo                         boolean NOT NULL DEFAULT true,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),

  UNIQUE(tipo, codigo)
);

CREATE INDEX IF NOT EXISTS idx_materiales_tipo          ON materiales(tipo);
CREATE INDEX IF NOT EXISTS idx_materiales_proveedor     ON materiales(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_materiales_activo        ON materiales(activo);
CREATE INDEX IF NOT EXISTS idx_materiales_stock_minimo
  ON materiales(stock_fisico_kg, stock_minimo_kg);

ALTER TABLE materiales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "materiales_all" ON materiales;
CREATE POLICY "materiales_all" ON materiales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- 3. MIGRACIÓN: colores → materiales
--    Usamos INSERT ... SELECT directo con subconsulta inline para el
--    proveedor_id. Evitamos DO $$ DECLARE por bug A.
-- --------------------------------------------------------------------
INSERT INTO materiales (
  tipo, codigo, nombre, familia, hex_aproximado,
  proveedor_id, precio_kg_sobrescrito, formato_compra_kg,
  rendimiento_kg_m2_sobrescrito,
  stock_fisico_kg, stock_reservado_kg, stock_minimo_kg,
  observaciones, activo, created_at
)
SELECT
  'lacado'                                                                 AS tipo,
  c.codigo                                                                 AS codigo,
  c.nombre                                                                 AS nombre,
  c.tipo                                                                   AS familia,
  c.hex_aproximado                                                         AS hex_aproximado,
  (SELECT id FROM proveedores WHERE tipo_material='lacado'
     AND nombre='Proveedor Lacado 1' LIMIT 1)                              AS proveedor_id,
  NULL                                                                     AS precio_kg_sobrescrito,
  NULL                                                                     AS formato_compra_kg,
  NULL                                                                     AS rendimiento_kg_m2_sobrescrito,
  0, 0, 0,
  c.observaciones                                                          AS observaciones,
  c.activo                                                                 AS activo,
  c.created_at                                                             AS created_at
FROM colores c
ON CONFLICT (tipo, codigo) DO NOTHING;

-- --------------------------------------------------------------------
-- 4. Placeholders mínimos para fondo, catalizador y disolvente
-- --------------------------------------------------------------------
INSERT INTO materiales (tipo, codigo, nombre, familia, proveedor_id, observaciones, activo)
SELECT 'fondo', 'FONDO-BLANCO', 'Fondo blanco genérico', 'generico',
       (SELECT id FROM proveedores WHERE tipo_material='fondo' AND nombre='Proveedor Fondo 1' LIMIT 1),
       'Placeholder inicial. Añade tus fondos reales desde /materiales.', true
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE tipo='fondo' AND codigo='FONDO-BLANCO');

INSERT INTO materiales (tipo, codigo, nombre, familia, proveedor_id, observaciones, activo)
SELECT 'catalizador', 'CATA-DEFAULT', 'Catalizador por defecto', 'generico',
       (SELECT id FROM proveedores WHERE tipo_material='catalizador' LIMIT 1),
       'Placeholder. Reemplazar por el catalizador real desde /materiales.', true
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE tipo='catalizador' AND codigo='CATA-DEFAULT');

INSERT INTO materiales (tipo, codigo, nombre, familia, proveedor_id, observaciones, activo)
SELECT 'disolvente', 'DIS-DEFAULT', 'Disolvente por defecto', 'generico',
       (SELECT id FROM proveedores WHERE tipo_material='disolvente' LIMIT 1),
       'Placeholder. Reemplazar por el disolvente real desde /materiales.', true
WHERE NOT EXISTS (SELECT 1 FROM materiales WHERE tipo='disolvente' AND codigo='DIS-DEFAULT');

-- --------------------------------------------------------------------
-- 5. Renombrar tabla `colores` → `colores_legacy`
--    Se mantiene como red de seguridad. Se borra en R7 cuando el
--    backend ya no la referencie.
-- --------------------------------------------------------------------
ALTER TABLE IF EXISTS colores RENAME TO colores_legacy;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- SELECT tipo_material, COUNT(*) FROM proveedores GROUP BY tipo_material;
-- Debe mostrar: lacado=3, fondo=3, catalizador=1, disolvente=1.
--
-- SELECT tipo, COUNT(*) FROM materiales GROUP BY tipo ORDER BY tipo;
-- Debe mostrar: catalizador=1, disolvente=1, fondo=1, lacado≈272.
--
-- SELECT codigo, nombre, familia FROM materiales
--   WHERE tipo='lacado' LIMIT 5;
-- Debe mostrar los primeros lacados migrados (RAL, NCS, etc.).
--
-- SELECT to_regclass('colores_legacy');        -- Debe devolver 'colores_legacy'.
-- SELECT to_regclass('colores');               -- Debe devolver NULL (ya no existe).
-- =====================================================================
