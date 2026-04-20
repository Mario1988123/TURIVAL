-- =====================================================================
-- 012 — CAPA 2 v2: Procesos con aprendizaje + incidencias (BD schema)
-- =====================================================================
-- Este script solo crea estructuras de tablas y columnas.
-- La lógica de aprendizaje de tiempos (estimar tiempo por proceso),
-- recálculo en cascada e incidencias se implementa en TypeScript en
-- lib/services/procesos.ts por decisión de arquitectura.
--
-- Razón: Supabase SQL Editor presenta problemas de parseo con funciones
-- PL/pgSQL complejas que usan DECLARE + variables locales. Mover la
-- lógica al servicio TS resulta más mantenible, testeable y debuggable.
--
-- Idempotente. Se puede reejecutar sin romper datos.
-- =====================================================================


-- =====================================================================
-- A) PROCESOS OPCIONALES + DEPENDENCIAS
-- =====================================================================

-- A.1 Añadir 4 procesos nuevos al catálogo
INSERT INTO procesos_catalogo 
  (codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo)
VALUES
  ('COMPROB_MATERIAL', 'Comprobación material', 0, '#94a3b8', FALSE, FALSE, FALSE, 
   'Check rápido: ¿tenemos el color para lacar?', TRUE),
  ('LIJADO_2',         'Lijado 2 (opcional)',   3, '#fbbf24', TRUE,  FALSE, TRUE,  
   'Segundo lijado tras primer fondo (opcional)', TRUE),
  ('FONDEADO_2',       'Fondeado 2 (opcional)', 4, '#facc15', TRUE,  FALSE, TRUE,  
   'Segunda mano de fondo (opcional)', TRUE),
  ('PICKING',          'Picking',               8, '#a855f7', FALSE, FALSE, TRUE,  
   'Preparación final para entrega al cliente', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- A.2 Añadir campos en procesos_producto
ALTER TABLE procesos_producto 
  ADD COLUMN IF NOT EXISTS es_opcional BOOLEAN DEFAULT FALSE;

ALTER TABLE procesos_producto 
  ADD COLUMN IF NOT EXISTS depende_de_secuencia INTEGER;

COMMENT ON COLUMN procesos_producto.es_opcional IS
  'Si TRUE, este paso puede saltarse según pieza';
COMMENT ON COLUMN procesos_producto.depende_de_secuencia IS
  'Secuencia del paso que debe completarse antes. NULL = empieza cuando quiera';


-- =====================================================================
-- B) MATERIAL DISPONIBLE (bloquea Lacado)
-- =====================================================================

ALTER TABLE lineas_pedido 
  ADD COLUMN IF NOT EXISTS material_disponible BOOLEAN DEFAULT FALSE;

ALTER TABLE lineas_pedido 
  ADD COLUMN IF NOT EXISTS fecha_llegada_material DATE;

ALTER TABLE lineas_pedido 
  ADD COLUMN IF NOT EXISTS proveedor_material TEXT;

ALTER TABLE lineas_pedido 
  ADD COLUMN IF NOT EXISTS notas_material TEXT;

COMMENT ON COLUMN lineas_pedido.material_disponible IS
  'TRUE si el color/laca está en stock. El paso Lacado se bloquea hasta TRUE';

ALTER TABLE piezas 
  ADD COLUMN IF NOT EXISTS material_disponible BOOLEAN DEFAULT FALSE;

ALTER TABLE piezas 
  ADD COLUMN IF NOT EXISTS fecha_llegada_material DATE;


-- =====================================================================
-- C) HISTORIAL DE TIEMPOS (alimenta aprendizaje desde código TS)
-- =====================================================================
-- Cada vez que se completa una tarea de producción, se inserta aquí.
-- El servicio TS lib/services/procesos.ts lee esta tabla para calcular
-- media ponderada de últimas N ejecuciones y ajustar tiempos futuros.
-- =====================================================================

CREATE TABLE IF NOT EXISTS historial_tiempos_proceso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID REFERENCES tareas_produccion(id) ON DELETE SET NULL,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  proceso_id UUID REFERENCES procesos_catalogo(id) ON DELETE SET NULL,
  nivel_complejidad INTEGER REFERENCES niveles_complejidad(id),
  superficie_m2 NUMERIC,
  tiempo_real_minutos NUMERIC NOT NULL,
  tiempo_estimado_minutos NUMERIC,
  empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
  fecha_ejecucion TIMESTAMPTZ DEFAULT NOW(),
  hubo_incidencia BOOLEAN DEFAULT FALSE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_producto_proceso 
  ON historial_tiempos_proceso(producto_id, proceso_id);

CREATE INDEX IF NOT EXISTS idx_historial_fecha 
  ON historial_tiempos_proceso(fecha_ejecucion DESC);

ALTER TABLE historial_tiempos_proceso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historial_tiempos_all" ON historial_tiempos_proceso;
CREATE POLICY "historial_tiempos_all" ON historial_tiempos_proceso
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE historial_tiempos_proceso IS
  'Registro histórico de tiempos reales. Alimenta el aprendizaje de estimaciones desde el servicio TS (lib/services/procesos.ts). No usar función PL/pgSQL por problemas de parseo en Supabase SQL Editor.';


-- =====================================================================
-- D) INCIDENCIAS (botón incidencia en producción)
-- =====================================================================

CREATE TABLE IF NOT EXISTS incidencias_tarea (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas_produccion(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'repetir_proceso',
    'esperar_material',
    'defecto_pieza',
    'rectificar',
    'otro'
  )),
  descripcion TEXT NOT NULL,
  tarea_duplicada_id UUID REFERENCES tareas_produccion(id) ON DELETE SET NULL,
  minutos_retraso_estimado NUMERIC DEFAULT 0,
  reportada_por UUID REFERENCES empleados(id) ON DELETE SET NULL,
  resuelta BOOLEAN DEFAULT FALSE,
  fecha_resolucion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidencias_tarea 
  ON incidencias_tarea(tarea_id);

CREATE INDEX IF NOT EXISTS idx_incidencias_resuelta 
  ON incidencias_tarea(resuelta);

ALTER TABLE incidencias_tarea ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidencias_tarea_all" ON incidencias_tarea;
CREATE POLICY "incidencias_tarea_all" ON incidencias_tarea
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =====================================================================
-- E) AVISOS AL CLIENTE (base para Capa 8)
-- =====================================================================

CREATE TABLE IF NOT EXISTS avisos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  pedido_id UUID,
  pieza_id UUID REFERENCES piezas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'pedido_recibido',
    'produccion_iniciada',
    'material_recibido',
    'proceso_completado',
    'pieza_terminada',
    'listo_entrega',
    'incidencia',
    'retraso'
  )),
  canal TEXT CHECK (canal IN ('email', 'whatsapp', 'sms', 'manual')),
  mensaje TEXT NOT NULL,
  enviado BOOLEAN DEFAULT FALSE,
  fecha_envio TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avisos_cliente_cli 
  ON avisos_cliente(cliente_id);

CREATE INDEX IF NOT EXISTS idx_avisos_cliente_enviado 
  ON avisos_cliente(enviado);

ALTER TABLE avisos_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avisos_cliente_all" ON avisos_cliente;
CREATE POLICY "avisos_cliente_all" ON avisos_cliente
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =====================================================================
-- FIN DE MIGRACIÓN 012
-- =====================================================================
-- Lo que QUEDA para implementar en TypeScript (lib/services/procesos.ts):
--   - estimarTiempoProceso(productoId, procesoId, nivelComplejidad, m2)
--   - recalcularTiemposPieza(piezaId) [cascada al retrasar/completar]
--   - crearIncidenciaRepetir(tareaId, descripcion)
--   - registrarTiempoRealEnHistorial(tareaId) [al completar tarea]
-- =====================================================================
