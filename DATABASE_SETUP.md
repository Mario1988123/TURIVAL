# Instrucciones de Setup de Base de Datos - ERP Lacados

## Paso 1: Acceder a Supabase SQL Editor

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú izquierdo, haz clic en **SQL Editor**
4. Haz clic en **+ New Query**

## Paso 2: Crear el Esquema

Copia y pega el SQL siguiente en el editor y ejecuta:

```sql
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

-- 3. PRODUCTOS
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
  tiempo_estimado_base INTEGER,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ACABADOS
CREATE TABLE IF NOT EXISTS acabados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  color_id UUID REFERENCES colores(id),
  tratamiento_id UUID REFERENCES tratamientos(id),
  acabado TEXT,
  brillo INTEGER,
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
  tiempo_estimado_m2 INTEGER,
  tiempo_estimado_pieza INTEGER,
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
  dimensiones_habituales JSONB,
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
  id TEXT PRIMARY KEY,
  anio INTEGER NOT NULL,
  ultimo_numero INTEGER DEFAULT 0,
  UNIQUE(id, anio)
);

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
  numero TEXT NOT NULL UNIQUE,
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
  tiempo_estimado_total INTEGER,
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
  ancho DECIMAL(10,2),
  alto DECIMAL(10,2),
  grosor DECIMAL(10,2),
  unidad TEXT DEFAULT 'mm',
  cara_frontal BOOLEAN DEFAULT true,
  cara_trasera BOOLEAN DEFAULT false,
  canto_superior BOOLEAN DEFAULT false,
  canto_inferior BOOLEAN DEFAULT false,
  canto_izquierdo BOOLEAN DEFAULT false,
  canto_derecho BOOLEAN DEFAULT false,
  superficie_m2 DECIMAL(10,4),
  precio_unitario DECIMAL(10,2),
  precio_m2 DECIMAL(10,2),
  precio_pieza DECIMAL(10,2),
  precio_minimo DECIMAL(10,2) DEFAULT 0,
  color_id UUID REFERENCES colores(id),
  tratamiento_id UUID REFERENCES tratamientos(id),
  acabado_id UUID REFERENCES acabados(id),
  acabado_texto TEXT,
  extras JSONB,
  suplemento_manual DECIMAL(10,2) DEFAULT 0,
  suplemento_descripcion TEXT,
  total_linea DECIMAL(12,2) NOT NULL DEFAULT 0,
  tiempo_estimado INTEGER,
  notas TEXT,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. PEDIDOS
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
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
  codigo TEXT NOT NULL UNIQUE,
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

-- 14. PIEZAS
CREATE TABLE IF NOT EXISTS piezas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  qr_data TEXT NOT NULL UNIQUE,
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

-- 15. FASES DE PRODUCCION
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

-- 16. CAPACIDAD DIARIA
CREATE TABLE IF NOT EXISTS capacidad_diaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  capacidad_disponible_minutos INTEGER NOT NULL,
  capacidad_asignada_minutos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. PLANIFICACION
CREATE TABLE IF NOT EXISTS planificacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  pieza_id UUID NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
  fase_id UUID REFERENCES fases_produccion(id),
  prioridad TEXT DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
  duracion_minutos INTEGER,
  operario_asignado UUID REFERENCES profiles(id),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'asignado', 'en_proceso', 'completado')),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. ALBARANES
CREATE TABLE IF NOT EXISTS albaranes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'impreso', 'entregado')),
  fecha_entrega DATE NOT NULL,
  observaciones TEXT,
  firma_cliente TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. LINEAS DE ALBARAN
CREATE TABLE IF NOT EXISTS lineas_albaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  albaran_id UUID NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
  pieza_id UUID REFERENCES piezas(id),
  lote_id UUID REFERENCES lotes(id),
  descripcion TEXT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  observaciones TEXT
);

-- 20. PAGOS
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  importe DECIMAL(12,2) NOT NULL,
  fecha_pago DATE NOT NULL,
  metodo_pago TEXT,
  referencia_transaccion TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. HISTORIAL PAGOS
CREATE TABLE IF NOT EXISTS historial_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  importe_anterior DECIMAL(12,2),
  importe_nuevo DECIMAL(12,2),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. OCR DOCUMENTOS
CREATE TABLE IF NOT EXISTS ocr_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  archivo_url TEXT NOT NULL,
  texto_extraido TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesado', 'validado', 'rechazado')),
  datos_extraidos JSONB,
  referencia_pedido TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDICES PARA PERFORMANCE
CREATE INDEX idx_clientes_user_id ON clientes(user_id);
CREATE INDEX idx_clientes_tipo ON clientes(tipo);
CREATE INDEX idx_presupuestos_cliente_id ON presupuestos(cliente_id);
CREATE INDEX idx_presupuestos_estado ON presupuestos(estado);
CREATE INDEX idx_pedidos_cliente_id ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha_entrada ON pedidos(fecha_entrada);
CREATE INDEX idx_piezas_pedido_id ON piezas(pedido_id);
CREATE INDEX idx_piezas_estado ON piezas(estado);
CREATE INDEX idx_lotes_pedido_id ON lotes(pedido_id);
CREATE INDEX idx_fases_pieza_id ON fases_produccion(pieza_id);
CREATE INDEX idx_lineas_presupuesto_presupuesto_id ON lineas_presupuesto(presupuesto_id);
CREATE INDEX idx_referencias_cliente_id ON referencias_cliente(cliente_id);
CREATE INDEX idx_planificacion_fecha ON planificacion(fecha_inicio);
CREATE INDEX idx_albaranes_pedido_id ON albaranes(pedido_id);
```

## Paso 3: Habilitar Row Level Security (RLS)

Crea una nueva query y ejecuta:

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE colores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tratamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acabados ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencias_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_presupuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE piezas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fases_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacidad_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE planificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE albaranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_albaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_documentos ENABLE ROW LEVEL SECURITY;

-- PERMISOS BASICOS POR ROL
-- Admins: acceso total a todo
CREATE POLICY "admin_all_access" ON profiles FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON clientes FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON productos FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON colores FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON tratamientos FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON acabados FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON tarifas FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON referencias_cliente FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON presupuestos FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON lineas_presupuesto FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON pedidos FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON lotes FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON piezas FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON fases_produccion FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON capacidad_diaria FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON planificacion FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON albaranes FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON lineas_albaran FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON pagos FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON historial_pagos FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_access" ON ocr_documentos FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Usuarios: lectura de datos de su empresa + escritura en sus documentos
CREATE POLICY "usuarios_can_read" ON clientes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "usuarios_can_read" ON presupuestos FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "usuarios_can_write" ON presupuestos FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "usuarios_can_write" ON presupuestos FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "usuarios_can_read" ON pedidos FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "usuarios_can_write" ON pedidos FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "usuarios_can_write" ON pedidos FOR UPDATE USING (user_id = auth.uid());

-- Operarios: acceso a piezas y fases de producción
CREATE POLICY "operarios_can_read" ON piezas FOR SELECT USING (auth.jwt() ->> 'role' = 'operario');
CREATE POLICY "operarios_can_update" ON piezas FOR UPDATE USING (auth.jwt() ->> 'role' = 'operario');
CREATE POLICY "operarios_can_read" ON fases_produccion FOR SELECT USING (auth.jwt() ->> 'role' = 'operario');
CREATE POLICY "operarios_can_update" ON fases_produccion FOR UPDATE USING (auth.jwt() ->> 'role' = 'operario');
```

## Paso 4: Verificar Setup

Después de ejecutar ambas queries, verifica que:
1. Tienes 22 tablas creadas
2. RLS está habilitado en todas las tablas
3. Los índices se han creado correctamente

¡Tu base de datos está lista!
