-- ============================================================
-- SCRIPT 014 — CAPA 4 PEDIDOS
-- ============================================================
-- Crea esquema completo de pedidos, líneas, piezas, ubicaciones,
-- movimientos y tareas de producción.
--
-- Contexto: las tablas existentes (pedidos, lineas_pedido, piezas,
-- tareas_produccion) están VACÍAS, se recrean con esquema nuevo.
-- ============================================================

-- ============ 1. LIMPIEZA ============
DROP TABLE IF EXISTS tareas_produccion CASCADE;
DROP TABLE IF EXISTS movimientos_pieza CASCADE;
DROP TABLE IF EXISTS piezas            CASCADE;
DROP TABLE IF EXISTS lineas_pedido     CASCADE;
DROP TABLE IF EXISTS pedidos           CASCADE;
DROP TABLE IF EXISTS ubicaciones       CASCADE;

-- ============ 2. UBICACIONES ============
CREATE TABLE ubicaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text NOT NULL UNIQUE,
  nombre          text NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('carrito','estanteria','libre')),
  capacidad_aprox integer,
  notas           text,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ubicaciones_activo ON ubicaciones(activo);
CREATE INDEX idx_ubicaciones_tipo   ON ubicaciones(tipo);

-- Seed inicial (edítalo luego desde /configuracion/ubicaciones)
INSERT INTO ubicaciones (codigo, nombre, tipo) VALUES
  ('C-01', 'Carrito 1',   'carrito'),
  ('C-02', 'Carrito 2',   'carrito'),
  ('C-03', 'Carrito 3',   'carrito'),
  ('E-01', 'Estantería 1','estanteria');

-- ============ 3. PEDIDOS ============
CREATE TABLE pedidos (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                   text NOT NULL UNIQUE,
  cliente_id               uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  presupuesto_origen_id    uuid REFERENCES presupuestos(id) ON DELETE SET NULL,
  fecha_creacion           date NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega_estimada   date,
  estado                   text NOT NULL DEFAULT 'borrador' CHECK (estado IN (
                             'borrador','confirmado','en_produccion',
                             'completado','entregado','facturado','cancelado')),
  prioridad                text NOT NULL DEFAULT 'normal' CHECK (prioridad IN (
                             'baja','normal','alta','urgente')),
  subtotal                 numeric(12,2) NOT NULL DEFAULT 0,
  descuento_porcentaje     numeric(5,2)  NOT NULL DEFAULT 0,
  descuento_importe        numeric(12,2) NOT NULL DEFAULT 0,
  base_imponible           numeric(12,2) NOT NULL DEFAULT 0,
  iva_porcentaje           numeric(5,2)  NOT NULL DEFAULT 21,
  iva_importe              numeric(12,2) NOT NULL DEFAULT 0,
  total                    numeric(12,2) NOT NULL DEFAULT 0,
  observaciones_comerciales text,
  observaciones_internas   text,
  direccion_entrega        text,
  contacto_entrega         text,
  telefono_entrega         text,
  user_id                  uuid NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pedidos_cliente     ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_presupuesto ON pedidos(presupuesto_origen_id);
CREATE INDEX idx_pedidos_estado      ON pedidos(estado);
CREATE INDEX idx_pedidos_prioridad   ON pedidos(prioridad);
CREATE INDEX idx_pedidos_fecha       ON pedidos(fecha_creacion DESC);

-- ============ 4. LINEAS_PEDIDO ============
-- Espejo de lineas_presupuesto + campos de material propios del pedido
CREATE TABLE lineas_pedido (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id                    uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  linea_presupuesto_origen_id  uuid REFERENCES lineas_presupuesto(id) ON DELETE SET NULL,

  -- Producto / tarifa
  producto_id                  uuid REFERENCES productos(id) ON DELETE RESTRICT,
  tarifa_id                    uuid REFERENCES tarifas(id)   ON DELETE RESTRICT,
  referencia_cliente_id        uuid,                    -- FK manual luego si aplica
  acabado_id                   uuid,                    -- FK manual luego si aplica
  acabado_texto                text,

  -- Descriptivos
  descripcion                  text,
  orden                        integer,
  notas                        text,
  nivel_complejidad            integer DEFAULT 2,

  -- Color / tratamiento
  color_id                     uuid REFERENCES colores(id)       ON DELETE SET NULL,
  tratamiento_id               uuid REFERENCES tratamientos(id)  ON DELETE SET NULL,

  -- Tipo y modo de precio
  tipo_pieza                   text,
  modo_precio                  text NOT NULL,
  unidad                       text,

  -- Geometría
  cantidad                     integer NOT NULL DEFAULT 1,
  ancho                        numeric,
  alto                         numeric,
  grosor                       numeric,
  longitud_ml                  numeric,
  superficie_m2                numeric,

  -- 6 booleanos de caras (nombres idénticos a lineas_presupuesto)
  cara_frontal                 boolean,
  cara_trasera                 boolean,
  canto_superior               boolean,
  canto_inferior               boolean,
  canto_izquierdo              boolean,
  canto_derecho                boolean,

  -- Precios
  precio_unitario              numeric,
  precio_m2                    numeric,
  precio_pieza                 numeric,
  precio_minimo                numeric,
  suplemento_manual            numeric,
  suplemento_descripcion       text,
  total_linea                  numeric(12,2) NOT NULL DEFAULT 0,

  -- Tiempo y extras
  tiempo_estimado              integer,
  extras                       jsonb,

  -- Material (específico pedido)
  material_disponible          boolean NOT NULL DEFAULT false,
  fecha_llegada_material       date,
  proveedor                    text,
  notas_material               text,

  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lineas_pedido_pedido       ON lineas_pedido(pedido_id);
CREATE INDEX idx_lineas_pedido_linea_origen ON lineas_pedido(linea_presupuesto_origen_id);
CREATE INDEX idx_lineas_pedido_producto     ON lineas_pedido(producto_id);
CREATE INDEX idx_lineas_pedido_color        ON lineas_pedido(color_id);

-- ============ 5. PIEZAS ============
CREATE TABLE piezas (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                    text NOT NULL UNIQUE,
  linea_pedido_id           uuid NOT NULL REFERENCES lineas_pedido(id) ON DELETE CASCADE,
  ubicacion_id              uuid REFERENCES ubicaciones(id) ON DELETE SET NULL,

  estado                    text NOT NULL DEFAULT 'sin_producir' CHECK (estado IN (
                              'sin_producir','en_produccion','completada',
                              'en_almacen','entregada','incidencia','cancelada')),

  -- SNAPSHOT de atributos (congelados al confirmar pedido)
  color_id                  uuid,
  tratamiento_id            uuid,
  tipo_pieza                text,
  ancho                     numeric,
  alto                      numeric,
  grosor                    numeric,
  longitud_ml               numeric,
  superficie_m2             numeric,

  -- Fechas
  fecha_confirmacion        timestamptz,
  fecha_prevista_fabricacion date,
  fecha_completada          timestamptz,
  fecha_entrega             timestamptz,

  -- QR y material
  qr_codigo                 text UNIQUE,
  material_disponible       boolean NOT NULL DEFAULT false,
  fecha_llegada_material    date,

  notas                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_piezas_linea_pedido    ON piezas(linea_pedido_id);
CREATE INDEX idx_piezas_ubicacion       ON piezas(ubicacion_id);
CREATE INDEX idx_piezas_estado          ON piezas(estado);
CREATE INDEX idx_piezas_color_estado    ON piezas(color_id, estado); -- feature Capa 6 agrupar por color
CREATE INDEX idx_piezas_fecha_prevista  ON piezas(fecha_prevista_fabricacion);

-- ============ 6. MOVIMIENTOS_PIEZA ============
CREATE TABLE movimientos_pieza (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pieza_id                uuid NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
  fecha                   timestamptz NOT NULL DEFAULT now(),
  ubicacion_origen_id     uuid REFERENCES ubicaciones(id) ON DELETE SET NULL,
  ubicacion_destino_id    uuid NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT,
  user_id                 uuid NOT NULL,
  motivo                  text,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_movimientos_pieza_pieza ON movimientos_pieza(pieza_id);
CREATE INDEX idx_movimientos_pieza_fecha ON movimientos_pieza(fecha DESC);

-- ============ 7. TAREAS_PRODUCCION ============
CREATE TABLE tareas_produccion (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pieza_id                  uuid NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
  proceso_id                uuid NOT NULL REFERENCES procesos_catalogo(id) ON DELETE RESTRICT,
  secuencia                 integer NOT NULL,
  es_opcional               boolean NOT NULL DEFAULT false,
  depende_de_secuencia      integer,
  estado                    text NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
                              'pendiente','en_cola','en_progreso',
                              'completada','incidencia','anulada')),
  tiempo_estimado_minutos   numeric,
  tiempo_real_minutos       numeric,
  fecha_inicio_planificada  timestamptz,
  fecha_inicio_real         timestamptz,
  fecha_fin_real            timestamptz,
  operario_id               uuid, -- FK futura a operarios
  notas                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tareas_pieza              ON tareas_produccion(pieza_id);
CREATE INDEX idx_tareas_proceso            ON tareas_produccion(proceso_id);
CREATE INDEX idx_tareas_estado             ON tareas_produccion(estado);
CREATE INDEX idx_tareas_fecha_planificada  ON tareas_produccion(fecha_inicio_planificada);
CREATE UNIQUE INDEX idx_tareas_pieza_secuencia ON tareas_produccion(pieza_id, secuencia);

-- ============ 8. TRIGGERS updated_at ============
-- La función set_updated_at probablemente ya existe de scripts anteriores.
-- Se define aquí con CREATE OR REPLACE para ser idempotente.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ubicaciones_updated_at
  BEFORE UPDATE ON ubicaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_lineas_pedido_updated_at
  BEFORE UPDATE ON lineas_pedido
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_piezas_updated_at
  BEFORE UPDATE ON piezas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tareas_produccion_updated_at
  BEFORE UPDATE ON tareas_produccion
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ 9. RLS POLICIES ============
ALTER TABLE ubicaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_pedido     ENABLE ROW LEVEL SECURITY;
ALTER TABLE piezas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_pieza ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_produccion ENABLE ROW LEVEL SECURITY;

-- Single tenant: policies abiertas para usuarios autenticados
CREATE POLICY auth_all_ubicaciones        ON ubicaciones        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_pedidos            ON pedidos            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_lineas_pedido      ON lineas_pedido      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_piezas             ON piezas             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_movimientos_pieza  ON movimientos_pieza  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_tareas_produccion  ON tareas_produccion  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ FIN DEL SCRIPT ============
