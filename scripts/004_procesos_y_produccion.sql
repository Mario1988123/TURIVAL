-- =====================================================================
-- 004 — PROCESOS, PRODUCCIÓN, SECUENCIAS, REFERENCIAS CLIENTE
-- =====================================================================
-- Este script reconstruye las tablas que v0 creó directamente desde
-- su UI y que NO estaban en los scripts 001/002/003 originales.
-- Idempotente: se puede ejecutar en un Supabase limpio o sobre uno
-- que ya tenga algunas de estas tablas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLA secuencias (numeración automática de documentos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secuencias (
  id TEXT PRIMARY KEY,
  anio INTEGER NOT NULL,
  ultimo_numero INTEGER DEFAULT 0,
  UNIQUE(id, anio)
);

-- Inicializar tipos de secuencias
INSERT INTO secuencias (id, anio, ultimo_numero) VALUES 
  ('presupuesto', 2026, 0),
  ('pedido', 2026, 0),
  ('albaran', 2026, 0),
  ('pieza', 2026, 0),
  ('lote', 2026, 0)
ON CONFLICT (id) DO NOTHING;

-- RLS secuencias
ALTER TABLE secuencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "secuencias_all" ON secuencias;
CREATE POLICY "secuencias_all" ON secuencias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 2. TABLA niveles_complejidad (simple / media / compleja)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS niveles_complejidad (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE, -- 'SIMPLE', 'MEDIA', 'COMPLEJA'
  nombre TEXT NOT NULL,
  multiplicador NUMERIC NOT NULL DEFAULT 1,
  descripcion TEXT,
  orden INTEGER NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE niveles_complejidad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "niveles_complejidad_select" ON niveles_complejidad;
CREATE POLICY "niveles_complejidad_select" ON niveles_complejidad
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "niveles_complejidad_admin" ON niveles_complejidad;
CREATE POLICY "niveles_complejidad_admin" ON niveles_complejidad
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 3. TABLA procesos_catalogo (9 procesos maestros de Turiaval)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procesos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  orden_tipico INTEGER NOT NULL,
  color_gantt TEXT DEFAULT '#3b82f6',
  permite_repetir BOOLEAN DEFAULT FALSE,
  es_tiempo_espera BOOLEAN DEFAULT FALSE,
  requiere_operario BOOLEAN DEFAULT TRUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_procesos_catalogo_orden 
  ON procesos_catalogo(orden_tipico);

ALTER TABLE procesos_catalogo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "procesos_catalogo_select" ON procesos_catalogo;
CREATE POLICY "procesos_catalogo_select" ON procesos_catalogo
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "procesos_catalogo_admin" ON procesos_catalogo;
CREATE POLICY "procesos_catalogo_admin" ON procesos_catalogo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 4. TABLA procesos_producto (qué procesos aplica cada producto)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procesos_producto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  proceso_id UUID NOT NULL REFERENCES procesos_catalogo(id) ON DELETE CASCADE,
  secuencia INTEGER NOT NULL,
  tiempo_base_minutos NUMERIC DEFAULT 0,
  tiempo_por_m2_minutos NUMERIC DEFAULT 0,
  factor_simple NUMERIC DEFAULT 0.8,
  factor_media NUMERIC DEFAULT 1.0,
  factor_compleja NUMERIC DEFAULT 1.3,
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(producto_id, proceso_id, secuencia)
);

CREATE INDEX IF NOT EXISTS idx_procesos_producto_producto 
  ON procesos_producto(producto_id);
CREATE INDEX IF NOT EXISTS idx_procesos_producto_proceso 
  ON procesos_producto(proceso_id);

ALTER TABLE procesos_producto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "procesos_producto_all" ON procesos_producto;
CREATE POLICY "procesos_producto_all" ON procesos_producto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 5. TABLA carros (carros de transporte entre procesos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  capacidad_piezas INTEGER,
  capacidad_m2 NUMERIC,
  ubicacion_actual TEXT,
  qr_code TEXT,
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE carros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "carros_all" ON carros;
CREATE POLICY "carros_all" ON carros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 6. TABLA empleados (operarios de producción)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  apellidos TEXT,
  dni TEXT,
  puesto TEXT,
  proceso_principal_id UUID REFERENCES procesos_catalogo(id) ON DELETE SET NULL,
  horas_dia NUMERIC DEFAULT 8,
  turno_horario TEXT,
  fecha_alta DATE DEFAULT CURRENT_DATE,
  fecha_baja DATE,
  activo BOOLEAN DEFAULT TRUE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empleados_all" ON empleados;
CREATE POLICY "empleados_all" ON empleados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 7. TABLA tareas_produccion (tareas reales en producción, vinculadas a piezas)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tareas_produccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pieza_id UUID NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
  proceso_id UUID NOT NULL REFERENCES procesos_catalogo(id) ON DELETE RESTRICT,
  secuencia INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_progreso', 'pausada', 'completada', 'cancelada')),
  tiempo_estimado_minutos NUMERIC,
  tiempo_real_minutos NUMERIC,
  fecha_inicio_planificada TIMESTAMPTZ,
  fecha_fin_planificada TIMESTAMPTZ,
  fecha_inicio_real TIMESTAMPTZ,
  fecha_fin_real TIMESTAMPTZ,
  carro_id UUID REFERENCES carros(id) ON DELETE SET NULL,
  empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
  nivel_complejidad_aplicado INTEGER REFERENCES niveles_complejidad(id),
  superficie_m2_aplicada NUMERIC,
  notas_operario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tareas_pieza ON tareas_produccion(pieza_id);
CREATE INDEX IF NOT EXISTS idx_tareas_proceso ON tareas_produccion(proceso_id);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas_produccion(estado);
CREATE INDEX IF NOT EXISTS idx_tareas_empleado ON tareas_produccion(empleado_id);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_plan ON tareas_produccion(fecha_inicio_planificada);

ALTER TABLE tareas_produccion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tareas_produccion_all" ON tareas_produccion;
CREATE POLICY "tareas_produccion_all" ON tareas_produccion
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 8. TABLA referencias_cliente (piezas guardadas por cliente)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referencias_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  referencia_cliente TEXT NOT NULL,
  referencia_interna TEXT,
  nombre_pieza TEXT,
  descripcion TEXT,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  dimensiones_habituales JSONB, -- {ancho, alto, grosor}
  superficie_m2_habitual NUMERIC,
  color_id UUID REFERENCES colores(id) ON DELETE SET NULL,
  tratamiento_id UUID REFERENCES tratamientos(id) ON DELETE SET NULL,
  tarifa_id UUID REFERENCES tarifas(id) ON DELETE SET NULL,
  acabado_id UUID,
  acabado_texto TEXT,
  nivel_complejidad INTEGER REFERENCES niveles_complejidad(id),
  precio_pactado NUMERIC,
  observaciones TEXT,
  notas_ia TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_id, referencia_cliente)
);

CREATE INDEX IF NOT EXISTS idx_referencias_cliente_cliente 
  ON referencias_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_referencias_cliente_ref 
  ON referencias_cliente(referencia_cliente);

ALTER TABLE referencias_cliente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referencias_cliente_all" ON referencias_cliente;
CREATE POLICY "referencias_cliente_all" ON referencias_cliente
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 9. Triggers updated_at
-- ---------------------------------------------------------------------
-- Asume que la función update_updated_at_column() ya existe del script 001
-- Si no existe, se crea aquí por seguridad
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a las tablas con updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'procesos_producto',
      'carros',
      'empleados',
      'tareas_produccion',
      'referencias_cliente'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON %s',
      t, t
    );
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      t, t
    );
  END LOOP;
END $$;
