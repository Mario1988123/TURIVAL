-- ============================================================
-- SCRIPT 017 — TRAZABILIDAD PÚBLICA
-- ============================================================
-- Crea una función RPC accesible desde anon (público sin login)
-- que devuelve un JSON con los datos públicos de una pieza por
-- su qr_codigo.
--
-- Se prefiere RPC SECURITY DEFINER sobre abrir policies anon
-- SELECT a 10 tablas porque:
--   - Expone SOLO los campos elegidos (blinda precios, CIFs,
--     emails, etc.)
--   - Una sola llamada, menos round-trips
--   - Fácil de auditar qué se publica
--
-- LANGUAGE sql pura + STABLE + CTE → segura contra el bug del
-- SQL Editor (sin DECLARE).
--
-- Riesgo: muy bajo. Idempotente (CREATE OR REPLACE).
-- ============================================================


-- ============ FUNCIÓN obtener_pieza_publica ============
CREATE OR REPLACE FUNCTION obtener_pieza_publica(p_qr text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT * FROM piezas WHERE qr_codigo = p_qr LIMIT 1
  )
  SELECT json_build_object(
    'pieza', (
      SELECT json_build_object(
        'id', pz.id,
        'numero', pz.numero,
        'estado', pz.estado,
        'qr_codigo', pz.qr_codigo,
        'tipo_pieza', pz.tipo_pieza,
        'ancho', pz.ancho,
        'alto', pz.alto,
        'grosor', pz.grosor,
        'longitud_ml', pz.longitud_ml,
        'superficie_m2', pz.superficie_m2,
        'fecha_confirmacion', pz.fecha_confirmacion,
        'fecha_completada', pz.fecha_completada,
        'fecha_entrega', pz.fecha_entrega,
        'material_disponible', pz.material_disponible
      )
      FROM p pz
    ),
    'color', (
      SELECT json_build_object(
        'nombre', c.nombre,
        'codigo', c.codigo,
        'hex_aproximado', c.hex_aproximado
      )
      FROM colores c
      WHERE c.id = (SELECT color_id FROM p)
    ),
    'tratamiento', (
      SELECT json_build_object('nombre', t.nombre)
      FROM tratamientos t
      WHERE t.id = (SELECT tratamiento_id FROM p)
    ),
    'ubicacion', (
      SELECT json_build_object(
        'codigo', u.codigo,
        'nombre', u.nombre,
        'tipo', u.tipo
      )
      FROM ubicaciones u
      WHERE u.id = (SELECT ubicacion_id FROM p)
    ),
    'pedido', (
      SELECT json_build_object(
        'numero', ped.numero,
        'estado', ped.estado,
        'prioridad', ped.prioridad,
        'fecha_creacion', ped.fecha_creacion,
        'fecha_entrega_estimada', ped.fecha_entrega_estimada,
        'descripcion_linea', lp.descripcion
      )
      FROM lineas_pedido lp
      JOIN pedidos ped ON ped.id = lp.pedido_id
      WHERE lp.id = (SELECT linea_pedido_id FROM p)
    ),
    'cliente', (
      SELECT json_build_object('nombre_comercial', cl.nombre_comercial)
      FROM clientes cl
      WHERE cl.id = (
        SELECT ped.cliente_id
        FROM lineas_pedido lp
        JOIN pedidos ped ON ped.id = lp.pedido_id
        WHERE lp.id = (SELECT linea_pedido_id FROM p)
      )
    ),
    'producto', (
      SELECT json_build_object('nombre', prod.nombre)
      FROM productos prod
      WHERE prod.id = (
        SELECT producto_id
        FROM lineas_pedido
        WHERE id = (SELECT linea_pedido_id FROM p)
      )
    ),
    'tareas', (
      SELECT json_agg(t ORDER BY t.secuencia)
      FROM (
        SELECT
          tp.secuencia,
          tp.estado,
          tp.fecha_inicio_real,
          tp.fecha_fin_real,
          tp.fecha_fin_secado,
          tp.tiempo_real_minutos,
          tp.tiempo_estimado_minutos,
          tp.forzado_seco,
          pc.nombre AS proceso_nombre,
          pc.abreviatura AS proceso_abreviatura,
          pc.color_gantt AS proceso_color,
          pc.requiere_secado AS proceso_requiere_secado,
          op.nombre AS operario_nombre,
          op.color AS operario_color
        FROM tareas_produccion tp
        JOIN procesos_catalogo pc ON pc.id = tp.proceso_id
        LEFT JOIN operarios op ON op.id = tp.operario_id
        WHERE tp.pieza_id = (SELECT id FROM p)
      ) t
    ),
    'movimientos', (
      SELECT json_agg(m ORDER BY m.fecha DESC)
      FROM (
        SELECT
          mp.fecha,
          mp.motivo,
          uo.codigo AS origen_codigo,
          uo.nombre AS origen_nombre,
          ud.codigo AS destino_codigo,
          ud.nombre AS destino_nombre
        FROM movimientos_pieza mp
        LEFT JOIN ubicaciones uo ON uo.id = mp.ubicacion_origen_id
        LEFT JOIN ubicaciones ud ON ud.id = mp.ubicacion_destino_id
        WHERE mp.pieza_id = (SELECT id FROM p)
      ) m
    )
  )
  WHERE EXISTS (SELECT 1 FROM p);
$$;


-- ============ GRANT EXECUTE a anon (y authenticated por claridad) ============
GRANT EXECUTE ON FUNCTION obtener_pieza_publica(text) TO anon;
GRANT EXECUTE ON FUNCTION obtener_pieza_publica(text) TO authenticated;


-- ============ FIN 017 ============


-- ============================================================
-- VERIFICACIÓN (ejecutar DESPUÉS del script, no antes)
-- ============================================================
-- Reemplaza 'PIE-2026-0001' por algún qr_codigo real tuyo:
--   SELECT obtener_pieza_publica('PIE-2026-0001');
-- Debe devolver un JSON con pieza, pedido, cliente, tareas, etc.
-- Si la pieza no existe devuelve NULL (la página muestra 404).


-- ============================================================
-- ROLLBACK (NO EJECUTAR SALVO REVERTIR)
-- ============================================================
-- DROP FUNCTION IF EXISTS obtener_pieza_publica(text);
