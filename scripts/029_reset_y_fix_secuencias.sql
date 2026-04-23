-- =====================================================================
-- 029_reset_y_fix_secuencias.sql  (v2, con TRUNCATE CASCADE)
-- =====================================================================
--
-- Versión definitiva de generación de números de secuencia. Arregla
-- el bug Q descubierto al imprimir etiquetas el 23-abr-2026:
--
--   La función generar_numero_secuencial(p_tipo TEXT) sólo aceptaba
--   los nombres en minúscula completa ('presupuesto','pedido','pieza',
--   'albaran','lote'). Todo lo demás caía al ELSE y usaba prefijo DOC.
--
--   Como lib/services/pedidos.ts llamaba con 'PIE'/'PED' (abreviaturas),
--   tanto pedidos como piezas se estaban numerando como "DOC-YYYY-NNNN".
--
-- Cambios:
--   · CASE amplio que acepta tanto 'pieza'/'PIEZA'/'PIE' como formas
--     similares para los demás tipos → 1 solo prefijo por tipo.
--   · Año con formato YY (2 dígitos) en lugar de YYYY.
--   · LANGUAGE sql puro (evita el bug B de Supabase SQL Editor con
--     PL/pgSQL y DECLARE).
--   · Reset con TRUNCATE ... CASCADE: así no hay que enumerar todas
--     las tablas hijas. PostgreSQL se encarga de limpiar en cascada
--     (piezas, lineas_pedido, tareas_produccion, incidencias_tarea,
--     operarios_tareas_candidatos, reservas_stock, movimientos_pieza,
--     movimientos_stock, planificacion, albaranes, lineas_albaran, …).
--     Lo que NO está conectado por FK a pedidos/piezas queda intacto
--     (presupuestos, clientes, catálogos, configuración).
--
-- Mario está en pruebas y ha dado vía libre a borrar datos (23-abr-2026).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) BORRADO de datos transaccionales usando TRUNCATE CASCADE
-- ---------------------------------------------------------------------
-- TRUNCATE ... CASCADE sigue todas las FK ON DELETE y vacía las tablas
-- dependientes. RESTART IDENTITY no afecta a uuids pero no estorba.
--
-- Nota: TRUNCATE requiere ser owner de la tabla. En Supabase esto se
-- cumple ejecutando desde el SQL Editor con el rol service_role o
-- postgres (ambos los usa el editor web por defecto).

TRUNCATE TABLE
    pedidos,
    piezas,
    lotes,
    secuencias
  RESTART IDENTITY CASCADE;

-- Observación: presupuestos, lineas_presupuesto, clientes, materiales,
-- tratamientos, productos, tarifas, procesos_catalogo, categorias_pieza,
-- config_tiempos_proceso, ubicaciones, operarios, empresa → INTACTOS.


-- ---------------------------------------------------------------------
-- 2) Función definitiva generar_numero_secuencial()
-- ---------------------------------------------------------------------
-- Acepta los nombres en todos los formatos usados hoy por el código:
--
--   PRESUPUESTO → 'presupuesto' · 'PRES'
--   PEDIDO      → 'pedido'      · 'PED'
--   PIEZA       → 'pieza'       · 'PIE'
--   ALBARÁN     → 'albaran'     · 'ALB'
--   LOTE        → 'lote'        · 'LOT'
--
-- Normaliza en minúsculas para que sea case-insensitive. Cualquier tipo
-- desconocido devuelve NULL (detectable en el código TS que lanza
-- "No se pudo generar número").
--
-- Formato de salida: PREFIJO-YY-NNNN (año a 2 dígitos).

CREATE OR REPLACE FUNCTION generar_numero_secuencial(p_tipo TEXT)
RETURNS TEXT
LANGUAGE sql
AS $$
  WITH norm AS (
    SELECT lower(trim(p_tipo)) AS t
  ),
  tipo_info AS (
    SELECT
      CASE t
        WHEN 'presupuesto' THEN 'presupuesto'
        WHEN 'pres'        THEN 'presupuesto'
        WHEN 'pedido'      THEN 'pedido'
        WHEN 'ped'         THEN 'pedido'
        WHEN 'pieza'       THEN 'pieza'
        WHEN 'pie'         THEN 'pieza'
        WHEN 'albaran'     THEN 'albaran'
        WHEN 'albarán'     THEN 'albaran'
        WHEN 'alb'         THEN 'albaran'
        WHEN 'lote'        THEN 'lote'
        WHEN 'lot'         THEN 'lote'
      END AS canonico,
      CASE t
        WHEN 'presupuesto' THEN 'PRES'
        WHEN 'pres'        THEN 'PRES'
        WHEN 'pedido'      THEN 'PED'
        WHEN 'ped'         THEN 'PED'
        WHEN 'pieza'       THEN 'PIE'
        WHEN 'pie'         THEN 'PIE'
        WHEN 'albaran'     THEN 'ALB'
        WHEN 'albarán'     THEN 'ALB'
        WHEN 'alb'         THEN 'ALB'
        WHEN 'lote'        THEN 'LOT'
        WHEN 'lot'         THEN 'LOT'
      END AS prefijo
    FROM norm
  ),
  validado AS (
    SELECT
      canonico,
      prefijo,
      EXTRACT(YEAR FROM CURRENT_DATE)::int         AS anio_full,
      (EXTRACT(YEAR FROM CURRENT_DATE)::int % 100) AS anio_yy
    FROM tipo_info
    WHERE canonico IS NOT NULL
  ),
  upsert AS (
    INSERT INTO secuencias (id, anio, ultimo_numero)
    SELECT canonico, anio_full, 1 FROM validado
    ON CONFLICT (id, anio) DO UPDATE
      SET ultimo_numero = secuencias.ultimo_numero + 1
    RETURNING
      ultimo_numero,
      (SELECT prefijo FROM validado) AS prefijo,
      (SELECT anio_yy FROM validado) AS anio_yy
  )
  SELECT prefijo
         || '-' || lpad(anio_yy::text, 2, '0')
         || '-' || lpad(ultimo_numero::text, 4, '0')
  FROM upsert;
$$;

COMMENT ON FUNCTION generar_numero_secuencial(TEXT) IS
  'Genera PREFIJO-YY-NNNN. Acepta tipo en cualquier formato (PIE/PIEZA/pieza, etc). Arreglo bug Q, 23-abr-2026.';


-- ---------------------------------------------------------------------
-- 3) Verificación manual (ejecuta estas SELECT después de aplicar)
-- ---------------------------------------------------------------------
-- SELECT generar_numero_secuencial('PIE');         -- → PIE-26-0001
-- SELECT generar_numero_secuencial('pieza');       -- → PIE-26-0002
-- SELECT generar_numero_secuencial('PED');         -- → PED-26-0001
-- SELECT generar_numero_secuencial('presupuesto'); -- → PRES-26-0001
-- SELECT generar_numero_secuencial('alb');         -- → ALB-26-0001
-- SELECT generar_numero_secuencial('LOT');         -- → LOT-26-0001
-- SELECT * FROM secuencias ORDER BY id, anio;
--
-- Tras verificar, reset del contador de prueba:
-- TRUNCATE TABLE secuencias;


-- ---------------------------------------------------------------------
-- ROLLBACK (si algo va mal, aunque es prácticamente imposible)
-- ---------------------------------------------------------------------
-- No hay rollback del TRUNCATE (los datos eran de prueba).
-- Restaurar la función anterior:
--
--   CREATE OR REPLACE FUNCTION generar_numero_secuencial(p_tipo TEXT)
--   RETURNS TEXT AS $$
--   DECLARE
--     v_anio INTEGER; v_numero INTEGER; v_prefijo TEXT; v_resultado TEXT;
--   BEGIN
--     v_anio := EXTRACT(YEAR FROM CURRENT_DATE);
--     CASE p_tipo
--       WHEN 'presupuesto' THEN v_prefijo := 'PRES';
--       WHEN 'pedido'      THEN v_prefijo := 'PED';
--       WHEN 'albaran'     THEN v_prefijo := 'ALB';
--       WHEN 'pieza'       THEN v_prefijo := 'PIE';
--       WHEN 'lote'        THEN v_prefijo := 'LOT';
--       ELSE                    v_prefijo := 'DOC';
--     END CASE;
--     INSERT INTO secuencias (id, anio, ultimo_numero)
--     VALUES (p_tipo, v_anio, 1)
--     ON CONFLICT (id, anio) DO UPDATE SET ultimo_numero = secuencias.ultimo_numero + 1
--     RETURNING ultimo_numero INTO v_numero;
--     v_resultado := v_prefijo || '-' || v_anio || '-' || LPAD(v_numero::TEXT, 4, '0');
--     RETURN v_resultado;
--   END;
--   $$ LANGUAGE plpgsql;
