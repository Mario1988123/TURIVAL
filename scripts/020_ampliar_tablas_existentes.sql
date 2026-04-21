-- =====================================================================
-- 020_ampliar_tablas_existentes.sql
-- R1 del rediseño ERP TURIVAL — paso 3/5
-- =====================================================================
-- QUÉ HACE:
--   Añade columnas nuevas a tablas existentes para soportar el motor
--   nuevo. NO borra columnas viejas (color_id, producto_id, tarifa_id)
--   para no romper el backend actual entre R1 y R2. Esas columnas se
--   borran en R7 cuando el backend nuevo esté en producción.
--
--   Tablas afectadas:
--     - lineas_presupuesto
--     - lineas_pedido
--     - piezas
--     - referencias_cliente
--     - tareas_produccion
--
--   La FK color_id → colores_legacy(id) queda rota tras el renombrado
--   del 019, pero las tablas están vacías (TRUNCATEd en 018), así que
--   no hay filas que validen la FK. Para ser estrictos, dropeamos las
--   FKs viejas a colores/colores_legacy para no tener referencias
--   zombie.
--
-- ROLLBACK:
--   Ver bloque ROLLBACK al final.
-- =====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 0. DROP FKs viejas hacia colores (ahora colores_legacy)
--    No afecta datos (tablas vacías). Las columnas color_id se mantienen
--    sin FK hasta que el backend nuevo las ignore en R2/R7.
-- --------------------------------------------------------------------
ALTER TABLE lineas_presupuesto  DROP CONSTRAINT IF EXISTS lineas_presupuesto_color_id_fkey;
ALTER TABLE lineas_pedido       DROP CONSTRAINT IF EXISTS lineas_pedido_color_id_fkey;
ALTER TABLE piezas              DROP CONSTRAINT IF EXISTS piezas_color_id_fkey;
ALTER TABLE referencias_cliente DROP CONSTRAINT IF EXISTS referencias_cliente_color_id_fkey;

-- --------------------------------------------------------------------
-- 1. lineas_presupuesto
-- --------------------------------------------------------------------
ALTER TABLE lineas_presupuesto
  ADD COLUMN IF NOT EXISTS material_lacado_id        uuid REFERENCES materiales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_fondo_id         uuid REFERENCES materiales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_pieza_id        uuid REFERENCES categorias_pieza(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contabilizar_grosor       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS precio_aproximado         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS longitud_ml               numeric,
  ADD COLUMN IF NOT EXISTS desglose_coste_json       jsonb;
-- Nota: cara_frontal, cara_trasera, canto_*, ancho, alto, grosor,
-- superficie_m2, modo_precio YA existen.

-- --------------------------------------------------------------------
-- 2. lineas_pedido
-- --------------------------------------------------------------------
ALTER TABLE lineas_pedido
  ADD COLUMN IF NOT EXISTS material_lacado_id        uuid REFERENCES materiales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_fondo_id         uuid REFERENCES materiales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_pieza_id        uuid REFERENCES categorias_pieza(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cara_frontal              boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cara_trasera              boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_superior            boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_inferior            boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_izquierdo           boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_derecho             boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contabilizar_grosor       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS precio_aproximado         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS longitud_ml               numeric,
  ADD COLUMN IF NOT EXISTS desglose_coste_json       jsonb;

-- --------------------------------------------------------------------
-- 3. piezas
-- --------------------------------------------------------------------
ALTER TABLE piezas
  ADD COLUMN IF NOT EXISTS material_lacado_id        uuid REFERENCES materiales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_fondo_id         uuid REFERENCES materiales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_pieza_id        uuid REFERENCES categorias_pieza(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cara_frontal              boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cara_trasera              boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_superior            boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_inferior            boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_izquierdo           boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_derecho             boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contabilizar_grosor       boolean DEFAULT false;

-- --------------------------------------------------------------------
-- 4. referencias_cliente — corazón del rediseño (pieza recurrente)
-- --------------------------------------------------------------------
ALTER TABLE referencias_cliente
  ADD COLUMN IF NOT EXISTS categoria_pieza_id        uuid REFERENCES categorias_pieza(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_lacado_id        uuid REFERENCES materiales(id)        ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_fondo_id         uuid REFERENCES materiales(id)        ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS modo_precio               text DEFAULT 'm2'
                                                     CHECK (modo_precio IN ('m2','pieza','ml','manual')),
  ADD COLUMN IF NOT EXISTS ancho                     numeric,
  ADD COLUMN IF NOT EXISTS alto                      numeric,
  ADD COLUMN IF NOT EXISTS grosor                    numeric,
  ADD COLUMN IF NOT EXISTS longitud_ml               numeric,
  ADD COLUMN IF NOT EXISTS cara_frontal              boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cara_trasera              boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_superior            boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_inferior            boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_izquierdo           boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canto_derecho             boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contabilizar_grosor       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS factor_complejidad        text DEFAULT 'media'
                                                     CHECK (factor_complejidad IN ('simple','media','compleja')),
  ADD COLUMN IF NOT EXISTS procesos                  jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS descuento_porcentaje      numeric NOT NULL DEFAULT 0
                                                     CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
  ADD COLUMN IF NOT EXISTS precio_aproximado         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS coste_calculado_ultimo    numeric,
  ADD COLUMN IF NOT EXISTS precio_calculado_ultimo   numeric,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_calculo      timestamptz;

-- --------------------------------------------------------------------
-- 5. tareas_produccion — consumos estimado y real
-- --------------------------------------------------------------------
ALTER TABLE tareas_produccion
  ADD COLUMN IF NOT EXISTS consumo_lacado_estimado_kg numeric,
  ADD COLUMN IF NOT EXISTS consumo_fondo_estimado_kg  numeric,
  ADD COLUMN IF NOT EXISTS consumo_cata_estimado_kg   numeric,
  ADD COLUMN IF NOT EXISTS consumo_dis_estimado_kg    numeric,
  ADD COLUMN IF NOT EXISTS consumo_lacado_real_kg     numeric,
  ADD COLUMN IF NOT EXISTS consumo_fondo_real_kg      numeric,
  ADD COLUMN IF NOT EXISTS consumo_cata_real_kg       numeric,
  ADD COLUMN IF NOT EXISTS consumo_dis_real_kg        numeric,
  ADD COLUMN IF NOT EXISTS consumo_registrado_at      timestamptz;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'referencias_cliente'
--   AND column_name IN (
--     'categoria_pieza_id','material_lacado_id','material_fondo_id',
--     'modo_precio','ancho','alto','grosor','longitud_ml',
--     'cara_frontal','contabilizar_grosor','factor_complejidad',
--     'procesos','descuento_porcentaje','precio_aproximado')
-- ORDER BY column_name;
-- Debe listar 14 columnas nuevas.
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'tareas_produccion'
--   AND column_name LIKE 'consumo_%'
-- ORDER BY column_name;
-- Debe listar 9 columnas nuevas.
-- =====================================================================

-- =====================================================================
-- ROLLBACK (NO ejecutar salvo desastre)
-- =====================================================================
-- ALTER TABLE lineas_presupuesto
--   DROP COLUMN IF EXISTS material_lacado_id,
--   DROP COLUMN IF EXISTS material_fondo_id,
--   DROP COLUMN IF EXISTS categoria_pieza_id,
--   DROP COLUMN IF EXISTS contabilizar_grosor,
--   DROP COLUMN IF EXISTS precio_aproximado,
--   DROP COLUMN IF EXISTS longitud_ml,
--   DROP COLUMN IF EXISTS desglose_coste_json;
-- (resto de tablas igual con DROP COLUMN IF EXISTS)
-- =====================================================================
