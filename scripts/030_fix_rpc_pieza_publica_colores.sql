-- =====================================================================
-- 030_fix_rpc_pieza_publica_colores.sql
-- =====================================================================
--
-- Arregla un bug latente en la RPC pública `obtener_pieza_publica`:
-- el bloque 'color' del JSON hace `FROM colores c`, pero la tabla
-- `colores` ya no existe (fue renombrada a `colores_legacy` en su
-- día, y actualmente los `color_id` apuntan a la tabla `materiales`
-- — ver memoria Capa 2 v2). Con datos reales, /t/[qr] devolvería
-- error 500 al llegar a una pieza con color.
--
-- Comprobación previa (ejecutada el 24-abr-2026):
--   - 0 piezas con color en BD (transaccional vacío tras reset 029).
--   - 1 lineas_pedido.color_id apunta a materiales, 0 a colores_legacy.
--   - 2 lineas_presupuesto.color_id apuntan a materiales, 0 a colores_legacy.
--   → Cuando Mario confirme pedidos y se generen piezas, el
--     color_id heredado apuntará a `materiales`, no a `colores_legacy`.
--
-- Fix: cambiar `FROM colores c` por `FROM materiales c WHERE tipo='lacado'`.
-- El resto del cuerpo queda idéntico.
--
-- `materiales` expone las columnas que el frontend consume en
-- app/t/[qr]/pieza-publica.tsx:
--   - c.nombre         → color.nombre
--   - c.codigo         → color.codigo
--   - c.hex_aproximado → color.hex_aproximado
--
-- Riesgo: muy bajo. La RPC conserva idéntica firma y forma del JSON
-- de salida. LANGUAGE sql puro (sin DECLARE) para evitar bug B.
-- =====================================================================


CREATE OR REPLACE FUNCTION public.obtener_pieza_publica(p_qr text)
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
      FROM materiales c
      WHERE c.id = (SELECT color_id FROM p)
        AND c.tipo = 'lacado'
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

GRANT EXECUTE ON FUNCTION public.obtener_pieza_publica(text) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_pieza_publica(text) TO authenticated;


-- =====================================================================
-- VERIFICACIÓN (ejecutar tras aplicar el script)
-- =====================================================================
-- a) Comprueba que la función existe y compila:
--      SELECT obtener_pieza_publica('no-existe');   -- debe devolver NULL, sin error
--
-- b) Cuando Mario confirme un pedido y se genere una pieza con color,
--    escanea el QR o visita /t/[qr] y verifica que el bloque "color"
--    del JSON se rellena con nombre/codigo/hex_aproximado del material.
--
-- =====================================================================
-- ROLLBACK (volver al cuerpo anterior con el bug — usar solo si rompe)
-- =====================================================================
-- El cuerpo original idéntico está en scripts/017_trazabilidad_publica.sql.
-- Para revertir, re-ejecuta ese fichero. O descomenta:
--
-- CREATE OR REPLACE FUNCTION public.obtener_pieza_publica(p_qr text)
-- RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $$ ... (cuerpo con FROM colores c ... ) $$;
