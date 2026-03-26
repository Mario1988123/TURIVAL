-- =====================================================
-- ERP/CRM LACADOS - ESQUEMA COMPLETO
-- =====================================================

-- 1. PERFILES DE USUARIO (extiende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario', 'operario')),
  activo BOOLEAN DEFAULT true,
  fecha_alta TIMESTAMPTZ DEFAULT NOW(),
  ultima_actividad TIMESTAMPTZ
);

-- 2. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'precliente' CHECK (tipo IN ('precliente', 'cliente_activo', 'cliente_recurrente')),
  nombre_comercial TEXT NOT NULL,
  razon_social TEXT,
  cif_nif TEXT,
  persona_contacto TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  codigo_postal TEXT,
  ciudad TEXT,
  provincia TEXT,
  notas TEXT,
  origen TEXT,
  observaciones_internas TEXT,
  frecuencia_trabajo TEXT,
  condiciones_pago TEXT DEFAULT '30 dias',
  descuento_general DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 3. PRODUCTOS / TIPOS DE PIEZA
CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT,
  descripcion TEXT,
  unidad_tarificacion TEXT DEFAULT 'm2' CHECK (unidad_tarificacion IN ('m2', 'pieza')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. COLORES
CREATE TABLE IF NOT EXISTS colores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('RAL', 'NCS', 'referencia_interna', 'muestra_cliente')),
  hex_aproximado TEXT,
  observaciones TEXT,
  sobrecoste DECIMAL(10,2) DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRATAMIENTOS
CREATE TABLE IF NOT EXISTS tratamientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  multiplicador_coste DECIMAL(5,2) DEFAULT 1.0,
  tiempo_estimado_base INTEGER, -- minutos
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ACABADOS (referencia interna completa)
CREATE TABLE IF NOT EXISTS acabados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE, -- LAC-RAL9010-MATE-FONDO-2026-0012
  color_id UUID REFERENCES colores(id),
  tratamiento_id UUID REFERENCES tratamientos(id),
  acabado TEXT, -- mate, satinado, brillo
  brillo INTEGER, -- porcentaje 0-100
  textura TEXT,
  notas_tecnicas TEXT,
  ficha_tecnica JSONB,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TARIFAS
CREATE TABLE IF NOT EXISTS tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  producto_id UUID REFERENCES productos(id),
  modo_precio TEXT NOT NULL CHECK (modo_precio IN ('m2', 'pieza', 'ambos')),
  precio_m2 DECIMAL(10,2),
  precio_pieza DECIMAL(10,2),
  precio_minimo DECIMAL(10,2) DEFAULT 0,
  coste_adicional_color DECIMAL(10,2) DEFAULT 0,
  coste_adicional_tratamiento DECIMAL(10,2) DEFAULT 0,
  coste_adicional_embalaje DECIMAL(10,2) DEFAULT 0,
  tiempo_estimado_m2 INTEGER, -- minutos por m2
  tiempo_estimado_pieza INTEGER, -- minutos por pieza
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. REFERENCIAS DE CLIENTE
CREATE TABLE IF NOT EXISTS referencias_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  referencia_cliente TEXT NOT NULL,
  referencia_interna TEXT,
  descripcion TEXT,
  producto_id UUID REFERENCES productos(id),
  dimensiones_habituales JSONB, -- {ancho, alto, grosor}
  color_id UUID REFERENCES colores(id),
  tratamiento_id UUID REFERENCES tratamientos(id),
  tarifa_id UUID REFERENCES tarifas(id),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_id, referencia_cliente)
);

-- 9. SECUENCIAS PARA NUMERACION
CREATE TABLE IF NOT EXISTS secuencias (
  id TEXT PRIMARY KEY, -- 'presupuesto', 'pedido', 'albaran', 'pieza', 'lote'
  anio INTEGER NOT NULL,
  ultimo_numero INTEGER DEFAULT 0,
  UNIQUE(id, anio)
);

-- Inicializar secuencias
INSERT INTO secuencias (id, anio, ultimo_numero) VALUES 
  ('presupuesto', 2026, 0),
  ('pedido', 2026, 0),
  ('albaran', 2026, 0),
  ('pieza', 2026, 0),
  ('lote', 2026, 0)
ON CONFLICT (id) DO NOTHING;

-- 10. PRESUPUESTOS
CREATE TABLE IF NOT EXISTS presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE, -- PRES-2026-0001
  fecha DATE DEFAULT CURRENT_DATE,
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviado', 'aceptado', 'rechazado', 'caducado')),
  validez_dias INTEGER DEFAULT 30,
  observaciones_comerciales TEXT,
  observaciones_internas TEXT,
  subtotal DECIMAL(12,2) DEFAULT 0,
  descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
  descuento_importe DECIMAL(12,2) DEFAULT 0,
  base_imponible DECIMAL(12,2) DEFAULT 0,
  iva_porcentaje DECIMAL(5,2) DEFAULT 21,
  iva_importe DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  margen_estimado DECIMAL(5,2),
  tiempo_estimado_total INTEGER, -- minutos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 11. LINEAS DE PRESUPUESTO
CREATE TABLE IF NOT EXISTS lineas_presupuesto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  tarifa_id UUID REFERENCES tarifas(id),
  descripcion TEXT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  modo_precio TEXT NOT NULL CHECK (modo_precio IN ('m2', 'pieza')),
  -- Dimensiones en mm
  ancho DECIMAL(10,2),
  alto DECIMAL(10,2),
  grosor DECIMAL(10,2),
  unidad TEXT DEFAULT 'mm',
  -- Caras a lacar
  cara_frontal BOOLEAN DEFAULT true,
  cara_trasera BOOLEAN DEFAULT false,
  canto_superior BOOLEAN DEFAULT false,
  canto_inferior BOOLEAN DEFAULT false,
  canto_izquierdo BOOLEAN DEFAULT false,
  canto_derecho BOOLEAN DEFAULT false,
  -- Calculos
  superficie_m2 DECIMAL(10,4),
  precio_unitario DECIMAL(10,2),
  precio_m2 DECIMAL(10,2),
  precio_pieza DECIMAL(10,2),
  precio_minimo DECIMAL(10,2) DEFAULT 0,
  -- Acabado
  color_id UUID REFERENCES colores(id),
  tratamiento_id UUID REFERENCES tratamientos(id),
  acabado_id UUID REFERENCES acabados(id),
  acabado_texto TEXT, -- descripcion libre del acabado
  extras JSONB,
  suplemento_manual DECIMAL(10,2) DEFAULT 0,
  suplemento_descripcion TEXT,
  total_linea DECIMAL(12,2) NOT NULL DEFAULT 0,
  tiempo_estimado INTEGER, -- minutos
  notas TEXT,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. PEDIDOS / ORDENES DE TRABAJO
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE, -- PED-2026-0001
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  presupuesto_id UUID REFERENCES presupuestos(id),
  origen TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('presupuesto', 'ocr', 'manual')),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_produccion', 'pausado', 'terminado', 'entregado', 'cancelado')),
  fecha_entrada DATE DEFAULT CURRENT_DATE,
  fecha_prevista_entrega DATE,
  fecha_entrega_real DATE,
  prioridad TEXT DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
  observaciones_internas TEXT,
  observaciones_cliente TEXT,
  total_estimado DECIMAL(12,2),
  total_final DECIMAL(12,2),
  forma_pago TEXT,
  estado_pago TEXT DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'parcial', 'pagado')),
  porcentaje_avance INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 13. LOTES
CREATE TABLE IF NOT EXISTS lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE, -- LOT-2026-0001
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  descripcion TEXT,
  color_id UUID REFERENCES colores(id),
  tratamiento_id UUID REFERENCES tratamientos(id),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'terminado', 'incidencia')),
  total_piezas INTEGER DEFAULT 0,
  piezas_terminadas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. PIEZAS / TRABAJOS
CREATE TABLE IF NOT EXISTS piezas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE, -- PIE-2026-00001
  qr_data TEXT NOT NULL UNIQUE, -- Datos para QR (URL completa)
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  lote_id UUID REFERENCES lotes(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  referencia_cliente TEXT,
  producto_id UUID REFERENCES productos(id),
  acabado_id UUID REFERENCES acabados(id),
  cantidad INTEGER DEFAULT 1,
  ancho DECIMAL(10,2),
  alto DECIMAL(10,2),
  grosor DECIMAL(10,2),
  superficie_m2 DECIMAL(10,4),
  modo_precio TEXT CHECK (modo_precio IN ('m2', 'pieza')),
  color_id UUID REFERENCES colores(id),
  tratamiento_id UUID REFERENCES tratamientos(id),
  acabado_texto TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'terminado', 'incidencia', 'cancelado')),
  fase_actual TEXT,
  observaciones TEXT,
  tiempo_estimado INTEGER,
  tiempo_real INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. FASES DE PRODUCCION (checklist)
CREATE TABLE IF NOT EXISTS fases_produccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pieza_id UUID NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
  fase TEXT NOT NULL CHECK (fase IN ('recepcion', 'lijado', 'fondo', 'lacado', 'secado', 'manipulado', 'terminacion', 'empaquetado', 'listo_entrega')),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completado', 'incidencia')),
  orden INTEGER NOT NULL,
  inicio TIMESTAMPTZ,
  fin TIMESTAMPTZ,
  duracion_minutos INTEGER,
  operario_id UUID REFERENCES profiles(id),
  observaciones TEXT,
  incidencias TEXT,
  validacion_ok BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. CONFIGURACION DE CAPACIDAD
CREATE TABLE IF NOT EXISTS capacidad_diaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  cabinas_operativas INTEGER DEFAULT 4,
  capacidad_m2 DECIMAL(10,2),
  carga_asignada_m2 DECIMAL(10,2) DEFAULT 0,
  notas TEXT
);

-- 17. PLANIFICACION
CREATE TABLE IF NOT EXISTS planificacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  lote_id UUID REFERENCES lotes(id),
  pieza_id UUID REFERENCES piezas(id),
  cabina INTEGER,
  hora_inicio TIME,
  hora_fin TIME,
  duracion_estimada INTEGER,
  estado TEXT DEFAULT 'planificado' CHECK (estado IN ('planificado', 'en_proceso', 'completado', 'cancelado')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. ALBARANES
CREATE TABLE IF NOT EXISTS albaranes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE, -- ALB-2026-0001
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  fecha DATE DEFAULT CURRENT_DATE,
  direccion_entrega TEXT,
  observaciones TEXT,
  subtotal DECIMAL(12,2) DEFAULT 0,
  iva_porcentaje DECIMAL(5,2) DEFAULT 21,
  iva_importe DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  estado TEXT DEFAULT 'emitido' CHECK (estado IN ('emitido', 'entregado', 'firmado')),
  validacion_entrega BOOLEAN DEFAULT false,
  firma_cliente TEXT, -- base64 de firma
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 19. LINEAS DE ALBARAN
CREATE TABLE IF NOT EXISTS lineas_albaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  albaran_id UUID NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
  pieza_id UUID REFERENCES piezas(id),
  descripcion TEXT,
  cantidad INTEGER DEFAULT 1,
  precio_unitario DECIMAL(10,2),
  importe DECIMAL(10,2)
);

-- 20. PAGOS
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos(id),
  albaran_id UUID REFERENCES albaranes(id),
  forma_pago TEXT CHECK (forma_pago IN ('transferencia', 'efectivo', 'tarjeta', 'pagare', 'domiciliacion', 'otros')),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagado')),
  fecha_vencimiento DATE,
  fecha_cobro DATE,
  importe_total DECIMAL(12,2),
  importe_cobrado DECIMAL(12,2) DEFAULT 0,
  importe_pendiente DECIMAL(12,2),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. HISTORIAL DE PAGOS
CREATE TABLE IF NOT EXISTS historial_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id UUID NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  importe DECIMAL(12,2) NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  forma_pago TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. PLANTILLAS DE NOTIFICACION
CREATE TABLE IF NOT EXISTS plantillas_notificacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL, -- avance_30, avance_70, finalizado, listo_entrega
  asunto TEXT NOT NULL,
  contenido TEXT NOT NULL, -- HTML con variables {{cliente}}, {{porcentaje}}, etc.
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. NOTIFICACIONES ENVIADAS
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos(id),
  cliente_id UUID REFERENCES clientes(id),
  plantilla_id UUID REFERENCES plantillas_notificacion(id),
  email_destino TEXT,
  asunto TEXT,
  contenido TEXT,
  estado TEXT DEFAULT 'enviado',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. OCR DOCUMENTOS
CREATE TABLE IF NOT EXISTS ocr_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo_url TEXT NOT NULL,
  archivo_nombre TEXT,
  texto_extraido TEXT,
  campos_detectados JSONB,
  coincidencias JSONB,
  advertencias JSONB,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesado', 'revisado', 'convertido', 'error')),
  pedido_generado_id UUID REFERENCES pedidos(id),
  cliente_id UUID REFERENCES clientes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- =====================================================
-- INDICES PARA RENDIMIENTO
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON clientes(tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre_comercial);
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON clientes(user_id);

CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente ON presupuestos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado ON presupuestos(estado);
CREATE INDEX IF NOT EXISTS idx_presupuestos_fecha ON presupuestos(fecha);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_entrada);

CREATE INDEX IF NOT EXISTS idx_piezas_pedido ON piezas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_piezas_lote ON piezas(lote_id);
CREATE INDEX IF NOT EXISTS idx_piezas_estado ON piezas(estado);
CREATE INDEX IF NOT EXISTS idx_piezas_qr ON piezas(qr_data);

CREATE INDEX IF NOT EXISTS idx_fases_pieza ON fases_produccion(pieza_id);
CREATE INDEX IF NOT EXISTS idx_fases_estado ON fases_produccion(estado);

CREATE INDEX IF NOT EXISTS idx_albaranes_pedido ON albaranes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_albaranes_cliente ON albaranes(cliente_id);

CREATE INDEX IF NOT EXISTS idx_referencias_cliente ON referencias_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_referencias_ref ON referencias_cliente(referencia_cliente);

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Funcion para generar numeros secuenciales
CREATE OR REPLACE FUNCTION generar_numero_secuencial(p_tipo TEXT)
RETURNS TEXT AS $$
DECLARE
  v_anio INTEGER;
  v_numero INTEGER;
  v_prefijo TEXT;
  v_resultado TEXT;
BEGIN
  v_anio := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Determinar prefijo
  CASE p_tipo
    WHEN 'presupuesto' THEN v_prefijo := 'PRES';
    WHEN 'pedido' THEN v_prefijo := 'PED';
    WHEN 'albaran' THEN v_prefijo := 'ALB';
    WHEN 'pieza' THEN v_prefijo := 'PIE';
    WHEN 'lote' THEN v_prefijo := 'LOT';
    ELSE v_prefijo := 'DOC';
  END CASE;
  
  -- Insertar o actualizar secuencia
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
  
  -- Formatear resultado
  v_resultado := v_prefijo || '-' || v_anio || '-' || LPAD(v_numero::TEXT, 4, '0');
  
  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

-- Funcion para calcular superficie con caras
CREATE OR REPLACE FUNCTION calcular_superficie_m2(
  p_ancho DECIMAL,
  p_alto DECIMAL,
  p_grosor DECIMAL,
  p_cantidad INTEGER,
  p_cara_frontal BOOLEAN,
  p_cara_trasera BOOLEAN,
  p_canto_superior BOOLEAN,
  p_canto_inferior BOOLEAN,
  p_canto_izquierdo BOOLEAN,
  p_canto_derecho BOOLEAN
)
RETURNS DECIMAL AS $$
DECLARE
  v_ancho_m DECIMAL;
  v_alto_m DECIMAL;
  v_grosor_m DECIMAL;
  v_superficie DECIMAL := 0;
BEGIN
  -- Convertir mm a metros
  v_ancho_m := COALESCE(p_ancho, 0) / 1000;
  v_alto_m := COALESCE(p_alto, 0) / 1000;
  v_grosor_m := COALESCE(p_grosor, 0) / 1000;
  
  -- Calcular superficie de cada cara seleccionada
  IF p_cara_frontal THEN v_superficie := v_superficie + (v_ancho_m * v_alto_m); END IF;
  IF p_cara_trasera THEN v_superficie := v_superficie + (v_ancho_m * v_alto_m); END IF;
  IF p_canto_superior THEN v_superficie := v_superficie + (v_ancho_m * v_grosor_m); END IF;
  IF p_canto_inferior THEN v_superficie := v_superficie + (v_ancho_m * v_grosor_m); END IF;
  IF p_canto_izquierdo THEN v_superficie := v_superficie + (v_alto_m * v_grosor_m); END IF;
  IF p_canto_derecho THEN v_superficie := v_superficie + (v_alto_m * v_grosor_m); END IF;
  
  -- Multiplicar por cantidad
  RETURN v_superficie * COALESCE(p_cantidad, 1);
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas con updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['clientes', 'presupuestos', 'pedidos', 'lotes', 'piezas', 'tarifas', 'referencias_cliente', 'pagos'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END;
$$;
