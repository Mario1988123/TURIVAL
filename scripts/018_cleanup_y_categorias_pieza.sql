-- =====================================================================
-- 018_cleanup_y_categorias_pieza.sql
-- R1 del rediseño ERP TURIVAL — paso 1/5
-- =====================================================================
-- QUÉ HACE:
--   1. Borra todos los datos ficticios preparando el rediseño.
--      Conserva: clientes, colores, tratamientos, procesos_catalogo,
--      niveles_complejidad, configuracion_empresa, ubicaciones,
--      operarios, secuencias.
--   2. Crea tabla categorias_pieza con las 6 categorías base
--      (Zócalos, Puertas, Mueble cocina, Mobiliario, Listones, Irregular).
--
-- ROLLBACK:
--   Los datos borrados no tienen rollback (eran ficticios). Hacer snapshot
--   Supabase antes si quieres seguridad extra.
--   Categorías: DROP TABLE IF EXISTS categorias_pieza CASCADE;
-- =====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. BORRADO DE DATOS FICTICIOS (orden respetando dependencias FK)
-- --------------------------------------------------------------------
TRUNCATE TABLE historial_tiempos_proceso CASCADE;
TRUNCATE TABLE tareas_produccion         CASCADE;
TRUNCATE TABLE movimientos_pieza         CASCADE;
TRUNCATE TABLE piezas                    CASCADE;
TRUNCATE TABLE lineas_pedido             CASCADE;
TRUNCATE TABLE pedidos                   CASCADE;
TRUNCATE TABLE lineas_presupuesto        CASCADE;
TRUNCATE TABLE presupuestos              CASCADE;
TRUNCATE TABLE procesos_producto         CASCADE;
TRUNCATE TABLE referencias_cliente       CASCADE;
TRUNCATE TABLE productos                 CASCADE;

-- Reiniciar secuencias (para que los próximos documentos arranquen en 0001)
UPDATE secuencias SET ultimo_numero = 0;

-- --------------------------------------------------------------------
-- 2. TABLA categorias_pieza
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_pieza (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                        text NOT NULL UNIQUE,
  nombre                        text NOT NULL,
  descripcion                   text,
  orden                         integer NOT NULL DEFAULT 0,
  color                         text DEFAULT '#64748b',

  -- Comportamiento por defecto del motor de superficie
  caras_default                 integer NOT NULL DEFAULT 6
                                CHECK (caras_default IN (1, 2, 4, 6)),
  contabilizar_grosor_default   boolean NOT NULL DEFAULT false,
  modo_precio_default           text NOT NULL DEFAULT 'm2'
                                CHECK (modo_precio_default IN ('m2','pieza','ml','manual')),
  permite_ml                    boolean NOT NULL DEFAULT false,

  -- Procesos por defecto que aplica esta categoría
  -- Array JSON de objetos: [{"proceso_codigo":"LIJADO","orden":1}, ...]
  procesos_default              jsonb NOT NULL DEFAULT '[]'::jsonb,

  activo                        boolean NOT NULL DEFAULT true,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorias_pieza_orden  ON categorias_pieza(orden);
CREATE INDEX IF NOT EXISTS idx_categorias_pieza_activo ON categorias_pieza(activo);

ALTER TABLE categorias_pieza ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categorias_pieza_all" ON categorias_pieza;
CREATE POLICY "categorias_pieza_all" ON categorias_pieza
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- 3. SEED: 6 categorías base
-- --------------------------------------------------------------------
INSERT INTO categorias_pieza
  (codigo, nombre, descripcion, orden, color,
   caras_default, contabilizar_grosor_default, modo_precio_default, permite_ml,
   procesos_default)
VALUES
  ('ZOCALO', 'Zócalos',
   'Zócalos y rodapiés. Por defecto se tarifica por metro lineal y se pinta solo la cara frontal (no se contabiliza el borde porque queda pintado al pasar la pistola).',
   1, '#8b5cf6',
   1, false, 'ml', true,
   '[{"proceso_codigo":"LIJADO","orden":1},{"proceso_codigo":"FONDO","orden":2},{"proceso_codigo":"LACADO","orden":3}]'::jsonb),

  ('PUERTA', 'Puertas',
   'Puertas de paso, abatibles o de armario. 2 caras sin grosor. Doble fondeado (típico para acabado fino).',
   2, '#3b82f6',
   2, false, 'm2', false,
   '[{"proceso_codigo":"LIJADO","orden":1},{"proceso_codigo":"FONDO","orden":2},{"proceso_codigo":"LIJADO_2","orden":3},{"proceso_codigo":"FONDEADO_2","orden":4},{"proceso_codigo":"LACADO","orden":5}]'::jsonb),

  ('MUEBLE_COCINA', 'Mueble cocina',
   'Frentes, puertas y cajones de mueble de cocina. 2 caras sin grosor (el borde se pinta de paso al pintar la frontal).',
   3, '#10b981',
   2, false, 'm2', false,
   '[{"proceso_codigo":"LIJADO","orden":1},{"proceso_codigo":"FONDO","orden":2},{"proceso_codigo":"LIJADO_2","orden":3},{"proceso_codigo":"FONDEADO_2","orden":4},{"proceso_codigo":"LACADO","orden":5}]'::jsonb),

  ('MOBILIARIO', 'Mobiliario',
   'Tableros, cuerpos, cajones, mobiliario en general. Todas las caras + grosor.',
   4, '#f59e0b',
   6, true, 'm2', false,
   '[{"proceso_codigo":"LIJADO","orden":1},{"proceso_codigo":"FONDO","orden":2},{"proceso_codigo":"LACADO","orden":3}]'::jsonb),

  ('LISTON', 'Listones',
   'Listones y piezas prismáticas (tipo 10x10). 4 caras con grosor. Admite precio por m² o por metro lineal.',
   5, '#ef4444',
   4, true, 'm2', true,
   '[{"proceso_codigo":"LIJADO","orden":1},{"proceso_codigo":"FONDO","orden":2},{"proceso_codigo":"LACADO","orden":3}]'::jsonb),

  ('IRREGULAR', 'Irregular',
   'Piezas de forma irregular sin medidas precisas. Precio manual sin motor de cálculo.',
   6, '#64748b',
   6, false, 'manual', false,
   '[{"proceso_codigo":"LIJADO","orden":1},{"proceso_codigo":"FONDO","orden":2},{"proceso_codigo":"LACADO","orden":3}]'::jsonb)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN (ejecuta estas SELECT DESPUÉS)
-- =====================================================================
-- SELECT COUNT(*) FROM productos;              -- Debe ser 0.
-- SELECT COUNT(*) FROM presupuestos;           -- Debe ser 0.
-- SELECT COUNT(*) FROM pedidos;                -- Debe ser 0.
-- SELECT COUNT(*) FROM piezas;                 -- Debe ser 0.
-- SELECT COUNT(*) FROM colores;                -- DEBE SER 272 (se conservan).
-- SELECT COUNT(*) FROM clientes;               -- Se conservan los tuyos.
--
-- SELECT codigo, nombre, caras_default, modo_precio_default, permite_ml
-- FROM categorias_pieza ORDER BY orden;
-- Debe mostrar 6 filas: ZOCALO, PUERTA, MUEBLE_COCINA, MOBILIARIO, LISTON, IRREGULAR.
-- =====================================================================
