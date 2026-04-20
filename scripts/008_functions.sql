-- =====================================================================
-- 008 — FUNCIONES AUXILIARES BD
-- =====================================================================
-- Contiene las funciones SQL necesarias para la generación de números
-- secuenciales de documentos (presupuestos, pedidos, albaranes...).
-- NOTA: el 001_create_schema.sql YA tenía 'generar_numero_secuencial'
-- pero en entornos donde ese script no se ejecutó completo, esta versión
-- la reinstala. Además crea el alias 'get_next_sequence' usado por el
-- código frontend vía supabase.rpc().
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Función principal: generar_numero_secuencial(p_tipo)
-- ---------------------------------------------------------------------
-- Dada una clave ('presupuesto', 'pedido', 'albaran', 'pieza', 'lote')
-- devuelve el siguiente número formateado: PRES-2026-0001, PED-2026-0042...
-- Si cambia el año, reinicia el contador.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generar_numero_secuencial(p_tipo TEXT)
RETURNS TEXT AS $$
DECLARE
  v_anio INTEGER;
  v_numero INTEGER;
  v_prefijo TEXT;
  v_resultado TEXT;
BEGIN
  v_anio := EXTRACT(YEAR FROM CURRENT_DATE);
  
  CASE p_tipo
    WHEN 'presupuesto' THEN v_prefijo := 'PRES';
    WHEN 'pedido'      THEN v_prefijo := 'PED';
    WHEN 'albaran'     THEN v_prefijo := 'ALB';
    WHEN 'pieza'       THEN v_prefijo := 'PIE';
    WHEN 'lote'        THEN v_prefijo := 'LOT';
    ELSE                    v_prefijo := 'DOC';
  END CASE;
  
  INSERT INTO secuencias (id, anio, ultimo_numero)
  VALUES (p_tipo, v_anio, 1)
  ON CONFLICT (id) DO UPDATE
  SET ultimo_numero = 
    CASE 
      WHEN secuencias.anio = v_anio THEN secuencias.ultimo_numero + 1
      ELSE 1
    END,
    anio = v_anio
  RETURNING ultimo_numero INTO v_numero;
  
  v_resultado := v_prefijo || '-' || v_anio || '-' || LPAD(v_numero::TEXT, 4, '0');
  
  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------
-- 2. Alias get_next_sequence(tipo) — usado por el código frontend
-- ---------------------------------------------------------------------
-- Envuelve a generar_numero_secuencial. Se crea como alias por si otra
-- migración previa dejó una versión incompatible (DROP + CREATE limpio).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_next_sequence(text);

CREATE OR REPLACE FUNCTION get_next_sequence(tipo TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN generar_numero_secuencial(tipo);
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------
-- 3. Función update_updated_at_column (por si no existe)
-- ---------------------------------------------------------------------
-- Ya se definió en 001 y 004, pero aquí va por si se ejecuta 008 sin
-- los anteriores en un entorno limpio.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------
-- 4. Función calcular_superficie_m2 (para motor de cálculo)
-- ---------------------------------------------------------------------
-- Dado ancho, alto, grosor en mm y los booleanos de caras, calcula
-- la superficie a lacar en m². Regla: grosor>19 mm → cantos sí suman.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calcular_superficie_m2(
  p_ancho_mm NUMERIC,
  p_alto_mm NUMERIC,
  p_grosor_mm NUMERIC,
  p_cara_frontal BOOLEAN,
  p_cara_trasera BOOLEAN,
  p_canto_superior BOOLEAN,
  p_canto_inferior BOOLEAN,
  p_canto_izquierdo BOOLEAN,
  p_canto_derecho BOOLEAN,
  p_cantidad INTEGER DEFAULT 1
)
RETURNS NUMERIC AS $$
DECLARE
  v_ancho_m NUMERIC := COALESCE(p_ancho_mm, 0) / 1000;
  v_alto_m  NUMERIC := COALESCE(p_alto_mm, 0) / 1000;
  v_grosor_m NUMERIC := COALESCE(p_grosor_mm, 0) / 1000;
  v_superficie NUMERIC := 0;
  v_cuentan_cantos BOOLEAN;
BEGIN
  IF p_cara_frontal THEN v_superficie := v_superficie + v_ancho_m * v_alto_m; END IF;
  IF p_cara_trasera THEN v_superficie := v_superficie + v_ancho_m * v_alto_m; END IF;
  
  v_cuentan_cantos := (p_grosor_mm > 19);
  IF v_cuentan_cantos THEN
    IF p_canto_superior THEN v_superficie := v_superficie + v_ancho_m * v_grosor_m; END IF;
    IF p_canto_inferior THEN v_superficie := v_superficie + v_ancho_m * v_grosor_m; END IF;
    IF p_canto_izquierdo THEN v_superficie := v_superficie + v_alto_m * v_grosor_m; END IF;
    IF p_canto_derecho THEN v_superficie := v_superficie + v_alto_m * v_grosor_m; END IF;
  END IF;
  
  RETURN ROUND(v_superficie * COALESCE(p_cantidad, 1), 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
