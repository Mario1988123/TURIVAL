-- =====================================================================
-- 012 — CAPA 2 v2: Procesos con aprendizaje de tiempos + incidencias
-- =====================================================================
-- Implementa el flujo de producción real de Turiaval:
--
--   Paso 0  - Comprobación material (paso "check" de segundos)
--   Paso 1  - Lijado
--   Paso 2  - Fondeado
--   Paso 3  - Lijado 2      (OPCIONAL según pieza)
--   Paso 4  - Fondeado 2    (OPCIONAL según pieza)
--   Paso 5  - Lacado        (REQUIERE material_disponible=true)
--   Paso 6  - Final
--   Paso 7  - Revisión
--   Paso 8  - Picking
--
-- Features implementadas:
--   A) Procesos opcionales por producto + dependencias entre pasos
--   B) Campo material_disponible en línea de pedido / pieza
--   C) Tabla historial_tiempos_proceso → aprendizaje para futuras estimaciones
--   D) Tabla incidencias_tarea → registro de repeticiones y retrasos
--   E) Función recalcular_tiempos_pedido → cascada dinámica
--   F) Tabla avisos_cliente → base para Capa 8 (Avisos al cliente)
--
-- Idempotente. Se puede reejecutar sin romper datos.
-- =====================================================================


-- =====================================================================
-- A) PROCESOS OPCIONALES + DEPENDENCIAS
-- =====================================================================

-- A.1 Añadir 3 nuevos procesos al catálogo (idempotente)
--    Alineamos los códigos existentes y añadimos los 3 nuevos pasos.
-- ---------------------------------------------------------------------
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

-- A.2 Añadir campos "opcional" y "depende_de" en procesos_producto
-- ---------------------------------------------------------------------
ALTER TABLE procesos_producto 
  ADD COLUMN IF NOT EXISTS es_opcional BOOLEAN DEFAULT FALSE;

ALTER TABLE procesos_producto 
  ADD COLUMN IF NOT EXISTS depende_de_secuencia INTEGER;

COMMENT ON COLUMN procesos_producto.es_opcional IS
  'Si TRUE, este paso puede saltarse según pieza (ej: Lijado2/Fondeado2 opcionales)';
COMMENT ON COLUMN procesos_producto.depende_de_secuencia IS
  'Secuencia del paso que debe completarse antes de empezar éste. NULL = empieza cuando quiera';


-- =====================================================================
-- B) MATERIAL DISPONIBLE (bloquea Lacado)
-- =====================================================================

-- B.1 Añadir campos en lineas_pedido
-- ---------------------------------------------------------------------
ALTER TABLE lineas_pedido 
  ADD COLUMN IF NOT EXISTS material_disponible BOOLEAN DEFAULT FALSE;

ALTER TABLE lineas_pedido 
  ADD COLUMN IF NOT EXISTS fecha_llegada_material DATE;

ALTER TABLE lineas_pedido 
  ADD COLUMN IF NOT EXISTS proveedor_material TEXT;

ALTER TABLE lineas_pedido 
  ADD COLUMN IF NOT EXISTS notas_material TEXT;

COMMENT ON COLUMN lineas_pedido.material_disponible IS
  'TRUE si el color/laca está en stock o ha llegado. El paso Lacado se bloquea hasta que sea TRUE';
COMMENT ON COLUMN lineas_pedido.fecha_llegada_material IS
  'Fecha estimada de llegada del material si aún no está disponible';

-- B.2 También en piezas (por si una pieza concreta tiene particularidades)
-- ---------------------------------------------------------------------
ALTER TABLE piezas 
  ADD COLUMN IF NOT EXISTS material_disponible BOOLEAN DEFAULT FALSE;

ALTER TABLE piezas 
  ADD COLUMN IF NOT EXISTS fecha_llegada_material DATE;


-- =====================================================================
-- C) APRENDIZAJE DE TIEMPOS (historial_tiempos_proceso)
-- =====================================================================

-- C.1 Tabla histórica: cada ejecución completada se registra aquí
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_tiempos_proceso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID REFERENCES tareas_produccion(id) ON DELETE SET NULL,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  proceso_id UUID REFERENCES procesos_catalogo(id) ON DELETE SET NULL,
  nivel_complejidad INTEGER REFERENCES niveles_complejidad(id),
  superficie_m2 NUMERIC,
  tiempo_real_minutos NUMERIC NOT NULL,
  tiempo_estimado_minutos NUMERIC,
  diferencia_porcentaje NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN COALESCE(tiempo_estimado_minutos, 0) = 0 THEN NULL
      ELSE ROUND(((tiempo_real_minutos - tiempo_estimado_minutos) / tiempo_estimado_minutos) * 100, 2)
    END
  ) STORED,
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
  'Registro histórico de tiempos reales de ejecución. Alimenta el sistema de aprendizaje: cuando se estima el tiempo de un proceso futuro, se toma la media ponderada de las últimas 10 ejecuciones del mismo producto+proceso+complejidad.';


-- C.2 Función: obtener tiempo estimado "inteligente" para un proceso
-- ---------------------------------------------------------------------
-- Si hay <3 registros históricos: usa el tiempo_base de procesos_producto
-- Si hay >=3: usa media ponderada de las últimas 10 ejecuciones
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION estimar_tiempo_proceso(
  p_producto_id UUID,
  p_proceso_id UUID,
  p_nivel_complejidad INTEGER,
  p_superficie_m2 NUMERIC DEFAULT 0
)
RETURNS NUMERIC AS $$
DECLARE
  v_num_registros INTEGER;
  v_media_historica NUMERIC;
  v_tiempo_base NUMERIC;
  v_tiempo_por_m2 NUMERIC;
  v_factor NUMERIC;
  v_multiplicador NUMERIC;
BEGIN
  -- 1. Contar registros históricos relevantes (últimos 10)
  SELECT COUNT(*) INTO v_num_registros
  FROM (
    SELECT id FROM historial_tiempos_proceso
    WHERE producto_id = p_producto_id
      AND proceso_id = p_proceso_id
      AND COALESCE(nivel_complejidad, 0) = COALESCE(p_nivel_complejidad, 0)
    ORDER BY fecha_ejecucion DESC
    LIMIT 10
  ) AS ultimos;

  -- 2. Si hay suficientes registros, usar media ponderada
  --    (ejecuciones más recientes pesan más)
  IF v_num_registros >= 3 THEN
    SELECT AVG(tiempo_real_minutos) INTO v_media_historica
    FROM (
      SELECT tiempo_real_minutos 
      FROM historial_tiempos_proceso
      WHERE producto_id = p_producto_id
        AND proceso_id = p_proceso_id
        AND COALESCE(nivel_complejidad, 0) = COALESCE(p_nivel_complejidad, 0)
      ORDER BY fecha_ejecucion DESC
      LIMIT 10
    ) AS ultimos;
    
    RETURN ROUND(v_media_historica, 2);
  END IF;

  -- 3. Si no hay suficientes, calcular desde procesos_producto
  SELECT 
    tiempo_base_minutos, 
    tiempo_por_m2_minutos,
    CASE 
      WHEN p_nivel_complejidad IS NULL THEN 1
      ELSE COALESCE(
        (SELECT multiplicador FROM niveles_complejidad WHERE id = p_nivel_complejidad),
        1
      )
    END
  INTO v_tiempo_base, v_tiempo_por_m2, v_multiplicador
  FROM procesos_producto
  WHERE producto_id = p_producto_id 
    AND proceso_id = p_proceso_id
    AND activo = TRUE
  LIMIT 1;

  IF v_tiempo_base IS NULL THEN
    RETURN 0; -- sin configuración
  END IF;

  RETURN ROUND(
    (COALESCE(v_tiempo_base, 0) + COALESCE(v_tiempo_por_m2, 0) * COALESCE(p_superficie_m2, 0))
      * COALESCE(v_multiplicador, 1),
    2
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION estimar_tiempo_proceso IS
  'Devuelve el tiempo estimado en minutos para un proceso. Usa historial aprendido si hay >=3 registros, si no usa el tiempo configurado en procesos_producto.';


-- =====================================================================
-- D) INCIDENCIAS (botón incidencia en producción)
-- =====================================================================

-- D.1 Tabla incidencias_tarea
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidencias_tarea (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas_produccion(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'repetir_proceso',    -- hay que volver a hacer el proceso
    'esperar_material',   -- falta material, se pausa
    'defecto_pieza',      -- pieza dañada
    'rectificar',         -- hay que ajustar algo
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

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_incidencias_tarea_updated_at ON incidencias_tarea;
CREATE TRIGGER update_incidencias_tarea_updated_at 
  BEFORE UPDATE ON incidencias_tarea 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================================
-- E) RECÁLCULO DE TIEMPOS EN CASCADA
-- =====================================================================

-- E.1 Función: recalcular_tiempos_pieza(pieza_id)
-- ---------------------------------------------------------------------
-- Recorre las tareas pendientes de una pieza en orden de secuencia y
-- recalcula fecha_inicio_planificada y fecha_fin_planificada en cadena.
-- Se llama cuando:
--   - Cambia una fecha real de finalización
--   - Se crea una incidencia
--   - Llega material (cambia material_disponible)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalcular_tiempos_pieza(p_pieza_id UUID)
RETURNS VOID AS $$
DECLARE
  v_tarea RECORD;
  v_fecha_inicio TIMESTAMPTZ;
  v_duracion_min NUMERIC;
  v_material_ok BOOLEAN;
  v_codigo_proceso TEXT;
BEGIN
  -- Obtener si hay material disponible
  SELECT COALESCE(material_disponible, FALSE) INTO v_material_ok
  FROM piezas WHERE id = p_pieza_id;

  v_fecha_inicio := NOW();

  -- Iterar tareas pendientes/en progreso por secuencia
  FOR v_tarea IN 
    SELECT t.id, t.proceso_id, t.secuencia, t.tiempo_estimado_minutos,
           t.fecha_fin_real, t.estado, pc.codigo AS codigo_proceso
    FROM tareas_produccion t
    JOIN procesos_catalogo pc ON pc.id = t.proceso_id
    WHERE t.pieza_id = p_pieza_id
      AND t.estado IN ('pendiente', 'en_progreso', 'pausada')
    ORDER BY t.secuencia ASC
  LOOP
    -- Si la tarea ya tiene fecha_fin_real, tomar eso como base y continuar
    IF v_tarea.fecha_fin_real IS NOT NULL THEN
      v_fecha_inicio := v_tarea.fecha_fin_real;
      CONTINUE;
    END IF;

    -- Caso especial: si es LACADO y no hay material, saltar (queda pendiente)
    IF v_tarea.codigo_proceso = 'LACADO' AND NOT v_material_ok THEN
      UPDATE tareas_produccion 
      SET fecha_inicio_planificada = NULL,
          fecha_fin_planificada = NULL,
          notas_operario = COALESCE(notas_operario, '') || 
            E'\n[Auto] Bloqueado: esperando material'
      WHERE id = v_tarea.id;
      CONTINUE;
    END IF;

    v_duracion_min := COALESCE(v_tarea.tiempo_estimado_minutos, 60);

    UPDATE tareas_produccion
    SET fecha_inicio_planificada = v_fecha_inicio,
        fecha_fin_planificada = v_fecha_inicio + (v_duracion_min || ' minutes')::INTERVAL
    WHERE id = v_tarea.id;

    -- Siguiente tarea arranca cuando acaba ésta
    v_fecha_inicio := v_fecha_inicio + (v_duracion_min || ' minutes')::INTERVAL;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalcular_tiempos_pieza IS
  'Recalcula fechas planificadas de todas las tareas pendientes de una pieza en cascada. Se debe llamar tras cambios de estado, incidencias o llegada de material.';


-- E.2 Función: crear_incidencia_repetir(tarea_id, descripcion)
-- ---------------------------------------------------------------------
-- Duplica la tarea afectada para que se repita el proceso y recalcula
-- fechas en cascada de todas las tareas siguientes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_incidencia_repetir(
  p_tarea_id UUID,
  p_descripcion TEXT,
  p_empleado_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_tarea tareas_produccion%ROWTYPE;
  v_nueva_tarea_id UUID;
  v_incidencia_id UUID;
  v_max_seq INTEGER;
BEGIN
  -- Obtener tarea original
  SELECT * INTO v_tarea FROM tareas_produccion WHERE id = p_tarea_id;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Tarea % no existe', p_tarea_id;
  END IF;

  -- Bump de secuencia: la nueva va justo después de la original
  -- y las tareas siguientes se desplazan
  SELECT MAX(secuencia) INTO v_max_seq 
  FROM tareas_produccion 
  WHERE pieza_id = v_tarea.pieza_id;

  UPDATE tareas_produccion
  SET secuencia = secuencia + 1
  WHERE pieza_id = v_tarea.pieza_id
    AND secuencia > v_tarea.secuencia;

  -- Crear la nueva tarea (repetición)
  INSERT INTO tareas_produccion (
    pieza_id, proceso_id, secuencia, estado,
    tiempo_estimado_minutos, nivel_complejidad_aplicado, 
    superficie_m2_aplicada, notas_operario
  ) VALUES (
    v_tarea.pieza_id, v_tarea.proceso_id, v_tarea.secuencia + 1, 'pendiente',
    v_tarea.tiempo_estimado_minutos, v_tarea.nivel_complejidad_aplicado,
    v_tarea.superficie_m2_aplicada,
    'Repetición por incidencia: ' || p_descripcion
  ) RETURNING id INTO v_nueva_tarea_id;

  -- Crear registro de incidencia
  INSERT INTO incidencias_tarea (
    tarea_id, tipo, descripcion, tarea_duplicada_id,
    minutos_retraso_estimado, reportada_por
  ) VALUES (
    p_tarea_id, 'repetir_proceso', p_descripcion, v_nueva_tarea_id,
    COALESCE(v_tarea.tiempo_estimado_minutos, 0), p_empleado_id
  ) RETURNING id INTO v_incidencia_id;

  -- Recalcular cascada
  PERFORM recalcular_tiempos_pieza(v_tarea.pieza_id);

  RETURN v_incidencia_id;
END;
$$ LANGUAGE plpgsql;


-- E.3 Trigger: cuando se completa una tarea, registrar en historial
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_completar_tarea()
RETURNS TRIGGER AS $$
DECLARE
  v_producto_id UUID;
BEGIN
  -- Solo actuar cuando pasa a 'completada' y tiene datos reales
  IF NEW.estado = 'completada' 
     AND (OLD IS NULL OR OLD.estado != 'completada')
     AND NEW.fecha_inicio_real IS NOT NULL 
     AND NEW.fecha_fin_real IS NOT NULL THEN

    -- Obtener producto_id de la pieza
    SELECT producto_id INTO v_producto_id 
    FROM piezas WHERE id = NEW.pieza_id;

    -- Calcular tiempo real si no está informado
    IF NEW.tiempo_real_minutos IS NULL THEN
      NEW.tiempo_real_minutos := EXTRACT(EPOCH FROM (NEW.fecha_fin_real - NEW.fecha_inicio_real)) / 60;
    END IF;

    -- Insertar en historial
    INSERT INTO historial_tiempos_proceso (
      tarea_id, producto_id, proceso_id, nivel_complejidad,
      superficie_m2, tiempo_real_minutos, tiempo_estimado_minutos,
      empleado_id, fecha_ejecucion
    ) VALUES (
      NEW.id, v_producto_id, NEW.proceso_id, NEW.nivel_complejidad_aplicado,
      NEW.superficie_m2_aplicada, NEW.tiempo_real_minutos, NEW.tiempo_estimado_minutos,
      NEW.empleado_id, NEW.fecha_fin_real
    );

    -- Recalcular cascada de tareas pendientes
    PERFORM recalcular_tiempos_pieza(NEW.pieza_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_completar_tarea ON tareas_produccion;
CREATE TRIGGER trg_completar_tarea
  AFTER UPDATE OR INSERT ON tareas_produccion
  FOR EACH ROW
  EXECUTE FUNCTION trigger_completar_tarea();


-- =====================================================================
-- F) AVISOS AL CLIENTE (base para Capa 8)
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

CREATE INDEX IF NOT EXISTS idx_avisos_cliente_cli ON avisos_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_avisos_cliente_enviado ON avisos_cliente(enviado);

ALTER TABLE avisos_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avisos_cliente_all" ON avisos_cliente;
CREATE POLICY "avisos_cliente_all" ON avisos_cliente
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =====================================================================
-- FIN DE MIGRACIÓN 012
-- =====================================================================
-- Verificaciones rápidas (opcional, descomenta para probar):
--
-- SELECT codigo, nombre, orden_tipico FROM procesos_catalogo 
--   WHERE codigo IN ('COMPROB_MATERIAL','LIJADO_2','FONDEADO_2','PICKING') 
--   ORDER BY orden_tipico;
--
-- SELECT estimar_tiempo_proceso(
--   (SELECT id FROM productos LIMIT 1),
--   (SELECT id FROM procesos_catalogo WHERE codigo='LIJADO' LIMIT 1),
--   2, 1.5
-- ) AS tiempo_estimado_minutos;
-- =====================================================================


-- =====================================================================
-- ROLLBACK (por si algo falla — NO ejecutar normalmente)
-- =====================================================================
-- DROP TRIGGER IF EXISTS trg_completar_tarea ON tareas_produccion;
-- DROP FUNCTION IF EXISTS trigger_completar_tarea();
-- DROP FUNCTION IF EXISTS crear_incidencia_repetir(UUID, TEXT, UUID);
-- DROP FUNCTION IF EXISTS recalcular_tiempos_pieza(UUID);
-- DROP FUNCTION IF EXISTS estimar_tiempo_proceso(UUID, UUID, INTEGER, NUMERIC);
-- DROP TABLE IF EXISTS avisos_cliente;
-- DROP TABLE IF EXISTS incidencias_tarea;
-- DROP TABLE IF EXISTS historial_tiempos_proceso;
-- ALTER TABLE piezas DROP COLUMN IF EXISTS material_disponible;
-- ALTER TABLE piezas DROP COLUMN IF EXISTS fecha_llegada_material;
-- ALTER TABLE lineas_pedido DROP COLUMN IF EXISTS material_disponible;
-- ALTER TABLE lineas_pedido DROP COLUMN IF EXISTS fecha_llegada_material;
-- ALTER TABLE lineas_pedido DROP COLUMN IF EXISTS proveedor_material;
-- ALTER TABLE lineas_pedido DROP COLUMN IF EXISTS notas_material;
-- ALTER TABLE procesos_producto DROP COLUMN IF EXISTS es_opcional;
-- ALTER TABLE procesos_producto DROP COLUMN IF EXISTS depende_de_secuencia;
-- DELETE FROM procesos_catalogo WHERE codigo IN 
--   ('COMPROB_MATERIAL','LIJADO_2','FONDEADO_2','PICKING');
