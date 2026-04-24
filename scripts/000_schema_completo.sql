-- =====================================================================
-- 000_schema_completo.sql
-- Schema y datos semilla completos de TURIVAL extraídos del Supabase
-- de producción (proyecto oakkoouczwmipomacewh) el 24-abr-2026.
--
-- OBJETIVO: permitir reinstalar TURIVAL en cualquier PostgreSQL 14+
-- desde un estado vacío con un único fichero.
--
-- CONTENIDO (en este orden):
--   1) Extensiones
--   2) Tablas (45)
--   3) Constraints (PK, UNIQUE, CHECK, FK)
--   4) Índices no-constraint
--   5) Funciones y triggers
--   6) RLS (enable + políticas)
--   7) Datos semilla:
--        - colores_legacy (272 RAL + NCS)
--        - catálogos pequeños (procesos, tratamientos, niveles,
--          categorías, proveedores, ubicaciones, operarios, carros,
--          productos, config_tiempos_proceso)
--        - materiales (275: 272 lacados + 1 fondo + catalizador +
--          disolvente) -- depende de proveedores, por eso va después
--        - configuracion_empresa + secuencias -- dependen de materiales
--
-- DATOS EXCLUIDOS (transaccionales): clientes, presupuestos, pedidos,
-- piezas, tareas, reservas. Migrar por pg_dump si hiciera falta, y
-- antes provisionar los usuarios en auth.users (user_id tiene FK).
--
-- Idempotente: todas las tablas usan CREATE TABLE IF NOT EXISTS,
-- índices CREATE INDEX IF NOT EXISTS, triggers DROP+CREATE, policies
-- DROP+CREATE, y seeds ON CONFLICT DO NOTHING. Los ALTER TABLE ADD
-- CONSTRAINT fallarán en re-ejecución — diseñado para BD limpia.
--
-- NOTA Supabase: este dump NO incluye el schema auth.* ni storage.*.
-- En un PostgreSQL estándar (sin Supabase) las FK a auth.users
-- fallarán y los roles authenticated / anon no existen. Antes de
-- ejecutar en Postgres nativo:
--   CREATE SCHEMA IF NOT EXISTS auth;
--   CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
--   CREATE ROLE authenticated;
--   CREATE ROLE anon;
--
-- =====================================================================


-- =====================================================================
-- 1) EXTENSIONES
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- pg_graphql, pg_stat_statements, supabase_vault: específicas de
-- Supabase, se omiten en migración a Postgres nativo.


-- =====================================================================
-- 2) TABLAS
-- =====================================================================
-- ---------- TABLAS (45) ----------

CREATE TABLE IF NOT EXISTS public.acabados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  color_id uuid,
  tratamiento_id uuid,
  acabado text,
  brillo integer,
  textura text,
  notas_tecnicas text,
  ficha_tecnica jsonb,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ajustes_rendimiento_pendientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tarea_id uuid NOT NULL,
  tipo text NOT NULL,
  superficie_m2 numeric NOT NULL,
  kg_teoricos_mezcla numeric NOT NULL,
  kg_merma_total numeric NOT NULL,
  merma_porcentaje numeric NOT NULL,
  rendimiento_actual_kg_m2 numeric NOT NULL,
  rendimiento_sugerido_kg_m2 numeric NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente'::text,
  creado_at timestamptz NOT NULL DEFAULT now(),
  resuelto_at timestamptz,
  resuelto_por uuid,
  notas text
);

CREATE TABLE IF NOT EXISTS public.albaranes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  pedido_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  estado text DEFAULT 'borrador'::text,
  fecha_entrega date NOT NULL,
  observaciones text,
  firma_cliente text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.avisos_cliente (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid,
  pedido_id uuid,
  pieza_id uuid,
  tipo text NOT NULL,
  canal text,
  mensaje text NOT NULL,
  enviado boolean DEFAULT false,
  fecha_envio timestamptz,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.capacidad_diaria (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  capacidad_disponible_minutos integer NOT NULL,
  capacidad_asignada_minutos integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.carros (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  capacidad_piezas integer,
  capacidad_m2 numeric(6,2),
  ubicacion_actual text,
  qr_code text,
  notas text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categorias_pieza (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  color text DEFAULT '#64748b'::text,
  caras_default integer NOT NULL DEFAULT 6,
  contabilizar_grosor_default boolean NOT NULL DEFAULT false,
  modo_precio_default text NOT NULL DEFAULT 'm2'::text,
  permite_ml boolean NOT NULL DEFAULT false,
  procesos_default jsonb NOT NULL DEFAULT '[]'::jsonb,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categorias_producto (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  color text DEFAULT '#64748b'::text,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'precliente'::text,
  nombre_comercial text NOT NULL,
  razon_social text,
  cif_nif text,
  persona_contacto text,
  email text,
  telefono text,
  direccion text,
  codigo_postal text,
  ciudad text,
  provincia text,
  notas text,
  origen text,
  observaciones_internas text,
  frecuencia_trabajo text,
  condiciones_pago text DEFAULT '30 dias'::text,
  descuento_general numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.colores_legacy (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL,
  hex_aproximado text,
  observaciones text,
  sobrecoste numeric(10,2) DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.config_tiempos_proceso (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  proceso_id uuid NOT NULL,
  categoria_pieza_id uuid,
  tiempo_base_min numeric(8,2) NOT NULL DEFAULT 0,
  tiempo_por_m2_min numeric(8,2) NOT NULL DEFAULT 0,
  tiempo_por_ml_min numeric(8,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracion_empresa (
  id integer NOT NULL DEFAULT 1,
  razon_social text,
  nombre_comercial text,
  cif_nif text,
  direccion text,
  codigo_postal text,
  ciudad text,
  provincia text,
  pais text DEFAULT 'España'::text,
  telefono text,
  email text,
  web text,
  iban text,
  logo_url text,
  texto_pie_presupuesto text,
  condiciones_pago_default text DEFAULT 'Pago a 30 días fecha factura'::text,
  iva_default numeric DEFAULT 21,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rendimiento_lacado_kg_m2 numeric NOT NULL DEFAULT 0.12,
  rendimiento_fondo_kg_m2 numeric NOT NULL DEFAULT 0.15,
  ratio_cata_lacado numeric NOT NULL DEFAULT 8,
  ratio_dis_lacado numeric NOT NULL DEFAULT 4,
  ratio_cata_fondo numeric NOT NULL DEFAULT 12,
  ratio_dis_fondo numeric NOT NULL DEFAULT 6,
  coste_minuto_operario numeric NOT NULL DEFAULT 0.40,
  jornada_horas numeric NOT NULL DEFAULT 8,
  margen_objetivo_porcentaje numeric NOT NULL DEFAULT 30,
  ancho_minimo_pistola_cm numeric NOT NULL DEFAULT 15,
  material_catalizador_default_id uuid,
  material_disolvente_default_id uuid,
  umbral_alerta_merma_pct numeric(5,2) NOT NULL DEFAULT 15.00
);

CREATE TABLE IF NOT EXISTS public.empleados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  nombre text NOT NULL,
  apellidos text,
  dni text,
  puesto text,
  proceso_principal_id uuid,
  horas_dia numeric(3,1) DEFAULT 8.0,
  turno_horario text,
  fecha_alta date DEFAULT CURRENT_DATE,
  fecha_baja date,
  activo boolean DEFAULT true,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fases_produccion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pieza_id uuid NOT NULL,
  fase text NOT NULL,
  estado text DEFAULT 'pendiente'::text,
  orden integer NOT NULL,
  inicio timestamptz,
  fin timestamptz,
  duracion_minutos integer,
  operario_id uuid,
  observaciones text,
  incidencias text,
  validacion_ok boolean,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.historial_pagos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  importe_anterior numeric(12,2),
  importe_nuevo numeric(12,2),
  motivo text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.historial_tiempos_proceso (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tarea_id uuid,
  producto_id uuid,
  proceso_id uuid,
  nivel_complejidad integer,
  superficie_m2 numeric,
  tiempo_real_minutos numeric NOT NULL,
  tiempo_estimado_minutos numeric,
  empleado_id uuid,
  fecha_ejecucion timestamptz DEFAULT now(),
  hubo_incidencia boolean DEFAULT false,
  notas text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incidencias_tarea (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tarea_id uuid NOT NULL,
  tipo text NOT NULL,
  descripcion text NOT NULL,
  tarea_duplicada_id uuid,
  minutos_retraso_estimado numeric DEFAULT 0,
  reportada_por uuid,
  resuelta boolean DEFAULT false,
  fecha_resolucion timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lineas_albaran (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  albaran_id uuid NOT NULL,
  pieza_id uuid,
  lote_id uuid,
  descripcion text,
  cantidad integer NOT NULL DEFAULT 1,
  observaciones text
);

CREATE TABLE IF NOT EXISTS public.lineas_pedido (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  linea_presupuesto_origen_id uuid,
  producto_id uuid,
  tarifa_id uuid,
  referencia_cliente_id uuid,
  acabado_id uuid,
  acabado_texto text,
  descripcion text,
  orden integer,
  notas text,
  nivel_complejidad integer DEFAULT 2,
  color_id uuid,
  tratamiento_id uuid,
  tipo_pieza text,
  modo_precio text NOT NULL,
  unidad text,
  cantidad integer NOT NULL DEFAULT 1,
  ancho numeric,
  alto numeric,
  grosor numeric,
  longitud_ml numeric,
  superficie_m2 numeric,
  cara_frontal boolean,
  cara_trasera boolean,
  canto_superior boolean,
  canto_inferior boolean,
  canto_izquierdo boolean,
  canto_derecho boolean,
  precio_unitario numeric,
  precio_m2 numeric,
  precio_pieza numeric,
  precio_minimo numeric,
  suplemento_manual numeric,
  suplemento_descripcion text,
  total_linea numeric(12,2) NOT NULL DEFAULT 0,
  tiempo_estimado integer,
  extras jsonb,
  material_disponible boolean NOT NULL DEFAULT false,
  fecha_llegada_material date,
  proveedor text,
  notas_material text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  material_lacado_id uuid,
  material_fondo_id uuid,
  categoria_pieza_id uuid,
  contabilizar_grosor boolean DEFAULT false,
  precio_aproximado boolean DEFAULT false,
  desglose_coste_json jsonb,
  procesos_codigos text[]
);

CREATE TABLE IF NOT EXISTS public.lineas_presupuesto (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL,
  producto_id uuid,
  tarifa_id uuid,
  descripcion text,
  cantidad integer NOT NULL DEFAULT 1,
  modo_precio text NOT NULL,
  ancho numeric(10,2),
  alto numeric(10,2),
  grosor numeric(10,2),
  unidad text DEFAULT 'mm'::text,
  cara_frontal boolean DEFAULT true,
  cara_trasera boolean DEFAULT false,
  canto_superior boolean DEFAULT false,
  canto_inferior boolean DEFAULT false,
  canto_izquierdo boolean DEFAULT false,
  canto_derecho boolean DEFAULT false,
  superficie_m2 numeric(10,4),
  precio_unitario numeric(10,2),
  precio_m2 numeric(10,2),
  precio_pieza numeric(10,2),
  precio_minimo numeric(10,2) DEFAULT 0,
  color_id uuid,
  tratamiento_id uuid,
  acabado_id uuid,
  acabado_texto text,
  extras jsonb,
  suplemento_manual numeric(10,2) DEFAULT 0,
  suplemento_descripcion text,
  total_linea numeric(12,2) NOT NULL DEFAULT 0,
  tiempo_estimado integer,
  notas text,
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  referencia_cliente_id uuid,
  nivel_complejidad integer DEFAULT 1,
  longitud_ml numeric,
  tipo_pieza text,
  material_lacado_id uuid,
  material_fondo_id uuid,
  categoria_pieza_id uuid,
  contabilizar_grosor boolean DEFAULT false,
  precio_aproximado boolean DEFAULT false,
  desglose_coste_json jsonb,
  procesos_codigos text[]
);

CREATE TABLE IF NOT EXISTS public.lotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  pedido_id uuid NOT NULL,
  descripcion text,
  color_id uuid,
  tratamiento_id uuid,
  estado text DEFAULT 'pendiente'::text,
  total_piezas integer DEFAULT 0,
  piezas_terminadas integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.materiales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  codigo text,
  nombre text NOT NULL,
  familia text,
  hex_aproximado text,
  proveedor_id uuid,
  precio_kg_sobrescrito numeric,
  formato_compra_kg numeric,
  rendimiento_kg_m2_sobrescrito numeric,
  stock_fisico_kg numeric NOT NULL DEFAULT 0,
  stock_reservado_kg numeric NOT NULL DEFAULT 0,
  stock_minimo_kg numeric NOT NULL DEFAULT 0,
  observaciones text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.movimientos_pieza (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pieza_id uuid NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  ubicacion_origen_id uuid,
  ubicacion_destino_id uuid NOT NULL,
  user_id uuid NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.movimientos_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fecha timestamptz NOT NULL DEFAULT now(),
  material_id uuid NOT NULL,
  tipo text NOT NULL,
  cantidad_kg numeric NOT NULL,
  pedido_id uuid,
  pieza_id uuid,
  tarea_produccion_id uuid,
  reserva_id uuid,
  operario_id uuid,
  stock_antes_kg numeric NOT NULL,
  stock_despues_kg numeric NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.niveles_complejidad (
  id integer NOT NULL,
  codigo text NOT NULL,
  nombre text NOT NULL,
  multiplicador numeric(4,2) NOT NULL DEFAULT 1.0,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ocr_documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid,
  archivo_url text NOT NULL,
  texto_extraido text,
  estado text DEFAULT 'pendiente'::text,
  datos_extraidos jsonb,
  referencia_pedido text,
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rol text,
  color text NOT NULL DEFAULT '#64748b'::text,
  activo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operarios_tareas_candidatos (
  tarea_id uuid NOT NULL,
  operario_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pagos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  importe numeric(12,2) NOT NULL,
  fecha_pago date NOT NULL,
  metodo_pago text,
  referencia_transaccion text,
  observaciones text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedidos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  cliente_id uuid NOT NULL,
  presupuesto_origen_id uuid,
  fecha_creacion date NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega_estimada date,
  estado text NOT NULL DEFAULT 'borrador'::text,
  prioridad text NOT NULL DEFAULT 'normal'::text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  descuento_porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  descuento_importe numeric(12,2) NOT NULL DEFAULT 0,
  base_imponible numeric(12,2) NOT NULL DEFAULT 0,
  iva_porcentaje numeric(5,2) NOT NULL DEFAULT 21,
  iva_importe numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  observaciones_comerciales text,
  observaciones_internas text,
  direccion_entrega text,
  contacto_entrega text,
  telefono_entrega text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.piezas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  linea_pedido_id uuid NOT NULL,
  ubicacion_id uuid,
  estado text NOT NULL DEFAULT 'sin_producir'::text,
  color_id uuid,
  tratamiento_id uuid,
  tipo_pieza text,
  ancho numeric,
  alto numeric,
  grosor numeric,
  longitud_ml numeric,
  superficie_m2 numeric,
  fecha_confirmacion timestamptz,
  fecha_prevista_fabricacion date,
  fecha_completada timestamptz,
  fecha_entrega timestamptz,
  qr_codigo text,
  material_disponible boolean NOT NULL DEFAULT false,
  fecha_llegada_material date,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  material_lacado_id uuid,
  material_fondo_id uuid,
  categoria_pieza_id uuid,
  cara_frontal boolean DEFAULT true,
  cara_trasera boolean DEFAULT true,
  canto_superior boolean DEFAULT true,
  canto_inferior boolean DEFAULT true,
  canto_izquierdo boolean DEFAULT true,
  canto_derecho boolean DEFAULT true,
  contabilizar_grosor boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.planificacion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fecha_inicio date NOT NULL,
  fecha_fin date,
  pieza_id uuid NOT NULL,
  fase_id uuid,
  prioridad text DEFAULT 'normal'::text,
  duracion_minutos integer,
  operario_asignado uuid,
  estado text DEFAULT 'pendiente'::text,
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.presupuestos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  fecha date DEFAULT CURRENT_DATE,
  cliente_id uuid NOT NULL,
  estado text DEFAULT 'borrador'::text,
  validez_dias integer DEFAULT 30,
  observaciones_comerciales text,
  observaciones_internas text,
  subtotal numeric(12,2) DEFAULT 0,
  descuento_porcentaje numeric(5,2) DEFAULT 0,
  descuento_importe numeric(12,2) DEFAULT 0,
  base_imponible numeric(12,2) DEFAULT 0,
  iva_porcentaje numeric(5,2) DEFAULT 21,
  iva_importe numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  margen_estimado numeric(5,2),
  tiempo_estimado_total integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL,
  fecha_entrega_estimada date,
  tiempo_produccion_minutos integer,
  share_token uuid DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.procesos_catalogo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  orden_tipico integer NOT NULL,
  color_gantt text DEFAULT '#64748b'::text,
  permite_repetir boolean DEFAULT false,
  es_tiempo_espera boolean DEFAULT false,
  requiere_operario boolean DEFAULT true,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  escala_por_m2 boolean DEFAULT true,
  abreviatura text,
  requiere_secado boolean NOT NULL DEFAULT false,
  tiempo_secado_minutos integer NOT NULL DEFAULT 0,
  rol_operario_requerido text
);

CREATE TABLE IF NOT EXISTS public.procesos_producto (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL,
  proceso_id uuid NOT NULL,
  secuencia integer NOT NULL,
  tiempo_base_minutos numeric(6,2) DEFAULT 0,
  tiempo_por_m2_minutos numeric(6,2) DEFAULT 0,
  factor_simple numeric(4,2) DEFAULT 1.0,
  factor_media numeric(4,2) DEFAULT 1.3,
  factor_compleja numeric(4,2) DEFAULT 1.7,
  notas text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  es_opcional boolean DEFAULT false,
  depende_de_secuencia integer,
  tiempo_secado_minutos_override integer
);

CREATE TABLE IF NOT EXISTS public.productos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria text,
  descripcion text,
  unidad_tarificacion text DEFAULT 'm2'::text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  categoria_id uuid
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  nombre text NOT NULL,
  email text NOT NULL,
  rol text NOT NULL DEFAULT 'usuario'::text,
  activo boolean DEFAULT true,
  fecha_alta timestamptz DEFAULT now(),
  ultima_actividad timestamptz
);

CREATE TABLE IF NOT EXISTS public.proveedores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo_material text NOT NULL,
  precio_base_kg numeric NOT NULL DEFAULT 0,
  telefono text,
  email text,
  notas text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referencias_cliente (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  referencia_cliente text NOT NULL,
  referencia_interna text,
  descripcion text,
  producto_id uuid,
  dimensiones_habituales jsonb,
  color_id uuid,
  tratamiento_id uuid,
  tarifa_id uuid,
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  nombre_pieza text,
  precio_pactado numeric(10,2),
  nivel_complejidad integer DEFAULT 1,
  acabado_id uuid,
  acabado_texto text,
  activo boolean DEFAULT true,
  superficie_m2_habitual numeric(8,4),
  notas_ia text,
  categoria_pieza_id uuid,
  material_lacado_id uuid,
  material_fondo_id uuid,
  modo_precio text DEFAULT 'm2'::text,
  ancho numeric,
  alto numeric,
  grosor numeric,
  longitud_ml numeric,
  cara_frontal boolean DEFAULT true,
  cara_trasera boolean DEFAULT true,
  canto_superior boolean DEFAULT true,
  canto_inferior boolean DEFAULT true,
  canto_izquierdo boolean DEFAULT true,
  canto_derecho boolean DEFAULT true,
  contabilizar_grosor boolean DEFAULT false,
  factor_complejidad text DEFAULT 'media'::text,
  procesos jsonb DEFAULT '[]'::jsonb,
  descuento_porcentaje numeric NOT NULL DEFAULT 0,
  precio_aproximado boolean DEFAULT false,
  coste_calculado_ultimo numeric,
  precio_calculado_ultimo numeric,
  fecha_ultimo_calculo timestamptz
);

CREATE TABLE IF NOT EXISTS public.reservas_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  material_id uuid NOT NULL,
  cantidad_reservada_kg numeric NOT NULL,
  estado text NOT NULL DEFAULT 'activa'::text,
  fecha_reserva timestamptz NOT NULL DEFAULT now(),
  fecha_cierre timestamptz,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.secuencias (
  id text NOT NULL,
  anio integer NOT NULL,
  ultimo_numero integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.tareas_produccion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pieza_id uuid NOT NULL,
  proceso_id uuid NOT NULL,
  secuencia integer NOT NULL,
  es_opcional boolean NOT NULL DEFAULT false,
  depende_de_secuencia integer,
  estado text NOT NULL DEFAULT 'pendiente'::text,
  tiempo_estimado_minutos numeric,
  tiempo_real_minutos numeric,
  fecha_inicio_planificada timestamptz,
  fecha_inicio_real timestamptz,
  fecha_fin_real timestamptz,
  operario_id uuid,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fecha_fin_secado timestamptz,
  forzado_seco boolean NOT NULL DEFAULT false,
  minutos_secado_pendiente_al_forzar integer,
  consumo_lacado_estimado_kg numeric,
  consumo_fondo_estimado_kg numeric,
  consumo_cata_estimado_kg numeric,
  consumo_dis_estimado_kg numeric,
  consumo_lacado_real_kg numeric,
  consumo_fondo_real_kg numeric,
  consumo_cata_real_kg numeric,
  consumo_dis_real_kg numeric,
  consumo_registrado_at timestamptz,
  superficie_m2_aplicada numeric
);

CREATE TABLE IF NOT EXISTS public.tarifas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  producto_id uuid,
  modo_precio text NOT NULL,
  precio_m2 numeric(10,2),
  precio_pieza numeric(10,2),
  precio_minimo numeric(10,2) DEFAULT 0,
  coste_adicional_color numeric(10,2) DEFAULT 0,
  coste_adicional_tratamiento numeric(10,2) DEFAULT 0,
  coste_adicional_embalaje numeric(10,2) DEFAULT 0,
  tiempo_estimado_m2 integer,
  tiempo_estimado_pieza integer,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  precio_metro_lineal numeric,
  tiempo_estimado_metro_lineal numeric
);

CREATE TABLE IF NOT EXISTS public.tratamientos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  multiplicador_coste numeric(5,2) DEFAULT 1.0,
  tiempo_estimado_base integer,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ubicaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL,
  capacidad_aprox integer,
  notas text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- =====================================================================
-- 3) CONSTRAINTS
-- =====================================================================

-- ---------- CONSTRAINTS (PK, UNIQUE, CHECK, FK) ----------
-- Se aplican en este orden: PK → UNIQUE → CHECK → FK
-- para evitar referencias cruzadas antes de tiempo.

-- ===== PRIMARY KEYS =====
ALTER TABLE public.acabados ADD CONSTRAINT acabados_pkey PRIMARY KEY (id);
ALTER TABLE public.ajustes_rendimiento_pendientes ADD CONSTRAINT ajustes_rendimiento_pendientes_pkey PRIMARY KEY (id);
ALTER TABLE public.albaranes ADD CONSTRAINT albaranes_pkey PRIMARY KEY (id);
ALTER TABLE public.avisos_cliente ADD CONSTRAINT avisos_cliente_pkey PRIMARY KEY (id);
ALTER TABLE public.capacidad_diaria ADD CONSTRAINT capacidad_diaria_pkey PRIMARY KEY (id);
ALTER TABLE public.carros ADD CONSTRAINT carros_pkey PRIMARY KEY (id);
ALTER TABLE public.categorias_pieza ADD CONSTRAINT categorias_pieza_pkey PRIMARY KEY (id);
ALTER TABLE public.categorias_producto ADD CONSTRAINT categorias_producto_pkey PRIMARY KEY (id);
ALTER TABLE public.clientes ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);
ALTER TABLE public.colores_legacy ADD CONSTRAINT colores_pkey PRIMARY KEY (id);
ALTER TABLE public.config_tiempos_proceso ADD CONSTRAINT config_tiempos_proceso_pkey PRIMARY KEY (id);
ALTER TABLE public.configuracion_empresa ADD CONSTRAINT configuracion_empresa_pkey PRIMARY KEY (id);
ALTER TABLE public.empleados ADD CONSTRAINT empleados_pkey PRIMARY KEY (id);
ALTER TABLE public.fases_produccion ADD CONSTRAINT fases_produccion_pkey PRIMARY KEY (id);
ALTER TABLE public.historial_pagos ADD CONSTRAINT historial_pagos_pkey PRIMARY KEY (id);
ALTER TABLE public.historial_tiempos_proceso ADD CONSTRAINT historial_tiempos_proceso_pkey PRIMARY KEY (id);
ALTER TABLE public.incidencias_tarea ADD CONSTRAINT incidencias_tarea_pkey PRIMARY KEY (id);
ALTER TABLE public.lineas_albaran ADD CONSTRAINT lineas_albaran_pkey PRIMARY KEY (id);
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_pkey PRIMARY KEY (id);
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_pkey PRIMARY KEY (id);
ALTER TABLE public.lotes ADD CONSTRAINT lotes_pkey PRIMARY KEY (id);
ALTER TABLE public.materiales ADD CONSTRAINT materiales_pkey PRIMARY KEY (id);
ALTER TABLE public.movimientos_pieza ADD CONSTRAINT movimientos_pieza_pkey PRIMARY KEY (id);
ALTER TABLE public.movimientos_stock ADD CONSTRAINT movimientos_stock_pkey PRIMARY KEY (id);
ALTER TABLE public.niveles_complejidad ADD CONSTRAINT niveles_complejidad_pkey PRIMARY KEY (id);
ALTER TABLE public.ocr_documentos ADD CONSTRAINT ocr_documentos_pkey PRIMARY KEY (id);
ALTER TABLE public.operarios ADD CONSTRAINT operarios_pkey PRIMARY KEY (id);
ALTER TABLE public.operarios_tareas_candidatos ADD CONSTRAINT operarios_tareas_candidatos_pkey PRIMARY KEY (tarea_id, operario_id);
ALTER TABLE public.pagos ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);
ALTER TABLE public.piezas ADD CONSTRAINT piezas_pkey PRIMARY KEY (id);
ALTER TABLE public.planificacion ADD CONSTRAINT planificacion_pkey PRIMARY KEY (id);
ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_pkey PRIMARY KEY (id);
ALTER TABLE public.procesos_catalogo ADD CONSTRAINT procesos_catalogo_pkey PRIMARY KEY (id);
ALTER TABLE public.procesos_producto ADD CONSTRAINT procesos_producto_pkey PRIMARY KEY (id);
ALTER TABLE public.productos ADD CONSTRAINT productos_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.proveedores ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_pkey PRIMARY KEY (id);
ALTER TABLE public.reservas_stock ADD CONSTRAINT reservas_stock_pkey PRIMARY KEY (id);
ALTER TABLE public.secuencias ADD CONSTRAINT secuencias_pkey PRIMARY KEY (id);
ALTER TABLE public.tareas_produccion ADD CONSTRAINT tareas_produccion_pkey PRIMARY KEY (id);
ALTER TABLE public.tarifas ADD CONSTRAINT tarifas_pkey PRIMARY KEY (id);
ALTER TABLE public.tratamientos ADD CONSTRAINT tratamientos_pkey PRIMARY KEY (id);
ALTER TABLE public.ubicaciones ADD CONSTRAINT ubicaciones_pkey PRIMARY KEY (id);

-- ===== UNIQUE =====
ALTER TABLE public.acabados ADD CONSTRAINT acabados_codigo_key UNIQUE (codigo);
ALTER TABLE public.albaranes ADD CONSTRAINT albaranes_numero_key UNIQUE (numero);
ALTER TABLE public.capacidad_diaria ADD CONSTRAINT capacidad_diaria_fecha_key UNIQUE (fecha);
ALTER TABLE public.carros ADD CONSTRAINT carros_codigo_key UNIQUE (codigo);
ALTER TABLE public.carros ADD CONSTRAINT carros_qr_code_key UNIQUE (qr_code);
ALTER TABLE public.categorias_pieza ADD CONSTRAINT categorias_pieza_codigo_key UNIQUE (codigo);
ALTER TABLE public.categorias_producto ADD CONSTRAINT categorias_producto_nombre_key UNIQUE (nombre);
ALTER TABLE public.colores_legacy ADD CONSTRAINT colores_codigo_key UNIQUE (codigo);
ALTER TABLE public.lotes ADD CONSTRAINT lotes_codigo_key UNIQUE (codigo);
ALTER TABLE public.materiales ADD CONSTRAINT materiales_tipo_codigo_key UNIQUE (tipo, codigo);
ALTER TABLE public.niveles_complejidad ADD CONSTRAINT niveles_complejidad_codigo_key UNIQUE (codigo);
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_numero_key UNIQUE (numero);
ALTER TABLE public.piezas ADD CONSTRAINT piezas_numero_key UNIQUE (numero);
ALTER TABLE public.piezas ADD CONSTRAINT piezas_qr_codigo_key UNIQUE (qr_codigo);
ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_numero_key UNIQUE (numero);
ALTER TABLE public.procesos_catalogo ADD CONSTRAINT procesos_catalogo_codigo_key UNIQUE (codigo);
ALTER TABLE public.procesos_producto ADD CONSTRAINT procesos_producto_producto_id_proceso_id_secuencia_key UNIQUE (producto_id, proceso_id, secuencia);
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_cliente_id_referencia_cliente_key UNIQUE (cliente_id, referencia_cliente);
ALTER TABLE public.secuencias ADD CONSTRAINT secuencias_id_anio_key UNIQUE (id, anio);
ALTER TABLE public.ubicaciones ADD CONSTRAINT ubicaciones_codigo_key UNIQUE (codigo);

-- ===== CHECK =====
ALTER TABLE public.ajustes_rendimiento_pendientes ADD CONSTRAINT ajustes_rendimiento_pendientes_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'confirmado'::text, 'rechazado'::text]));
ALTER TABLE public.ajustes_rendimiento_pendientes ADD CONSTRAINT ajustes_rendimiento_pendientes_tipo_check CHECK (tipo = ANY (ARRAY['lacado'::text, 'fondo'::text]));
ALTER TABLE public.albaranes ADD CONSTRAINT albaranes_estado_check CHECK (estado = ANY (ARRAY['borrador'::text, 'impreso'::text, 'entregado'::text]));
ALTER TABLE public.avisos_cliente ADD CONSTRAINT avisos_cliente_canal_check CHECK (canal = ANY (ARRAY['email'::text, 'whatsapp'::text, 'sms'::text, 'manual'::text]));
ALTER TABLE public.avisos_cliente ADD CONSTRAINT avisos_cliente_tipo_check CHECK (tipo = ANY (ARRAY['pedido_recibido'::text, 'produccion_iniciada'::text, 'material_recibido'::text, 'proceso_completado'::text, 'pieza_terminada'::text, 'listo_entrega'::text, 'incidencia'::text, 'retraso'::text]));
ALTER TABLE public.categorias_pieza ADD CONSTRAINT categorias_pieza_caras_default_check CHECK (caras_default = ANY (ARRAY[1, 2, 4, 6]));
ALTER TABLE public.categorias_pieza ADD CONSTRAINT categorias_pieza_modo_precio_default_check CHECK (modo_precio_default = ANY (ARRAY['m2'::text, 'pieza'::text, 'ml'::text, 'manual'::text]));
ALTER TABLE public.clientes ADD CONSTRAINT clientes_tipo_check CHECK (tipo = ANY (ARRAY['precliente'::text, 'cliente_activo'::text, 'cliente_recurrente'::text]));
ALTER TABLE public.colores_legacy ADD CONSTRAINT colores_tipo_check CHECK (tipo = ANY (ARRAY['RAL'::text, 'NCS'::text, 'referencia_interna'::text, 'muestra_cliente'::text]));
ALTER TABLE public.configuracion_empresa ADD CONSTRAINT only_one_row CHECK (id = 1);
ALTER TABLE public.fases_produccion ADD CONSTRAINT fases_produccion_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'en_proceso'::text, 'completado'::text, 'incidencia'::text]));
ALTER TABLE public.fases_produccion ADD CONSTRAINT fases_produccion_fase_check CHECK (fase = ANY (ARRAY['recepcion'::text, 'lijado'::text, 'fondo'::text, 'lacado'::text, 'secado'::text, 'manipulado'::text, 'terminacion'::text, 'empaquetado'::text, 'listo_entrega'::text]));
ALTER TABLE public.incidencias_tarea ADD CONSTRAINT incidencias_tarea_tipo_check CHECK (tipo = ANY (ARRAY['repetir_proceso'::text, 'esperar_material'::text, 'defecto_pieza'::text, 'rectificar'::text, 'otro'::text]));
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_modo_precio_check CHECK (modo_precio = ANY (ARRAY['m2'::text, 'pieza'::text, 'ml'::text, 'manual'::text]));
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_modo_precio_check CHECK (modo_precio = ANY (ARRAY['m2'::text, 'pieza'::text, 'ml'::text, 'manual'::text]));
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_tipo_pieza_check CHECK (tipo_pieza IS NULL OR (tipo_pieza = ANY (ARRAY['tablero'::text, 'frente'::text, 'moldura'::text, 'irregular'::text])));
ALTER TABLE public.lotes ADD CONSTRAINT lotes_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'en_proceso'::text, 'terminado'::text, 'incidencia'::text]));
ALTER TABLE public.materiales ADD CONSTRAINT materiales_tipo_check CHECK (tipo = ANY (ARRAY['lacado'::text, 'fondo'::text, 'catalizador'::text, 'disolvente'::text]));
ALTER TABLE public.movimientos_stock ADD CONSTRAINT movimientos_stock_tipo_check CHECK (tipo = ANY (ARRAY['entrada'::text, 'consumo'::text, 'ajuste'::text, 'merma'::text, 'reserva'::text, 'liberacion_reserva'::text]));
ALTER TABLE public.ocr_documentos ADD CONSTRAINT ocr_documentos_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'procesado'::text, 'validado'::text, 'rechazado'::text]));
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estado_check CHECK (estado = ANY (ARRAY['borrador'::text, 'confirmado'::text, 'en_produccion'::text, 'completado'::text, 'entregado'::text, 'facturado'::text, 'cancelado'::text]));
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_prioridad_check CHECK (prioridad = ANY (ARRAY['baja'::text, 'normal'::text, 'alta'::text, 'urgente'::text]));
ALTER TABLE public.piezas ADD CONSTRAINT piezas_estado_check CHECK (estado = ANY (ARRAY['sin_producir'::text, 'en_produccion'::text, 'completada'::text, 'en_almacen'::text, 'entregada'::text, 'incidencia'::text, 'cancelada'::text]));
ALTER TABLE public.planificacion ADD CONSTRAINT planificacion_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'asignado'::text, 'en_proceso'::text, 'completado'::text]));
ALTER TABLE public.planificacion ADD CONSTRAINT planificacion_prioridad_check CHECK (prioridad = ANY (ARRAY['baja'::text, 'normal'::text, 'alta'::text, 'urgente'::text]));
ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_estado_check CHECK (estado = ANY (ARRAY['borrador'::text, 'enviado'::text, 'aceptado'::text, 'rechazado'::text, 'caducado'::text]));
ALTER TABLE public.productos ADD CONSTRAINT productos_unidad_tarificacion_check CHECK (unidad_tarificacion = ANY (ARRAY['m2'::text, 'pieza'::text]));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_rol_check CHECK (rol = ANY (ARRAY['admin'::text, 'usuario'::text, 'operario'::text]));
ALTER TABLE public.proveedores ADD CONSTRAINT proveedores_tipo_material_check CHECK (tipo_material = ANY (ARRAY['lacado'::text, 'fondo'::text, 'catalizador'::text, 'disolvente'::text]));
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_descuento_porcentaje_check CHECK (descuento_porcentaje >= 0::numeric AND descuento_porcentaje <= 100::numeric);
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_factor_complejidad_check CHECK (factor_complejidad = ANY (ARRAY['simple'::text, 'media'::text, 'compleja'::text]));
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_modo_precio_check CHECK (modo_precio = ANY (ARRAY['m2'::text, 'pieza'::text, 'ml'::text, 'manual'::text]));
ALTER TABLE public.reservas_stock ADD CONSTRAINT reservas_stock_cantidad_reservada_kg_check CHECK (cantidad_reservada_kg > 0::numeric);
ALTER TABLE public.reservas_stock ADD CONSTRAINT reservas_stock_estado_check CHECK (estado = ANY (ARRAY['activa'::text, 'consumida'::text, 'liberada'::text]));
ALTER TABLE public.tareas_produccion ADD CONSTRAINT tareas_produccion_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'en_cola'::text, 'en_progreso'::text, 'en_secado'::text, 'completada'::text, 'incidencia'::text, 'anulada'::text]));
ALTER TABLE public.tarifas ADD CONSTRAINT tarifas_modo_precio_check CHECK (modo_precio = ANY (ARRAY['m2'::text, 'pieza'::text, 'metro_lineal'::text, 'ambos'::text, 'todos'::text]));
ALTER TABLE public.ubicaciones ADD CONSTRAINT ubicaciones_tipo_check CHECK (tipo = ANY (ARRAY['carrito'::text, 'estanteria'::text, 'libre'::text]));

-- ===== FOREIGN KEYS =====
ALTER TABLE public.acabados ADD CONSTRAINT acabados_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colores_legacy(id);
ALTER TABLE public.acabados ADD CONSTRAINT acabados_tratamiento_id_fkey FOREIGN KEY (tratamiento_id) REFERENCES public.tratamientos(id);
ALTER TABLE public.ajustes_rendimiento_pendientes ADD CONSTRAINT ajustes_rendimiento_pendientes_resuelto_por_fkey FOREIGN KEY (resuelto_por) REFERENCES public.empleados(id) ON DELETE SET NULL;
ALTER TABLE public.ajustes_rendimiento_pendientes ADD CONSTRAINT ajustes_rendimiento_pendientes_tarea_id_fkey FOREIGN KEY (tarea_id) REFERENCES public.tareas_produccion(id) ON DELETE CASCADE;
ALTER TABLE public.albaranes ADD CONSTRAINT albaranes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.avisos_cliente ADD CONSTRAINT avisos_cliente_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.config_tiempos_proceso ADD CONSTRAINT config_tiempos_proceso_categoria_pieza_id_fkey FOREIGN KEY (categoria_pieza_id) REFERENCES public.categorias_pieza(id) ON DELETE CASCADE;
ALTER TABLE public.config_tiempos_proceso ADD CONSTRAINT config_tiempos_proceso_proceso_id_fkey FOREIGN KEY (proceso_id) REFERENCES public.procesos_catalogo(id) ON DELETE CASCADE;
ALTER TABLE public.configuracion_empresa ADD CONSTRAINT configuracion_empresa_material_catalizador_default_id_fkey FOREIGN KEY (material_catalizador_default_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.configuracion_empresa ADD CONSTRAINT configuracion_empresa_material_disolvente_default_id_fkey FOREIGN KEY (material_disolvente_default_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.empleados ADD CONSTRAINT empleados_proceso_principal_id_fkey FOREIGN KEY (proceso_principal_id) REFERENCES public.procesos_catalogo(id);
ALTER TABLE public.empleados ADD CONSTRAINT empleados_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.fases_produccion ADD CONSTRAINT fases_produccion_operario_id_fkey FOREIGN KEY (operario_id) REFERENCES public.profiles(id);
ALTER TABLE public.historial_tiempos_proceso ADD CONSTRAINT historial_tiempos_proceso_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE SET NULL;
ALTER TABLE public.historial_tiempos_proceso ADD CONSTRAINT historial_tiempos_proceso_nivel_complejidad_fkey FOREIGN KEY (nivel_complejidad) REFERENCES public.niveles_complejidad(id);
ALTER TABLE public.historial_tiempos_proceso ADD CONSTRAINT historial_tiempos_proceso_proceso_id_fkey FOREIGN KEY (proceso_id) REFERENCES public.procesos_catalogo(id) ON DELETE SET NULL;
ALTER TABLE public.historial_tiempos_proceso ADD CONSTRAINT historial_tiempos_proceso_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE SET NULL;
ALTER TABLE public.incidencias_tarea ADD CONSTRAINT incidencias_tarea_reportada_por_fkey FOREIGN KEY (reportada_por) REFERENCES public.empleados(id) ON DELETE SET NULL;
ALTER TABLE public.lineas_albaran ADD CONSTRAINT lineas_albaran_albaran_id_fkey FOREIGN KEY (albaran_id) REFERENCES public.albaranes(id) ON DELETE CASCADE;
ALTER TABLE public.lineas_albaran ADD CONSTRAINT lineas_albaran_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes(id);
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_categoria_pieza_id_fkey FOREIGN KEY (categoria_pieza_id) REFERENCES public.categorias_pieza(id) ON DELETE SET NULL;
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_linea_presupuesto_origen_id_fkey FOREIGN KEY (linea_presupuesto_origen_id) REFERENCES public.lineas_presupuesto(id) ON DELETE SET NULL;
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_material_fondo_id_fkey FOREIGN KEY (material_fondo_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_material_lacado_id_fkey FOREIGN KEY (material_lacado_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE RESTRICT;
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_tarifa_id_fkey FOREIGN KEY (tarifa_id) REFERENCES public.tarifas(id) ON DELETE RESTRICT;
ALTER TABLE public.lineas_pedido ADD CONSTRAINT lineas_pedido_tratamiento_id_fkey FOREIGN KEY (tratamiento_id) REFERENCES public.tratamientos(id) ON DELETE SET NULL;
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_acabado_id_fkey FOREIGN KEY (acabado_id) REFERENCES public.acabados(id);
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_categoria_pieza_id_fkey FOREIGN KEY (categoria_pieza_id) REFERENCES public.categorias_pieza(id) ON DELETE SET NULL;
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_material_fondo_id_fkey FOREIGN KEY (material_fondo_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_material_lacado_id_fkey FOREIGN KEY (material_lacado_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_nivel_complejidad_fkey FOREIGN KEY (nivel_complejidad) REFERENCES public.niveles_complejidad(id);
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_presupuesto_id_fkey FOREIGN KEY (presupuesto_id) REFERENCES public.presupuestos(id) ON DELETE CASCADE;
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_referencia_cliente_id_fkey FOREIGN KEY (referencia_cliente_id) REFERENCES public.referencias_cliente(id);
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_tarifa_id_fkey FOREIGN KEY (tarifa_id) REFERENCES public.tarifas(id);
ALTER TABLE public.lineas_presupuesto ADD CONSTRAINT lineas_presupuesto_tratamiento_id_fkey FOREIGN KEY (tratamiento_id) REFERENCES public.tratamientos(id);
ALTER TABLE public.lotes ADD CONSTRAINT lotes_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.colores_legacy(id);
ALTER TABLE public.lotes ADD CONSTRAINT lotes_tratamiento_id_fkey FOREIGN KEY (tratamiento_id) REFERENCES public.tratamientos(id);
ALTER TABLE public.materiales ADD CONSTRAINT materiales_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE RESTRICT;
ALTER TABLE public.movimientos_pieza ADD CONSTRAINT movimientos_pieza_pieza_id_fkey FOREIGN KEY (pieza_id) REFERENCES public.piezas(id) ON DELETE CASCADE;
ALTER TABLE public.movimientos_pieza ADD CONSTRAINT movimientos_pieza_ubicacion_destino_id_fkey FOREIGN KEY (ubicacion_destino_id) REFERENCES public.ubicaciones(id) ON DELETE RESTRICT;
ALTER TABLE public.movimientos_pieza ADD CONSTRAINT movimientos_pieza_ubicacion_origen_id_fkey FOREIGN KEY (ubicacion_origen_id) REFERENCES public.ubicaciones(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos_stock ADD CONSTRAINT movimientos_stock_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materiales(id) ON DELETE RESTRICT;
ALTER TABLE public.movimientos_stock ADD CONSTRAINT movimientos_stock_operario_id_fkey FOREIGN KEY (operario_id) REFERENCES public.operarios(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos_stock ADD CONSTRAINT movimientos_stock_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos_stock ADD CONSTRAINT movimientos_stock_pieza_id_fkey FOREIGN KEY (pieza_id) REFERENCES public.piezas(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos_stock ADD CONSTRAINT movimientos_stock_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reservas_stock(id) ON DELETE SET NULL;
ALTER TABLE public.movimientos_stock ADD CONSTRAINT movimientos_stock_tarea_produccion_id_fkey FOREIGN KEY (tarea_produccion_id) REFERENCES public.tareas_produccion(id) ON DELETE SET NULL;
ALTER TABLE public.ocr_documentos ADD CONSTRAINT ocr_documentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.operarios_tareas_candidatos ADD CONSTRAINT operarios_tareas_candidatos_operario_id_fkey FOREIGN KEY (operario_id) REFERENCES public.operarios(id) ON DELETE RESTRICT;
ALTER TABLE public.operarios_tareas_candidatos ADD CONSTRAINT operarios_tareas_candidatos_tarea_id_fkey FOREIGN KEY (tarea_id) REFERENCES public.tareas_produccion(id) ON DELETE CASCADE;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_presupuesto_origen_id_fkey FOREIGN KEY (presupuesto_origen_id) REFERENCES public.presupuestos(id) ON DELETE SET NULL;
ALTER TABLE public.piezas ADD CONSTRAINT piezas_categoria_pieza_id_fkey FOREIGN KEY (categoria_pieza_id) REFERENCES public.categorias_pieza(id) ON DELETE SET NULL;
ALTER TABLE public.piezas ADD CONSTRAINT piezas_linea_pedido_id_fkey FOREIGN KEY (linea_pedido_id) REFERENCES public.lineas_pedido(id) ON DELETE CASCADE;
ALTER TABLE public.piezas ADD CONSTRAINT piezas_material_fondo_id_fkey FOREIGN KEY (material_fondo_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.piezas ADD CONSTRAINT piezas_material_lacado_id_fkey FOREIGN KEY (material_lacado_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.piezas ADD CONSTRAINT piezas_tratamiento_id_fkey FOREIGN KEY (tratamiento_id) REFERENCES public.tratamientos(id) ON DELETE SET NULL;
ALTER TABLE public.piezas ADD CONSTRAINT piezas_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id) ON DELETE SET NULL;
ALTER TABLE public.planificacion ADD CONSTRAINT planificacion_fase_id_fkey FOREIGN KEY (fase_id) REFERENCES public.fases_produccion(id);
ALTER TABLE public.planificacion ADD CONSTRAINT planificacion_operario_asignado_fkey FOREIGN KEY (operario_asignado) REFERENCES public.profiles(id);
ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.presupuestos ADD CONSTRAINT presupuestos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.procesos_producto ADD CONSTRAINT procesos_producto_proceso_id_fkey FOREIGN KEY (proceso_id) REFERENCES public.procesos_catalogo(id);
ALTER TABLE public.procesos_producto ADD CONSTRAINT procesos_producto_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;
ALTER TABLE public.productos ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_producto(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_acabado_id_fkey FOREIGN KEY (acabado_id) REFERENCES public.acabados(id);
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_categoria_pieza_id_fkey FOREIGN KEY (categoria_pieza_id) REFERENCES public.categorias_pieza(id) ON DELETE SET NULL;
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_material_fondo_id_fkey FOREIGN KEY (material_fondo_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_material_lacado_id_fkey FOREIGN KEY (material_lacado_id) REFERENCES public.materiales(id) ON DELETE SET NULL;
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_nivel_complejidad_fkey FOREIGN KEY (nivel_complejidad) REFERENCES public.niveles_complejidad(id);
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_tarifa_id_fkey FOREIGN KEY (tarifa_id) REFERENCES public.tarifas(id);
ALTER TABLE public.referencias_cliente ADD CONSTRAINT referencias_cliente_tratamiento_id_fkey FOREIGN KEY (tratamiento_id) REFERENCES public.tratamientos(id);
ALTER TABLE public.reservas_stock ADD CONSTRAINT reservas_stock_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materiales(id) ON DELETE RESTRICT;
ALTER TABLE public.reservas_stock ADD CONSTRAINT reservas_stock_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
ALTER TABLE public.tareas_produccion ADD CONSTRAINT tareas_produccion_pieza_id_fkey FOREIGN KEY (pieza_id) REFERENCES public.piezas(id) ON DELETE CASCADE;
ALTER TABLE public.tareas_produccion ADD CONSTRAINT tareas_produccion_proceso_id_fkey FOREIGN KEY (proceso_id) REFERENCES public.procesos_catalogo(id) ON DELETE RESTRICT;
ALTER TABLE public.tarifas ADD CONSTRAINT tarifas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


-- =====================================================================
-- 4) ÍNDICES
-- =====================================================================

-- ---------- ÍNDICES (no respaldan constraints) ----------

CREATE INDEX IF NOT EXISTS idx_ajustes_rend_creado ON public.ajustes_rendimiento_pendientes USING btree (creado_at DESC);
CREATE INDEX IF NOT EXISTS idx_ajustes_rend_estado ON public.ajustes_rendimiento_pendientes USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_albaranes_pedido_id ON public.albaranes USING btree (pedido_id);
CREATE INDEX IF NOT EXISTS idx_avisos_cliente_cli ON public.avisos_cliente USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_avisos_cliente_enviado ON public.avisos_cliente USING btree (enviado);
CREATE INDEX IF NOT EXISTS idx_categorias_pieza_activo ON public.categorias_pieza USING btree (activo);
CREATE INDEX IF NOT EXISTS idx_categorias_pieza_orden ON public.categorias_pieza USING btree (orden);
CREATE INDEX IF NOT EXISTS idx_categorias_producto_orden ON public.categorias_producto USING btree (orden, nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON public.clientes USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_config_tiempos_cat ON public.config_tiempos_proceso USING btree (categoria_pieza_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_config_tiempos_proc_cat_notnull ON public.config_tiempos_proceso USING btree (proceso_id, categoria_pieza_id) WHERE (categoria_pieza_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_config_tiempos_proc_global ON public.config_tiempos_proceso USING btree (proceso_id) WHERE (categoria_pieza_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_fases_pieza_id ON public.fases_produccion USING btree (pieza_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON public.historial_tiempos_proceso USING btree (fecha_ejecucion DESC);
CREATE INDEX IF NOT EXISTS idx_historial_producto_proceso ON public.historial_tiempos_proceso USING btree (producto_id, proceso_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_resuelta ON public.incidencias_tarea USING btree (resuelta);
CREATE INDEX IF NOT EXISTS idx_incidencias_tarea ON public.incidencias_tarea USING btree (tarea_id);
CREATE INDEX IF NOT EXISTS idx_lineas_pedido_color ON public.lineas_pedido USING btree (color_id);
CREATE INDEX IF NOT EXISTS idx_lineas_pedido_linea_origen ON public.lineas_pedido USING btree (linea_presupuesto_origen_id);
CREATE INDEX IF NOT EXISTS idx_lineas_pedido_pedido ON public.lineas_pedido USING btree (pedido_id);
CREATE INDEX IF NOT EXISTS idx_lineas_pedido_producto ON public.lineas_pedido USING btree (producto_id);
CREATE INDEX IF NOT EXISTS idx_lineas_presupuesto_presupuesto_id ON public.lineas_presupuesto USING btree (presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_pedido_id ON public.lotes USING btree (pedido_id);
CREATE INDEX IF NOT EXISTS idx_materiales_activo ON public.materiales USING btree (activo);
CREATE INDEX IF NOT EXISTS idx_materiales_proveedor ON public.materiales USING btree (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_materiales_stock_minimo ON public.materiales USING btree (stock_fisico_kg, stock_minimo_kg);
CREATE INDEX IF NOT EXISTS idx_materiales_tipo ON public.materiales USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_pieza_fecha ON public.movimientos_pieza USING btree (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_pieza_pieza ON public.movimientos_pieza USING btree (pieza_id);
CREATE INDEX IF NOT EXISTS idx_mov_stock_fecha ON public.movimientos_stock USING btree (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mov_stock_material ON public.movimientos_stock USING btree (material_id);
CREATE INDEX IF NOT EXISTS idx_mov_stock_pedido ON public.movimientos_stock USING btree (pedido_id);
CREATE INDEX IF NOT EXISTS idx_mov_stock_pieza ON public.movimientos_stock USING btree (pieza_id);
CREATE INDEX IF NOT EXISTS idx_mov_stock_tarea ON public.movimientos_stock USING btree (tarea_produccion_id);
CREATE INDEX IF NOT EXISTS idx_mov_stock_tipo ON public.movimientos_stock USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_operarios_activo ON public.operarios USING btree (activo);
CREATE INDEX IF NOT EXISTS idx_operarios_rol ON public.operarios USING btree (rol);
CREATE INDEX IF NOT EXISTS idx_otc_operario ON public.operarios_tareas_candidatos USING btree (operario_id);
CREATE INDEX IF NOT EXISTS idx_otc_tarea ON public.operarios_tareas_candidatos USING btree (tarea_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON public.pedidos USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON public.pedidos USING btree (fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_presupuesto ON public.pedidos USING btree (presupuesto_origen_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_prioridad ON public.pedidos USING btree (prioridad);
CREATE INDEX IF NOT EXISTS idx_piezas_color_estado ON public.piezas USING btree (color_id, estado);
CREATE INDEX IF NOT EXISTS idx_piezas_estado ON public.piezas USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_piezas_fecha_prevista ON public.piezas USING btree (fecha_prevista_fabricacion);
CREATE INDEX IF NOT EXISTS idx_piezas_linea_pedido ON public.piezas USING btree (linea_pedido_id);
CREATE INDEX IF NOT EXISTS idx_piezas_ubicacion ON public.piezas USING btree (ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_planificacion_fecha ON public.planificacion USING btree (fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente_id ON public.presupuestos USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado ON public.presupuestos USING btree (estado);
CREATE UNIQUE INDEX IF NOT EXISTS idx_presupuestos_share_token ON public.presupuestos USING btree (share_token);
CREATE INDEX IF NOT EXISTS idx_procesos_producto_producto ON public.procesos_producto USING btree (producto_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON public.proveedores USING btree (activo);
CREATE INDEX IF NOT EXISTS idx_proveedores_tipo ON public.proveedores USING btree (tipo_material);
CREATE INDEX IF NOT EXISTS idx_referencias_cliente_id ON public.referencias_cliente USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_activas ON public.reservas_stock USING btree (material_id, estado) WHERE (estado = 'activa'::text);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON public.reservas_stock USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_reservas_material ON public.reservas_stock USING btree (material_id);
CREATE INDEX IF NOT EXISTS idx_reservas_pedido ON public.reservas_stock USING btree (pedido_id);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON public.tareas_produccion USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_planificada ON public.tareas_produccion USING btree (fecha_inicio_planificada);
CREATE INDEX IF NOT EXISTS idx_tareas_pieza ON public.tareas_produccion USING btree (pieza_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tareas_pieza_secuencia ON public.tareas_produccion USING btree (pieza_id, secuencia);
CREATE INDEX IF NOT EXISTS idx_tareas_proceso ON public.tareas_produccion USING btree (proceso_id);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_activo ON public.ubicaciones USING btree (activo);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_tipo ON public.ubicaciones USING btree (tipo);


-- =====================================================================
-- 5) FUNCIONES Y TRIGGERS
-- =====================================================================

-- ---------- FUNCIONES Y TRIGGERS ----------

-- ===== FUNCIONES =====

CREATE OR REPLACE FUNCTION public.generar_numero_secuencial(p_tipo text)
RETURNS text
LANGUAGE sql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_next_sequence(tipo text)
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN generar_numero_secuencial(tipo);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_operarios_por_rol(p_rol text)
RETURNS TABLE(operario_id uuid)
LANGUAGE sql
STABLE
AS $function$
  SELECT id AS operario_id
  FROM operarios
  WHERE activo = true
    AND rol = p_rol;
$function$;

-- Corregida vs. Supabase (script 030_fix_rpc_pieza_publica_colores.sql):
-- el bloque 'color' lee de `materiales` (tipo='lacado') en lugar de la
-- tabla `colores` que ya no existe. Misma firma y forma del JSON.
CREATE OR REPLACE FUNCTION public.obtener_pieza_publica(p_qr text)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_configuracion_empresa_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;


-- ===== TRIGGERS =====
-- Se recrean con DROP + CREATE para ser idempotentes.

DROP TRIGGER IF EXISTS trg_configuracion_empresa_updated ON public.configuracion_empresa;
CREATE TRIGGER trg_configuracion_empresa_updated BEFORE UPDATE ON public.configuracion_empresa FOR EACH ROW EXECUTE FUNCTION update_configuracion_empresa_timestamp();

DROP TRIGGER IF EXISTS trg_lineas_pedido_updated_at ON public.lineas_pedido;
CREATE TRIGGER trg_lineas_pedido_updated_at BEFORE UPDATE ON public.lineas_pedido FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_operarios_updated_at ON public.operarios;
CREATE TRIGGER trg_operarios_updated_at BEFORE UPDATE ON public.operarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_piezas_updated_at ON public.piezas;
CREATE TRIGGER trg_piezas_updated_at BEFORE UPDATE ON public.piezas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tareas_produccion_updated_at ON public.tareas_produccion;
CREATE TRIGGER trg_tareas_produccion_updated_at BEFORE UPDATE ON public.tareas_produccion FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ubicaciones_updated_at ON public.ubicaciones;
CREATE TRIGGER trg_ubicaciones_updated_at BEFORE UPDATE ON public.ubicaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =====================================================================
-- 6) ROW LEVEL SECURITY
-- =====================================================================

-- ---------- RLS (Row Level Security) ----------
-- 1) Activar RLS en las tablas que lo tienen habilitado en producción.
-- 2) Recrear políticas (DROP IF EXISTS + CREATE para idempotencia).

-- ===== ENABLE ROW LEVEL SECURITY =====
ALTER TABLE public.ajustes_rendimiento_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_pieza ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_tiempos_proceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_tiempos_proceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias_tarea ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_pieza ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niveles_complejidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operarios_tareas_candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piezas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procesos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procesos_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secuencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;

-- ===== POLICIES =====
-- Nota: hay tablas (clientes, lineas_presupuesto, presupuestos) con
-- políticas definidas pero RLS desactivado. Se replica ese estado:
-- la política queda declarada pero inactiva hasta que se haga ENABLE RLS.

DROP POLICY IF EXISTS ajustes_rendimiento_all ON public.ajustes_rendimiento_pendientes;
CREATE POLICY ajustes_rendimiento_all ON public.ajustes_rendimiento_pendientes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS avisos_cliente_all ON public.avisos_cliente;
CREATE POLICY avisos_cliente_all ON public.avisos_cliente AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_carros ON public.carros;
CREATE POLICY auth_all_carros ON public.carros AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS categorias_pieza_all ON public.categorias_pieza;
CREATE POLICY categorias_pieza_all ON public.categorias_pieza AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS categorias_producto_all ON public.categorias_producto;
CREATE POLICY categorias_producto_all ON public.categorias_producto AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS clientes_public_read ON public.clientes;
CREATE POLICY clientes_public_read ON public.clientes AS PERMISSIVE FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS config_tiempos_proceso_admin ON public.config_tiempos_proceso;
CREATE POLICY config_tiempos_proceso_admin ON public.config_tiempos_proceso AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS config_tiempos_proceso_select ON public.config_tiempos_proceso;
CREATE POLICY config_tiempos_proceso_select ON public.config_tiempos_proceso AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_empresa_insert ON public.configuracion_empresa;
CREATE POLICY config_empresa_insert ON public.configuracion_empresa AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS config_empresa_public_read ON public.configuracion_empresa;
CREATE POLICY config_empresa_public_read ON public.configuracion_empresa AS PERMISSIVE FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS config_empresa_select ON public.configuracion_empresa;
CREATE POLICY config_empresa_select ON public.configuracion_empresa AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS config_empresa_update ON public.configuracion_empresa;
CREATE POLICY config_empresa_update ON public.configuracion_empresa AS PERMISSIVE FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS auth_all_empleados ON public.empleados;
CREATE POLICY auth_all_empleados ON public.empleados AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS historial_tiempos_all ON public.historial_tiempos_proceso;
CREATE POLICY historial_tiempos_all ON public.historial_tiempos_proceso AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS incidencias_tarea_all ON public.incidencias_tarea;
CREATE POLICY incidencias_tarea_all ON public.incidencias_tarea AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_lineas_pedido ON public.lineas_pedido;
CREATE POLICY auth_all_lineas_pedido ON public.lineas_pedido AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS lineas_presupuesto_public_read ON public.lineas_presupuesto;
CREATE POLICY lineas_presupuesto_public_read ON public.lineas_presupuesto AS PERMISSIVE FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS materiales_all ON public.materiales;
CREATE POLICY materiales_all ON public.materiales AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_movimientos_pieza ON public.movimientos_pieza;
CREATE POLICY auth_all_movimientos_pieza ON public.movimientos_pieza AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS movimientos_stock_all ON public.movimientos_stock;
CREATE POLICY movimientos_stock_all ON public.movimientos_stock AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_niveles ON public.niveles_complejidad;
CREATE POLICY auth_all_niveles ON public.niveles_complejidad AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_operarios ON public.operarios;
CREATE POLICY auth_all_operarios ON public.operarios AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_operarios_tareas_candidatos ON public.operarios_tareas_candidatos;
CREATE POLICY auth_all_operarios_tareas_candidatos ON public.operarios_tareas_candidatos AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_pedidos ON public.pedidos;
CREATE POLICY auth_all_pedidos ON public.pedidos AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_piezas ON public.piezas;
CREATE POLICY auth_all_piezas ON public.piezas AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS presupuestos_public_by_token ON public.presupuestos;
CREATE POLICY presupuestos_public_by_token ON public.presupuestos AS PERMISSIVE FOR SELECT TO anon USING (share_token IS NOT NULL);

DROP POLICY IF EXISTS auth_all_procesos_cat ON public.procesos_catalogo;
CREATE POLICY auth_all_procesos_cat ON public.procesos_catalogo AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_procesos_prod ON public.procesos_producto;
CREATE POLICY auth_all_procesos_prod ON public.procesos_producto AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS proveedores_all ON public.proveedores;
CREATE POLICY proveedores_all ON public.proveedores AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS reservas_stock_all ON public.reservas_stock;
CREATE POLICY reservas_stock_all ON public.reservas_stock AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS secuencias_all ON public.secuencias;
CREATE POLICY secuencias_all ON public.secuencias AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_tareas_produccion ON public.tareas_produccion;
CREATE POLICY auth_all_tareas_produccion ON public.tareas_produccion AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_ubicaciones ON public.ubicaciones;
CREATE POLICY auth_all_ubicaciones ON public.ubicaciones AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =====================================================================
-- 7) DATOS SEMILLA
-- =====================================================================

-- ---------- 7a) colores_legacy (sin FKs) ----------
-- ---------- SEED colores_legacy (272 filas NCS + RAL) ----------
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e3d97cb6-300c-4ad6-a75e-af9a2e0a9e9b','NCS S 0300-N','Blanco puro NCS','NCS','#F5F5F0',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('66af992f-93dd-4ea4-80bf-a5b012b6a367','NCS S 0500-N','Blanco NCS','NCS','#F0F0EB',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b3e6c82c-ec83-4ca2-8cf1-02d021eddbae','NCS S 0502-B','Blanco azulado','NCS','#EDF0F2',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f7ea68f9-e197-4e36-adb5-82047bcdfcc1','NCS S 0502-G','Blanco verdoso','NCS','#EFF2ED',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('993549c2-bad3-4732-8a47-dd1af6538bae','NCS S 0502-R','Blanco rosado','NCS','#F2EDEE',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('53dc5b6c-da5d-42aa-a56e-ff082b725269','NCS S 0502-Y','Blanco cálido','NCS','#F2F0E6',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1347891b-9e49-4420-ac1e-f976b3e3987e','NCS S 0804-G80Y','Blanco arena suave','NCS','#EAE6D2',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('a700e103-4a55-4e12-a4eb-b88478141a72','NCS S 0804-Y30R','Blanco hueso cálido','NCS','#EDE5D4',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('25b5bec2-adff-4858-9260-4594dccce491','NCS S 0804-Y50R','Blanco hueso','NCS','#EDE3D6',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('da43ef02-dbe7-4a91-a04e-49d611c671d9','NCS S 1000-N','Gris muy claro NCS','NCS','#E5E5E0',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('4d9bcbd6-6948-4bc9-9a40-7693eceeaf3f','NCS S 1002-B','Blanco antiguo azulado','NCS','#E0E3E5',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('aebaffbf-8fd1-4065-a73b-c34c8f095927','NCS S 1002-G','Blanco antiguo verdoso','NCS','#E2E5DA',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('96431953-bc02-4bc6-a8a9-212126ff36e3','NCS S 1002-R','Blanco antiguo rosado','NCS','#E5E0DE',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('4ded985c-2818-44f6-ba01-3dc94aa347c1','NCS S 1002-Y','Blanco antiguo cálido','NCS','#E6E2D2',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3f63b442-06f6-4f88-be23-9193dcea0818','NCS S 1005-G80Y','Arena claro','NCS','#E0DFC9',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('ab1e84ce-29c3-4ae2-a635-56fdf38a883e','NCS S 1005-Y20R','Marfil NCS','NCS','#E3DCCB',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('98931999-e9a4-482a-9384-ccf34487e798','NCS S 1005-Y50R','Crema claro','NCS','#E3DACF',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('5f486eef-6189-4dfc-99fb-e1adbbab941b','NCS S 1500-N','Gris perla NCS','NCS','#D8D8D3',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9ae0bc85-1efa-4ae9-a367-a5d3117692a7','NCS S 1502-B','Gris perla azulado','NCS','#D3D6D8',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('53dd468c-35a9-4851-91c8-f6a9f668adec','NCS S 1502-G','Gris perla verdoso','NCS','#D4D8D1',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('0a8f0485-9a6f-476a-b52b-69653df10018','NCS S 1502-R','Gris perla rosado','NCS','#D8D4D3',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6d47bb57-67f7-4d41-9836-7ce3ff419a64','NCS S 1502-Y','Gris perla cálido','NCS','#D9D7CB',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f1749a53-d105-4260-8112-bdae3b2cbdd0','NCS S 2000-N','Gris claro NCS','NCS','#CBCBC6',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('c5173a4f-0809-4807-97c8-4409f5b5a2f6','NCS S 2002-B','Gris claro azulado','NCS','#BDC1C4',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f648a428-0d28-4600-8035-19d305cc57b1','NCS S 2002-G','Gris claro verdoso','NCS','#BFC4BB',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1c594e79-0bba-4683-a19a-8c136042543e','NCS S 2002-R','Gris claro rosado','NCS','#C4BFBD',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b17ddfc8-1ff5-4fc9-9fd3-4f0820dd2703','NCS S 2002-Y','Gris claro cálido','NCS','#C5C3B5',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('27791d14-366b-4e32-a367-60382824334d','NCS S 2005-Y20R','Gris arena claro','NCS','#C2BDA9',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6888c3b3-3d0d-471e-8965-32ec2740a344','NCS S 2500-N','Gris plata NCS','NCS','#BDBDB8',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('0041de0d-94f6-41ce-8054-f53d4e14e04f','NCS S 3000-N','Gris medio NCS','NCS','#B0B0AB',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('77f4292f-fe67-4d81-9a44-7d6d110b0d9d','NCS S 3002-B','Gris medio azulado','NCS','#A3A7AA',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('312e29b4-d46d-4ad5-a9b3-3ce37b679af1','NCS S 3002-G','Gris medio verdoso','NCS','#A5AAA0',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1bda9271-a959-440e-8932-aa579ef3921b','NCS S 3002-R','Gris medio rosado','NCS','#AAA4A2',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('aa0ce4ca-522f-4059-b4cd-346bb2518e40','NCS S 3002-Y','Gris medio cálido','NCS','#ACA99A',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9efb20bc-8135-4970-9646-09cfc6a9098d','NCS S 3005-Y20R','Gris arena medio','NCS','#A8A28E',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('59eb8d03-46e8-4c56-9f05-cad619edbed2','NCS S 3500-N','Gris medio oscuro NCS','NCS','#9E9E99',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6c4f8aa6-cf52-4467-bf1d-555a57350a6a','NCS S 4000-N','Gris oscuro NCS','NCS','#969691',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9697ff80-0a5e-4648-91d1-9e572626bc42','NCS S 4500-N','Gris pizarra claro','NCS','#858580',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('eb7478be-dabb-40bb-b564-b9f2d4a22d53','NCS S 4502-B','Gris oscuro azulado','NCS','#888C8F',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('8c4317c9-75db-48de-a553-d4262fd3c795','NCS S 4502-G','Gris oscuro verdoso','NCS','#8A8F86',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6af44ea6-b6cc-47e6-8517-2f51786f8ee7','NCS S 4502-Y','Gris oscuro cálido','NCS','#908D7F',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('bbe58f4a-1aef-494f-92ef-d17785816612','NCS S 5000-N','Gris intenso NCS','NCS','#7B7B76',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e289aa26-c323-44e4-9c94-59349cb13cd0','NCS S 5500-N','Gris carbón claro','NCS','#6B6B66',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('ffaf4977-c57b-4662-8a29-b2b5e889ce17','NCS S 5502-B','Gris intenso azulado','NCS','#6D7174',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('720fed28-bb90-4612-89ff-692d51d88f4e','NCS S 5502-G','Gris intenso verdoso','NCS','#6F746B',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9249331b-fb1e-4b8c-b487-311b34c96f41','NCS S 5502-Y','Gris intenso cálido','NCS','#767363',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('41d9492a-fa60-4d15-8cf9-ccfd86f20629','NCS S 6000-N','Gris grafito NCS','NCS','#656560',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1b57376d-50ab-4a3a-bd86-40d8c3428f45','NCS S 6500-N','Gris antracita NCS','NCS','#565651',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('251498c7-2c4a-4922-90a7-a167b48c9694','NCS S 6502-B','Gris grafito azulado','NCS','#565A5D',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('35cb48c9-a68e-4a52-9a1e-e7ff9dff33f3','NCS S 6502-Y','Gris grafito cálido','NCS','#605D4F',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('4c8cd5fe-560e-48f3-ac3e-868e2d2bd229','NCS S 7000-N','Gris muy oscuro NCS','NCS','#4D4D48',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e250b831-8a3c-41f1-9f79-a7f1ee5c4d59','NCS S 7500-N','Gris oscuro profundo','NCS','#3F3F3A',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('8821fdb5-baac-42bc-9d2d-d8b023cf5912','NCS S 7502-B','Gris acero oscuro','NCS','#424649',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('25dd6cb5-d2a8-46fe-bbb4-f6f6613ff745','NCS S 7502-Y','Gris pardo oscuro','NCS','#4A4739',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('5e87027e-d237-4879-a243-ea1b42b410b8','NCS S 8000-N','Gris negruzco NCS','NCS','#363631',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('25aa9e15-eda1-4059-a8c1-3393aebf7972','NCS S 8500-N','Casi negro NCS','NCS','#2A2A25',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3c967fd1-03e8-4dc5-a747-eba1613c9b30','NCS S 8502-B','Negro azulado NCS','NCS','#282C2F',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('131940a9-6af3-4377-a4c6-480d690bad75','NCS S 8502-Y','Negro cálido NCS','NCS','#302D22',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6c5f5fd3-61b3-451a-9a3b-f3753bdae83d','NCS S 9000-N','Negro NCS','NCS','#1A1A17',NULL,'0.00','t','2026-04-19 18:07:10.195683+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b3f4e41d-bfce-452f-9f1a-6439e698f2a8','RAL 1000','Beige verdoso','RAL','#BEBD7F',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('2a06ec45-3e6a-4608-bde8-acf3307ebff6','RAL 1001','Beige','RAL','#C2B078',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('0f8a47fe-62c6-48a0-88c2-09b78399579d','RAL 1002','Beige arena','RAL','#C6A664',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d52a5bfa-dc43-49c5-a6ea-37675d08be55','RAL 1003','Amarillo señales','RAL','#E5BE01',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f11d5031-89b0-4285-9863-1b53fb5476a5','RAL 1004','Amarillo oro','RAL','#CDA434',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('41ed27b6-538a-4791-adf0-275bf8ac3f4e','RAL 1005','Amarillo miel','RAL','#A98307',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('70c75aa1-fbfd-43f7-9825-d2da9f6fe4a0','RAL 1006','Amarillo maíz','RAL','#E4A010',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('4759f8fd-ba6b-4617-b913-0458b0782a36','RAL 1007','Amarillo narciso','RAL','#DC9D00',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('14e2d4d7-8090-4770-8181-272d72d70007','RAL 1011','Beige parduzco','RAL','#8A6642',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3cb89305-2144-4128-afba-3401470bd186','RAL 1012','Amarillo limón','RAL','#C7B446',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('225e23fe-44fe-4368-8ee1-ab2f75bf195a','RAL 1013','Blanco perla','RAL','#EAE6CA',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('7f666a2c-54e9-4c52-a640-72fd3f58d7c3','RAL 1014','Marfil','RAL','#E1CC4F',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('4cb078a7-eaf9-45c5-a7b9-9d84c0fdbc0c','RAL 1015','Marfil claro','RAL','#E6D690',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('c9e7b438-9d37-4e0c-9df0-276583de9593','RAL 1016','Amarillo azufre','RAL','#EDFF21',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('4951bdac-2d11-4ff6-902a-3c8bcfde999a','RAL 1017','Amarillo azafrán','RAL','#F5D033',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('861ff02c-41d6-4731-8230-17e0fc0ad98f','RAL 1018','Amarillo zinc','RAL','#F8F32B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('988a6c5f-0911-46cb-9153-f933a34412cd','RAL 1019','Beige agrisado','RAL','#9E9764',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6e760a1a-72f5-4aa8-81b9-ca67cc84e0e4','RAL 1020','Amarillo oliva','RAL','#999950',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('a1e53781-aace-47dc-ae1d-7612db2caace','RAL 1021','Amarillo colza','RAL','#F3DA0B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b3b0c607-e5f9-47a2-a4f8-0f1184befaba','RAL 1023','Amarillo tráfico','RAL','#FAD201',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('eaebdab1-795e-4210-89a9-af43f4113bd4','RAL 1024','Amarillo ocre','RAL','#AEA04B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3da6fc95-b9ea-4f0c-bdd5-bf287dc77a0f','RAL 1026','Amarillo brillante','RAL','#FFFF00',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6e81eac4-aec7-4906-9c3c-28ae61bc4591','RAL 1027','Amarillo curry','RAL','#9D9101',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('5d77eb2d-8344-4bf3-b0c3-a1bf5cda3ada','RAL 1028','Amarillo melón','RAL','#F4A900',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('ec04c768-411b-4e10-8be1-de7ccf5e4b65','RAL 1032','Amarillo retama','RAL','#D6AE01',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d0f186c4-8711-4791-abf9-ff33ed257591','RAL 1033','Amarillo dalia','RAL','#F3A505',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('a37cb1e3-d55f-4769-84b3-54b4031d6d97','RAL 1034','Amarillo pastel','RAL','#EFA94A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('7fe69b99-6b75-49ac-a6ce-fd8ce4d840e0','RAL 1035','Beige perlado','RAL','#6A5D4D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('84e3b3da-0e8a-40f5-b499-5853c4e8f5e8','RAL 1036','Oro perlado','RAL','#705335',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('40ba659a-760d-4c30-a97d-0adeccd0884f','RAL 1037','Amarillo sol','RAL','#F39F18',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('ea54c631-f63b-48c6-ae63-7ba103845f11','RAL 2000','Amarillo naranja','RAL','#ED760E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('34b7ce59-760a-4aa7-8dae-2ea2d8a81047','RAL 2001','Rojo anaranjado','RAL','#C93C20',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('717d9b40-4aeb-4e38-bcc5-04da1ddb01c5','RAL 2002','Naranja sanguíneo','RAL','#CB2821',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e7c42ad1-958c-414b-a064-edd5b605e2fe','RAL 2003','Naranja pastel','RAL','#FF7514',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('90b61d8c-2005-47e2-95a8-6722583f219b','RAL 2004','Naranja puro','RAL','#F44611',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f7601d1b-c149-4e4c-9b63-c10db5c31d4f','RAL 2005','Naranja brillante','RAL','#FF2301',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('42138d10-b8e3-49d7-b8cd-3b7718abc284','RAL 2007','Amarillo anaranjado','RAL','#FFA420',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('7704d8ae-9682-4f43-bb57-c16cc5b1af7b','RAL 2008','Rojo claro anaranjado','RAL','#F75E25',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('02b12889-d777-47d1-b1d9-a2c42eb62cde','RAL 2009','Naranja tráfico','RAL','#F54021',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('2db3f8f8-4285-4f16-be47-5873032141aa','RAL 2010','Naranja señales','RAL','#D84B20',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f0b8c996-cc39-4005-bd4c-21e1a87badf6','RAL 2011','Naranja intenso','RAL','#EC7C26',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('4cc1e3d9-592b-402b-ad58-783b2afed77d','RAL 2012','Naranja salmón','RAL','#E55137',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('20d3c1e0-fa45-4e0f-9431-01c7fadd5328','RAL 2013','Naranja perlado','RAL','#C35831',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('2967f625-780a-42a3-8311-f1e2017005ba','RAL 3000','Rojo fuego','RAL','#AF2B1E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('56598fc0-41c6-48dd-9a88-4f1a72f42c59','RAL 3001','Rojo señales','RAL','#A52019',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6170acc8-8464-488b-8ccd-9933bb3a58c4','RAL 3002','Rojo carmín','RAL','#A2231D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3184dc83-e774-44c6-bee6-40bed092a618','RAL 3003','Rojo rubí','RAL','#9B111E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9b48c5db-0cec-46f3-8c9e-1aaaf7e5558c','RAL 3004','Rojo púrpura','RAL','#75151E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('abc41b02-63e5-498d-af45-8093f9d39422','RAL 3005','Rojo vino','RAL','#5E2129',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('53d851a0-b350-4cad-826b-daa5bf4cb091','RAL 3007','Rojo negruzco','RAL','#412227',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('0f455112-8ad2-4c70-aad3-5eaa356f238a','RAL 3009','Rojo óxido','RAL','#642424',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('24fa1495-0bb8-4207-9fd3-e44c2a4c3090','RAL 3011','Rojo pardo','RAL','#781F19',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('a5e3831d-62ca-4b02-baf9-96c1dc8fa85f','RAL 3012','Rojo beige','RAL','#C1876B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e3a9600b-0f93-4c6c-b424-0803ff8d4185','RAL 3013','Rojo tomate','RAL','#A12312',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6c72af60-a0d3-4bf3-be60-3a679a87750a','RAL 3014','Rosa antiguo','RAL','#D36E70',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('a2482186-4867-48c5-bfba-1639774de457','RAL 3015','Rosa claro','RAL','#EA899A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('999d7b40-f671-4406-b48c-b51d1358f7e5','RAL 3016','Rojo coral','RAL','#B32821',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('44ecd4cf-1b43-4563-ad9a-54be2e94198e','RAL 3017','Rosa fresa','RAL','#E63244',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('09e71139-2abe-45a2-bd61-121d46c12227','RAL 3018','Rojo fresa','RAL','#D53032',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e4c3016b-de8f-4c99-a11f-93217eb8bb41','RAL 3020','Rojo tráfico','RAL','#CC0605',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('85d967f6-70c8-44f7-9589-2874b6a772a1','RAL 3022','Rojo salmón','RAL','#D95030',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('5c79e2ca-05d5-4046-92a3-ecaef09cbf46','RAL 3024','Rojo brillante','RAL','#F80000',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d4731453-0052-4c61-bda9-19950e31d3c6','RAL 3026','Rojo vivo brillante','RAL','#FE0000',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e99fefb7-5c9d-42af-ac81-7795093c4ddd','RAL 3027','Rojo frambuesa','RAL','#C51D34',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('cdc86a79-5052-441e-95eb-2a02fde121d8','RAL 3028','Rojo puro','RAL','#CB3234',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('90951a20-a797-41de-a783-d0c46534c247','RAL 3031','Rojo oriente','RAL','#B32428',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('575d81d7-beca-4c2f-96e3-842e7e42cb59','RAL 3032','Rojo rubí perlado','RAL','#721422',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('cfa56f59-0e15-4c29-9ac7-e1935c9cf862','RAL 3033','Rosa perlado','RAL','#B44C43',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('c84bcccd-98c1-4215-b4da-3771c309c2b7','RAL 4001','Lila rojizo','RAL','#6D3F5B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('c421dd86-0e16-432e-b2d5-ba64c6b7e255','RAL 4002','Violeta rojizo','RAL','#922B3E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b802f551-b194-456c-928f-6ee098b248c8','RAL 4003','Violeta erica','RAL','#DE4C8A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('76aef852-1a7b-4496-9dfc-31b9a7d244ff','RAL 4004','Violeta burdeos','RAL','#641C34',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('be2e07db-34dc-4c4f-9134-5322da57a2f4','RAL 4005','Violeta azulado','RAL','#6C4675',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d4d3ea84-9516-4164-86e1-d423fb5e815f','RAL 4006','Púrpura tráfico','RAL','#A03472',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('05a151aa-af05-4d6b-9df8-77d27649f2aa','RAL 4007','Violeta púrpura','RAL','#4A192C',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b9146d23-cbd6-408e-bbcd-1ed911c27dbe','RAL 4008','Violeta señales','RAL','#924E7D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('06f3e0fd-5576-4c70-8e3c-a20a774ee253','RAL 4009','Violeta pastel','RAL','#A18594',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('80fde902-c9ba-4166-9cbe-0104beb7bb5f','RAL 4010','Magenta telemagenta','RAL','#CF3476',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('2ff72a0c-2066-4421-b521-2ebb6e9274df','RAL 4011','Violeta perlado','RAL','#8673A1',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('cc09f6a4-784a-47c2-b9ed-b714afebda0d','RAL 4012','Violeta perla','RAL','#6C6874',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('295ae35c-f656-4cb0-9131-f405335df8be','RAL 5000','Azul violeta','RAL','#354D73',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('03bc2b48-b0d1-4925-a520-ff386668439a','RAL 5001','Azul verdoso','RAL','#1F3438',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('44375cf7-c75f-4125-b2cf-6269579878fa','RAL 5002','Azul ultramar','RAL','#20214F',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1a20b3e2-68b0-415d-8ddf-72866231d5cd','RAL 5003','Azul zafiro','RAL','#1D1E33',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('a72d3527-dcc3-43fc-b65e-b2fe91d20c3e','RAL 5004','Azul negruzco','RAL','#18171C',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('c70da027-ff6b-4cc6-93f4-35e194b86235','RAL 5005','Azul señales','RAL','#1E2460',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('5e7a9446-9779-4a38-b788-bfa5f67a5aa3','RAL 5007','Azul brillante','RAL','#3E5F8A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('df3fc2c1-6676-4754-8ff2-906adfb05ad3','RAL 5008','Azul grisáceo','RAL','#26252D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('07d6a414-e6e9-4f99-8586-3946ca2d14de','RAL 5009','Azul azur','RAL','#025669',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('52a949d3-652b-470b-a423-75733c3859c8','RAL 5010','Azul genciana','RAL','#0E294B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('42a4cc35-8a0c-4816-87b7-b9707dfcc40e','RAL 5011','Azul acero','RAL','#231A24',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('dcc97ed3-2417-490d-8b03-fafd89322c95','RAL 5012','Azul claro','RAL','#3B83BD',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9870172f-33fd-4093-8033-7a0ae899a34f','RAL 5013','Azul cobalto','RAL','#1E213D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('204e5eea-e8f9-401f-bf25-d444ed426e53','RAL 5014','Azul paloma','RAL','#606E8C',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('fdf9ae79-e2b7-4dcb-bc61-f79c13c057aa','RAL 5015','Azul cielo','RAL','#2271B3',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('4c7bd58f-b779-4420-b78b-771b70ba0b8b','RAL 5017','Azul tráfico','RAL','#063971',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('de0f13bc-f09e-49c9-8f7d-c254985f3278','RAL 5018','Azul turquesa','RAL','#3F888F',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('cb111f72-036a-4536-9698-857dae9dc42a','RAL 5019','Azul capri','RAL','#1B5583',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('8ff71414-19ca-4729-9d7d-7a7f8f873373','RAL 5020','Azul océano','RAL','#1D334A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('fe718560-bd0d-48d6-9cf8-65169feef225','RAL 5021','Azul agua marina','RAL','#256D7B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('40ce8e99-bce9-44ce-bf14-5b3ffa48b86b','RAL 5022','Azul noche','RAL','#252850',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('2aab34ba-cb39-44a4-a41c-e48662b9a2e0','RAL 5023','Azul lejano','RAL','#49678D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('239baa59-ee58-45ab-8444-3d809fd45c02','RAL 5024','Azul pastel','RAL','#5D9B9B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('39302f01-ac24-4436-9272-be8f41f9b933','RAL 5025','Azul genciana perlado','RAL','#2A6478',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('5ad9d2e5-cafe-4794-b6d4-3f2e748f32ba','RAL 5026','Azul noche perlado','RAL','#102C54',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d2db7bf6-2608-4f2e-9b21-38f680b86b25','RAL 6000','Verde patina','RAL','#316650',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e082fc21-9b01-43a8-9d16-0104e8b66137','RAL 6001','Verde esmeralda','RAL','#287233',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('af4a7787-488d-4bc8-adaf-400f95a5322e','RAL 6002','Verde hoja','RAL','#2D572C',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d5cd60f3-7b3a-47b4-9953-c30600c7d144','RAL 6003','Verde oliva','RAL','#424632',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('5ea423cd-ea14-4b54-958c-52489d687545','RAL 6004','Verde azulado','RAL','#1F3A3D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1680c0d6-c339-43ec-932a-6a6375f7640b','RAL 6005','Verde musgo','RAL','#2F4538',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('ba640c52-354d-4530-b609-291a60ac6b37','RAL 6006','Verde oliva grisáceo','RAL','#3E3B32',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1f58ae0d-abcd-4589-ba57-fa8f86f84eda','RAL 6007','Verde botella','RAL','#343B29',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9de245e2-dd2f-465d-a6e8-ba6b05d41ae3','RAL 6008','Verde parduzco','RAL','#39352A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('45ed6bb9-971c-48dc-970e-26ff127d0d06','RAL 6009','Verde abeto','RAL','#31372B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('64505e0c-c354-4aa6-abb8-6d0925444e90','RAL 6010','Verde hierba','RAL','#35682D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d1ac8edd-1995-4ea0-83fb-f65e93b81946','RAL 6011','Verde reseda','RAL','#587246',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('39608ce1-e724-40e7-bd21-7738a81123f2','RAL 6012','Verde negruzco','RAL','#343E40',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('2500ab55-567b-434a-8865-2e70686bab5a','RAL 6013','Verde caña','RAL','#6C7156',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('70f91490-e0d5-4753-a867-a76e40a935cf','RAL 6014','Amarillo oliva','RAL','#47402E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('48a3045e-3715-4711-9061-cddcaeacbd0d','RAL 6015','Oliva negruzco','RAL','#3B3C36',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('29d11fd2-1767-4810-8ff6-7723c1c4c149','RAL 6016','Verde turquesa','RAL','#1E5945',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('6a2f868b-a63a-4f90-bd68-7a4b79ad3d47','RAL 6017','Verde mayo','RAL','#4C9141',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('32ec1407-fadb-47a7-9f49-56d1df9e2b8f','RAL 6018','Verde amarillento','RAL','#57A639',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('8f033ddd-1c45-4727-998d-7b497d888e98','RAL 6019','Verde blanquecino','RAL','#BDECB6',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('61d25c79-25ef-476c-9ede-1ac234471d4f','RAL 6020','Verde cromo','RAL','#2E3A23',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d08e1867-d250-4546-b2c5-8c763dba0c67','RAL 6021','Verde pálido','RAL','#89AC76',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d23921d6-8d9b-4dc8-974c-3bee275da50b','RAL 6022','Oliva parduzco','RAL','#25221B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e9d14f81-23f8-493f-b5ff-6b583c4b9226','RAL 6024','Verde tráfico','RAL','#308446',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('551dfcdb-2a44-4fb7-a53f-9140f8c79ff0','RAL 6025','Verde helecho','RAL','#3D642D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3ca07eb2-0912-4394-bd05-162f4404d2c2','RAL 6026','Verde opalino','RAL','#015D52',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f114ad78-5465-4df2-9e30-db8a2c938d1c','RAL 6027','Verde claro','RAL','#84C3BE',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('c066d83d-ea4c-4a16-9d84-c73774aefb4f','RAL 6028','Verde pino','RAL','#2C5545',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('0d5a39d6-ba33-4982-96e0-cc657b11ddf7','RAL 6029','Verde menta','RAL','#20603D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9b0b9ec4-df64-43ef-b912-513cc9e27065','RAL 6032','Verde señales','RAL','#317F43',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b67c250f-9194-4ee0-80b5-8dc28dab0d9b','RAL 6033','Turquesa menta','RAL','#497E76',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('52ef80fc-f900-41d3-9335-22200ec4413d','RAL 6034','Turquesa pastel','RAL','#7FB5B5',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('cce519bc-1dac-42dd-8811-339075979bc9','RAL 6035','Verde perlado','RAL','#1C542D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('61a9657f-240d-40e1-80cc-708494105835','RAL 6036','Verde ópalo perlado','RAL','#193737',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('84b206bb-9121-4327-be83-693f8ae375a9','RAL 6037','Verde puro','RAL','#008F39',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('117b1008-963f-4d67-ad36-9771f612b40e','RAL 6038','Verde claro brillante','RAL','#00BB2D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('bf7815e7-767f-4200-8389-7813512f0d1e','RAL 7000','Gris ardilla','RAL','#78858B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('0fa43f7b-84be-4804-856d-0fb746ff62fe','RAL 7001','Gris plata','RAL','#8A9597',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f8cf81a3-4a57-4308-b434-27b84ded629a','RAL 7002','Gris oliva','RAL','#7E7B52',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('75ee1b30-e631-4fa5-bbeb-6dfd07e83d9e','RAL 7003','Gris musgo','RAL','#6C7059',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('65bbe75d-4c1a-4025-a5fe-c58163701671','RAL 7004','Gris señales','RAL','#969992',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('66bf109a-a946-43c1-ac44-de1c3f3d69ba','RAL 7005','Gris ratón','RAL','#646B63',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('495ad805-9e1e-4b62-a72d-fdfcd6345eb3','RAL 7006','Gris beige','RAL','#6D6552',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('648541f1-6f73-47a2-9981-51faf7fdfd65','RAL 7008','Gris caqui','RAL','#6A5F31',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b56827b6-2bd8-4afc-b67f-3a67e10af6b5','RAL 7009','Gris verdoso','RAL','#4D5645',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1fec647d-8e8a-416c-95fb-79d8edffeebb','RAL 7010','Gris lona','RAL','#4C514A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('c18af01f-d2f1-4a5d-8905-4d1573b6183d','RAL 7011','Gris hierro','RAL','#434B4D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('134386a0-0cae-45bc-91ac-e892ce41760c','RAL 7012','Gris basalto','RAL','#4E5754',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9397e23d-c81f-41d0-8fb6-9ec98f0fb9d0','RAL 7013','Gris parduzco','RAL','#464531',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b042f1a3-4c81-41dc-aeb6-3e786c0edae3','RAL 7015','Gris pizarra','RAL','#434750',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('928526b1-6bed-4c2e-b769-a1ddf8090428','RAL 7016','Gris antracita','RAL','#293133',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('ea163e92-84d0-4d47-b33b-11087a9d5535','RAL 7021','Gris negruzco','RAL','#23282B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('50750cb5-2a3a-4640-ac88-c469b1011a21','RAL 7022','Gris umbra','RAL','#332F2C',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9156bf9f-225c-48f1-a72c-2c34dbccb934','RAL 7023','Gris hormigón','RAL','#686C5E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('55d04fb1-eef5-4edc-82e4-0c47f5a3177b','RAL 7024','Gris grafito','RAL','#474A51',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('4e74705c-42bf-45bd-89e5-c16cc4690ba2','RAL 7026','Gris granito','RAL','#2F353B',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e6acff70-782e-400b-9e4d-9d9ddb3599b0','RAL 7030','Gris piedra','RAL','#8B8C7A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9cf6d4c9-2e11-4cd4-b257-9a68f8effebc','RAL 7031','Gris azulado','RAL','#474B4E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e1a84097-575a-4572-a55b-f9bece80b87b','RAL 7032','Gris guijarro','RAL','#B8B799',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('47e09240-d5a1-43e6-aa5f-6f1ca24444b6','RAL 7033','Gris cemento','RAL','#7D8471',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('934cbc12-987f-43f0-82dc-6b4ab859ad68','RAL 7034','Gris amarillento','RAL','#8F8B66',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('a747fb45-b650-4a1c-8aa6-055b6de18a90','RAL 7035','Gris luminoso','RAL','#D7D7D7',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('891370d5-d653-4cbe-8273-11a4e342fda5','RAL 7036','Gris platino','RAL','#7F7679',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('40c209d2-123b-48b3-8a84-448966f08970','RAL 7037','Gris polvo','RAL','#7D7F7D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('773efb26-74f3-4b6b-af83-cf3d413a8d69','RAL 7038','Gris ágata','RAL','#B5B8B1',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('494db880-38a7-4ea6-a28d-65d167b39b97','RAL 7039','Gris cuarzo','RAL','#6C6960',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('faaf8ee2-4d48-4c35-8705-07a5a2ccc26e','RAL 7040','Gris ventana','RAL','#9DA1AA',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('ded59f3e-62e2-4e5a-9e84-4ba0b4372fa7','RAL 7042','Gris tráfico A','RAL','#8D948D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('748ee5fe-be64-4d88-9d64-40bcc75186fe','RAL 7043','Gris tráfico B','RAL','#4E5452',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b8d301e7-41c9-4793-9c1a-d47bfa2f33f9','RAL 7044','Gris seda','RAL','#CAC4B0',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('fc0ef247-10bf-404a-859c-a56f6070c241','RAL 7045','Gris tele 1','RAL','#909090',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3febd7fb-77e6-4fe3-b19e-88aff9692007','RAL 7046','Gris tele 2','RAL','#82898F',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d75795d6-862f-4bfb-86a8-0ec4a96cabc0','RAL 7047','Gris tele 4','RAL','#D0D0D0',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('54c93285-a45f-4498-beff-ae0b954c468e','RAL 7048','Gris musgo perlado','RAL','#898176',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('ae7be845-90c1-441a-9c0e-e1a4400ce637','RAL 8000','Marrón amarillento','RAL','#826C34',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('08c12ebb-8a9f-4d01-afb0-9e54797617f1','RAL 8001','Marrón ocre','RAL','#955F20',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3321283e-10e9-43f8-b6b2-596ead889d7d','RAL 8002','Marrón señales','RAL','#6C3B2A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b633f101-78da-45cf-8f41-96434e61ec58','RAL 8003','Marrón arcilla','RAL','#734222',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('44be727a-6cd9-4a84-bcd0-5ce842e4ff64','RAL 8004','Marrón cobre','RAL','#8E402A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9b1219b9-b0c1-4b15-b153-fe9d08e833a0','RAL 8007','Marrón corzo','RAL','#59351F',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d56e94cb-b820-4146-ab69-9aed5cadf0f8','RAL 8008','Marrón oliva','RAL','#6F4F28',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('89d5bdbc-ff5a-4db0-ac89-823addeb9dd3','RAL 8011','Marrón nuez','RAL','#5B3A29',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f3b36cac-ac34-42d2-8e8d-9d4a2a5db4e9','RAL 8012','Marrón rojizo','RAL','#592321',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('73204f8c-5505-45b5-b20a-e18de5733b7a','RAL 8014','Marrón sepia','RAL','#382C1E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('5e030f31-a2e4-4bab-8cde-06f9274e9934','RAL 8015','Marrón castaño','RAL','#633A34',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('d5282eff-c63b-492c-aaf1-4af8c36eef13','RAL 8016','Marrón caoba','RAL','#4C2F27',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3d974054-233d-4c38-a2f3-3db03625063d','RAL 8017','Marrón chocolate','RAL','#45322E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('38833bef-49e6-4b68-a003-e8abe16c99ca','RAL 8019','Marrón grisáceo','RAL','#403A3A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('099d8ced-df5c-4b18-82b1-5f66183cb156','RAL 8022','Marrón negruzco','RAL','#212121',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('7bd512a8-84a5-490f-87ad-247ae4fa51b4','RAL 8023','Marrón anaranjado','RAL','#A65E2E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('0a37ae5e-1557-4dcf-bd41-32c5fb8674d9','RAL 8024','Marrón beige','RAL','#79553D',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('351646b5-66d2-418e-8d11-524581bb2c5e','RAL 8025','Marrón pálido','RAL','#755C48',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('a333b5af-b42c-4001-875c-18daab568f83','RAL 8028','Marrón tierra','RAL','#4E3B31',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('16632394-bcf1-47b5-a261-004898a450df','RAL 8029','Cobre perlado','RAL','#763C28',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('22942570-bc87-47ce-9e82-9861458eca73','RAL 9001','Blanco crema','RAL','#FDF4E3',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('7029fe34-731c-4717-8e28-0191155b838a','RAL 9002','Blanco grisáceo','RAL','#E7EBDA',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('b669e597-f4ec-435d-aa63-d026cb7636f4','RAL 9003','Blanco señales','RAL','#F4F4F4',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1f646580-00ab-44c3-8cad-23b811e36359','RAL 9004','Negro señales','RAL','#282828',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('3456a92b-44a5-4541-9ec5-b67c7587dd3e','RAL 9005','Negro intenso','RAL','#0A0A0A',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('19a5aca7-0f9f-4f05-ad0a-9e9db0f5e2b9','RAL 9006','Aluminio blanco','RAL','#A5A5A5',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('9a4378db-57b8-4a7e-8cdb-1b200b21f4b0','RAL 9007','Aluminio gris','RAL','#8F8F8F',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('1b03d179-bbae-4b3b-a622-2989a1454689','RAL 9010','Blanco puro','RAL','#FFFFFF',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('774f2b42-63de-47a0-865f-2ba5f3ac9e88','RAL 9011','Negro grafito','RAL','#1C1C1C',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('15484c1c-bb4e-468a-bd48-dc4155a44191','RAL 9016','Blanco tráfico','RAL','#F6F6F6',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('f34c9e45-351d-46b1-bc10-c48f7126da3d','RAL 9017','Negro tráfico','RAL','#1E1E1E',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('ea955a12-cb9c-48b3-8893-571a7fbdd0f5','RAL 9018','Blanco papiro','RAL','#D7D7D7',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('0b8bc6ba-cb40-4d50-9b92-f6b46fa57902','RAL 9022','Gris claro perlado','RAL','#9C9C9C',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.colores_legacy (id, codigo, nombre, tipo, hex_aproximado, observaciones, sobrecoste, activo, created_at) VALUES ('e171ed02-9f69-411a-9c42-2ccb1b348661','RAL 9023','Gris oscuro perlado','RAL','#828282',NULL,'0.00','t','2026-04-18 06:44:42.019988+00') ON CONFLICT (codigo) DO NOTHING;


-- ---------- 7b) catálogos pequeños (incl. proveedores antes de materiales) ----------
-- ---------- SEED CATÁLOGOS (sin colores_legacy ni materiales) ----------
-- Orden importa: respeta dependencias FK.

-- ===== niveles_complejidad (sin FKs) =====
INSERT INTO public.niveles_complejidad (id, codigo, nombre, multiplicador, descripcion, orden, activo, created_at) VALUES ('1','SIMPLE','Simple','1.00','Pieza plana sin relieves, geometría regular.','1','t','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.niveles_complejidad (id, codigo, nombre, multiplicador, descripcion, orden, activo, created_at) VALUES ('2','MEDIA','Media','1.30','Relieves ligeros, bordes trabajados, un par de detalles.','2','t','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.niveles_complejidad (id, codigo, nombre, multiplicador, descripcion, orden, activo, created_at) VALUES ('3','COMPLEJA','Compleja','1.70','Muchos detalles, geometría irregular, difícil de lacar.','3','t','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;

-- ===== procesos_catalogo (sin FKs) =====
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('7d96543e-f437-41c3-ad1a-1d139aff7712','COMPROB_MATERIAL','Comprobación material','0','#94a3b8','f','f','f','Check rápido: ¿tenemos el color para lacar?','t','2026-04-20 19:03:12.497325+00','f','C','f','0','Oficina') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('91c1d9a3-09e8-49e7-b8a7-216f5939317c','RECEPCION','Recepción','1','#94a3b8','f','f','t','Recepción de piezas del cliente, inspección inicial y etiquetado QR.','t','2026-04-17 20:57:02.55845+00','f','R','f','0','Oficina') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('61605cdd-01f3-47c7-bbb6-8051d8b6821a','LIJADO','Lijado','2','#f59e0b','t','f','t','Lijado manual o mecánico. Puede repetirse entre fondos.','t','2026-04-17 20:57:02.55845+00','t','L','f','0','Lijador') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('a449343e-476f-4105-ab5d-b92638f74428','LIJADO_2','Lijado 2 (opcional)','3','#fbbf24','t','f','t','Segundo lijado tras primer fondo (opcional)','t','2026-04-20 19:03:12.497325+00','t','L2','f','0','Lijador') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('2b695c9f-470f-46c7-8733-30119e6261cb','FONDO','Fondo','3','#f97316','t','f','t','Aplicación de fondo/imprimación. Puede haber varios fondos.','t','2026-04-17 20:57:02.55845+00','t','F','t','240','Fondeador') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('09c03c5e-cabc-4cfd-8de9-725ff83193ee','LACADO','Lacado','4','#3b82f6','f','f','t','Aplicación del color final (RAL o acabado elegido).','t','2026-04-17 20:57:02.55845+00','t','La','t','480','Lacador') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('172de86e-214c-44d1-bbbe-9874fd0be776','FONDEADO_2','Fondeado 2 (opcional)','4','#facc15','t','f','t','Segunda mano de fondo (opcional)','t','2026-04-20 19:03:12.497325+00','t','F2','t','240','Fondeador') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('d7ee5397-9fcb-4b32-9da1-d4579bbfded3','SECADO','Secado','5','#8b5cf6','f','t','f','Tiempo de secado. No requiere operario, bloquea la pieza.','t','2026-04-17 20:57:02.55845+00','f',NULL,'f','0',NULL) ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('c94d7a64-ee32-4a47-9b47-a63e1f14f887','MANIPULADO','Manipulado','6','#10b981','f','f','t','Colocación de herrajes, bisagras, etc.','t','2026-04-17 20:57:02.55845+00','f',NULL,'f','0',NULL) ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('c86af5d4-0770-4244-98c4-0465dab45738','TERMINACION','Terminación','7','#14b8a6','f','f','t','Retoques finales, pulido, control visual.','t','2026-04-17 20:57:02.55845+00','f','T','f','0','Taller') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('409cec13-7a9d-4605-93a6-62b7a3073614','EMPAQUETADO','Empaquetado','8','#06b6d4','f','f','t','Protección y embalaje para entrega.','t','2026-04-17 20:57:02.55845+00','f',NULL,'f','0',NULL) ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('0b37b816-59a4-47ea-a281-c660e223b8df','PICKING','Picking','8','#a855f7','f','f','t','Preparación final para entrega al cliente','t','2026-04-20 19:03:12.497325+00','f','P','f','0','Taller') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.procesos_catalogo (id, codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo, created_at, escala_por_m2, abreviatura, requiere_secado, tiempo_secado_minutos, rol_operario_requerido) VALUES ('97f01aca-643f-4d15-aaef-dc2ae02abb65','LISTO_ENTREGA','Listo entrega','9','#22c55e','f','f','f','Pieza terminada y a la espera de que el cliente la recoja / se entregue.','t','2026-04-17 20:57:02.55845+00','f',NULL,'f','0',NULL) ON CONFLICT (codigo) DO NOTHING;

-- ===== tratamientos (sin FKs) =====
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('744f99c9-f6d8-4f09-9c4d-7f3260c112f6','Acabado alto brillo','Lacado con pulido para brillo espejo.','1.60','180','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('929855b8-ed33-456c-acb5-581a90f37a71','Acabado mate total','Lacado con acabado mate <10 de brillo.','1.10','130','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('085cca37-21df-4f11-ba39-8c7736113d68','Imprimación / Fondo','Solo aplicación de fondo sellador, sin lacado final.','0.50','60','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('b151c08a-304e-433d-96a0-568f997c9476','Lacado bicolor','Dos colores en la misma pieza (requiere enmascarado).','1.80','200','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('7bdf787a-41fb-4d5c-9e14-261047a6b628','Lacado con doble fondo','Dos manos de fondo con lijado intermedio para acabado premium.','1.20','150','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('800fc36d-dfab-4096-96f8-ad94070f573e','Lacado degradado','Transición suave entre dos colores.','2.00','240','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('1c5dbc38-7c7b-425f-a7a5-8e2d01eabf25','Lacado estándar','Proceso completo: lijado + fondo + lijado + fondo + lacado + secado. El servicio más habitual.','1.00','120','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('21d0e9d6-0749-4de7-9d39-caf6b0c12cef','Lacado poliuretano','Acabado de alta resistencia con pintura poliuretano.','1.50','140','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('66834b15-31df-4c40-b1e0-61c9869dc751','Lacado sin fondo','Lacado directo sobre pieza ya preparada o relacado.','0.70','40','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('4db85893-2aac-4c4c-bc6d-ace5887dcea3','Lacado texturizado','Acabado con textura especial (rugoso, piel naranja, etc.).','1.40','130','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('9938f884-c9a3-41e3-a69d-0acff0b4f221','Lijado solo','Solo servicio de lijado, sin fondo ni lacado.','0.30','30','t','2026-04-19 18:32:54.915434+00');
INSERT INTO public.tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo, created_at) VALUES ('3a385a4b-44c3-4245-a70d-5997ea2a4609','Relacado / Repaso','Segunda capa o repaso sobre lacado existente.','0.60','50','t','2026-04-19 18:32:54.915434+00');

-- ===== proveedores (sin FKs) =====
INSERT INTO public.proveedores (id, nombre, tipo_material, precio_base_kg, telefono, email, notas, activo, created_at, updated_at) VALUES ('d99a9476-4880-48d1-a9fe-c34e05ebaa7b','Proveedor Catalizador 1','catalizador','0',NULL,NULL,'Renombrar','t','2026-04-21 21:43:01.767512+00','2026-04-21 21:43:01.767512+00');
INSERT INTO public.proveedores (id, nombre, tipo_material, precio_base_kg, telefono, email, notas, activo, created_at, updated_at) VALUES ('0a44ad53-d7e5-4b78-aa47-985ec22f5f52','Proveedor Disolvente 1','disolvente','0',NULL,NULL,'Renombrar','t','2026-04-21 21:43:01.767512+00','2026-04-21 21:43:01.767512+00');
INSERT INTO public.proveedores (id, nombre, tipo_material, precio_base_kg, telefono, email, notas, activo, created_at, updated_at) VALUES ('dfb13916-13e8-4691-80e0-81a511adbddf','Proveedor Fondo 1','fondo','0',NULL,NULL,'Renombrar','t','2026-04-21 21:43:01.767512+00','2026-04-21 21:43:01.767512+00');
INSERT INTO public.proveedores (id, nombre, tipo_material, precio_base_kg, telefono, email, notas, activo, created_at, updated_at) VALUES ('fa520b8c-ba77-434d-a79a-f187c6308133','Proveedor Fondo 2','fondo','0',NULL,NULL,'Renombrar','t','2026-04-21 21:43:01.767512+00','2026-04-21 21:43:01.767512+00');
INSERT INTO public.proveedores (id, nombre, tipo_material, precio_base_kg, telefono, email, notas, activo, created_at, updated_at) VALUES ('46f71f34-bb60-4d80-a8d7-c861fdfe34c4','Proveedor Fondo 3','fondo','0',NULL,NULL,'Renombrar','t','2026-04-21 21:43:01.767512+00','2026-04-21 21:43:01.767512+00');
INSERT INTO public.proveedores (id, nombre, tipo_material, precio_base_kg, telefono, email, notas, activo, created_at, updated_at) VALUES ('29e6d6be-c065-47af-a163-3a2528e80e8a','Proveedor Lacado 1','lacado','0',NULL,NULL,'Renombrar con datos reales','t','2026-04-21 21:43:01.767512+00','2026-04-21 21:43:01.767512+00');
INSERT INTO public.proveedores (id, nombre, tipo_material, precio_base_kg, telefono, email, notas, activo, created_at, updated_at) VALUES ('61360886-a89c-4b4f-b77f-76614175b36a','Proveedor Lacado 2','lacado','0',NULL,NULL,'Renombrar','t','2026-04-21 21:43:01.767512+00','2026-04-21 21:43:01.767512+00');
INSERT INTO public.proveedores (id, nombre, tipo_material, precio_base_kg, telefono, email, notas, activo, created_at, updated_at) VALUES ('d4323d60-9272-43d6-8ed1-4e2b16e8cc9d','Proveedor Lacado 3','lacado','0',NULL,NULL,'Renombrar','t','2026-04-21 21:43:01.767512+00','2026-04-21 21:43:01.767512+00');

-- ===== ubicaciones (sin FKs) =====
INSERT INTO public.ubicaciones (id, codigo, nombre, tipo, capacidad_aprox, notas, activo, created_at, updated_at) VALUES ('1e29c7fa-9aa3-458c-82d3-aee378d799cc','C-01','Carrito 1','carrito',NULL,NULL,'t','2026-04-20 20:42:26.623001+00','2026-04-20 20:42:26.623001+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.ubicaciones (id, codigo, nombre, tipo, capacidad_aprox, notas, activo, created_at, updated_at) VALUES ('b55037f0-b69b-43f8-99d8-eea011b2704c','C-02','Carrito 2','carrito',NULL,NULL,'t','2026-04-20 20:42:26.623001+00','2026-04-20 20:42:26.623001+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.ubicaciones (id, codigo, nombre, tipo, capacidad_aprox, notas, activo, created_at, updated_at) VALUES ('aa578fde-fbcb-4619-b630-73b94bf0e26f','C-03','Carrito 3','carrito',NULL,NULL,'f','2026-04-20 20:42:26.623001+00','2026-04-21 06:46:33.020871+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.ubicaciones (id, codigo, nombre, tipo, capacidad_aprox, notas, activo, created_at, updated_at) VALUES ('50dc2013-b5e7-4bff-8c8c-f1d2136025e0','E-01','Estantería 1','estanteria',NULL,NULL,'t','2026-04-20 20:42:26.623001+00','2026-04-20 20:42:26.623001+00') ON CONFLICT (codigo) DO NOTHING;

-- ===== operarios (sin FKs) =====
INSERT INTO public.operarios (id, nombre, rol, color, activo, notas, created_at, updated_at) VALUES ('cdf569ce-cbcd-44f1-bda0-7ba85d507a84','Juan','Lijador','#2563eb','t',NULL,'2026-04-21 08:32:11.793972+00','2026-04-21 08:32:11.793972+00');
INSERT INTO public.operarios (id, nombre, rol, color, activo, notas, created_at, updated_at) VALUES ('55f7814e-8fc1-428b-904a-541b4538006e','Julio','Lacador','#0d9488','t',NULL,'2026-04-21 08:32:35.88833+00','2026-04-21 08:32:35.88833+00');
INSERT INTO public.operarios (id, nombre, rol, color, activo, notas, created_at, updated_at) VALUES ('c8501f90-a983-4b61-9dc2-97e6b6e89baa','Paco','Fondeador','#dc2626','t',NULL,'2026-04-21 08:32:25.328885+00','2026-04-21 08:32:25.328885+00');

-- ===== categorias_pieza (sin FKs) =====
INSERT INTO public.categorias_pieza (id, codigo, nombre, descripcion, orden, color, caras_default, contabilizar_grosor_default, modo_precio_default, permite_ml, procesos_default, activo, created_at, updated_at) VALUES ('0098de9d-b04d-4430-884b-cf90fd07c5c9','ZOCALO','Zócalos','Zócalos y rodapiés. Por defecto se tarifica por metro lineal y se pinta solo la cara frontal (no se contabiliza el borde porque queda pintado al pasar la pistola).','1','#8b5cf6','1','f','ml','t','[{"orden": 1, "proceso_codigo": "LIJADO"}, {"orden": 2, "proceso_codigo": "FONDO"}, {"orden": 3, "proceso_codigo": "LACADO"}]'::jsonb,'t','2026-04-21 21:42:43.414022+00','2026-04-21 21:42:43.414022+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.categorias_pieza (id, codigo, nombre, descripcion, orden, color, caras_default, contabilizar_grosor_default, modo_precio_default, permite_ml, procesos_default, activo, created_at, updated_at) VALUES ('80574c59-23b4-49b9-be1e-b88910177818','PUERTA','Puertas','Puertas de paso, abatibles o de armario. 2 caras sin grosor. Doble fondeado (típico para acabado fino).','2','#3b82f6','2','f','m2','f','[{"orden": 1, "proceso_codigo": "LIJADO"}, {"orden": 2, "proceso_codigo": "FONDO"}, {"orden": 3, "proceso_codigo": "LIJADO_2"}, {"orden": 4, "proceso_codigo": "FONDEADO_2"}, {"orden": 5, "proceso_codigo": "LACADO"}]'::jsonb,'t','2026-04-21 21:42:43.414022+00','2026-04-21 21:42:43.414022+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.categorias_pieza (id, codigo, nombre, descripcion, orden, color, caras_default, contabilizar_grosor_default, modo_precio_default, permite_ml, procesos_default, activo, created_at, updated_at) VALUES ('e5ed4489-66e5-4bc2-b0d3-9f825397da8f','MUEBLE_COCINA','Mueble cocina','Frentes, puertas y cajones de mueble de cocina. 2 caras sin grosor (el borde se pinta de paso al pintar la frontal).','3','#10b981','2','f','m2','f','[{"orden": 1, "proceso_codigo": "LIJADO"}, {"orden": 2, "proceso_codigo": "FONDO"}, {"orden": 3, "proceso_codigo": "LIJADO_2"}, {"orden": 4, "proceso_codigo": "FONDEADO_2"}, {"orden": 5, "proceso_codigo": "LACADO"}]'::jsonb,'t','2026-04-21 21:42:43.414022+00','2026-04-21 21:42:43.414022+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.categorias_pieza (id, codigo, nombre, descripcion, orden, color, caras_default, contabilizar_grosor_default, modo_precio_default, permite_ml, procesos_default, activo, created_at, updated_at) VALUES ('ed9aebbb-449f-4d8e-b086-2b3ce5c12544','MOBILIARIO','Mobiliario','Tableros, cuerpos, cajones, mobiliario en general. Todas las caras + grosor.','4','#f59e0b','6','t','m2','f','[{"orden": 1, "proceso_codigo": "LIJADO"}, {"orden": 2, "proceso_codigo": "FONDO"}, {"orden": 3, "proceso_codigo": "LACADO"}]'::jsonb,'t','2026-04-21 21:42:43.414022+00','2026-04-21 21:42:43.414022+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.categorias_pieza (id, codigo, nombre, descripcion, orden, color, caras_default, contabilizar_grosor_default, modo_precio_default, permite_ml, procesos_default, activo, created_at, updated_at) VALUES ('3589ce7e-99b3-40a3-9e05-52d9bd4b3c09','LISTON','Listones','Listones y piezas prismáticas (tipo 10x10). 4 caras con grosor. Admite precio por m² o por metro lineal.','5','#ef4444','4','t','m2','t','[{"orden": 1, "proceso_codigo": "LIJADO"}, {"orden": 2, "proceso_codigo": "FONDO"}, {"orden": 3, "proceso_codigo": "LACADO"}]'::jsonb,'t','2026-04-21 21:42:43.414022+00','2026-04-21 21:42:43.414022+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.categorias_pieza (id, codigo, nombre, descripcion, orden, color, caras_default, contabilizar_grosor_default, modo_precio_default, permite_ml, procesos_default, activo, created_at, updated_at) VALUES ('85e6609e-e254-4c9c-beda-77c2f5522940','IRREGULAR','Irregular','Piezas de forma irregular sin medidas precisas. Precio manual sin motor de cálculo.','6','#64748b','6','f','manual','f','[{"orden": 1, "proceso_codigo": "LIJADO"}, {"orden": 2, "proceso_codigo": "FONDO"}, {"orden": 3, "proceso_codigo": "LACADO"}]'::jsonb,'t','2026-04-21 21:42:43.414022+00','2026-04-21 21:42:43.414022+00') ON CONFLICT (codigo) DO NOTHING;

-- ===== categorias_producto (sin FKs) =====
INSERT INTO public.categorias_producto (id, nombre, descripcion, color, orden, activo, created_at, updated_at) VALUES ('2e902085-27f0-4e3e-9d13-923a3d09d05b','Carpintería',NULL,'#64748b','0','t','2026-04-20 19:48:14.647183+00','2026-04-20 19:48:14.647183+00') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO public.categorias_producto (id, nombre, descripcion, color, orden, activo, created_at, updated_at) VALUES ('c5b1a4ca-f8a6-4b70-8161-fb7609f7dfb7','COCINAS',NULL,'#64748b','0','t','2026-04-20 19:48:14.647183+00','2026-04-20 19:48:14.647183+00') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO public.categorias_producto (id, nombre, descripcion, color, orden, activo, created_at, updated_at) VALUES ('0a30157e-88b8-4172-97b4-a4ca57c4bb09','Mobiliario',NULL,'#64748b','0','t','2026-04-20 19:48:14.647183+00','2026-04-20 19:48:14.647183+00') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO public.categorias_producto (id, nombre, descripcion, color, orden, activo, created_at, updated_at) VALUES ('91cedc88-1a23-4847-8094-8d91c27b8ac0','Molduras',NULL,'#64748b','0','t','2026-04-20 19:48:14.647183+00','2026-04-20 19:48:14.647183+00') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO public.categorias_producto (id, nombre, descripcion, color, orden, activo, created_at, updated_at) VALUES ('fcfa856c-b2e4-410a-9272-de5426be737f','Tableros',NULL,'#64748b','0','t','2026-04-20 19:48:14.647183+00','2026-04-20 19:48:14.647183+00') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO public.categorias_producto (id, nombre, descripcion, color, orden, activo, created_at, updated_at) VALUES ('c7311f9e-8812-4bce-85a8-515f94dc11cf','Varios',NULL,'#64748b','0','t','2026-04-20 19:48:14.647183+00','2026-04-20 19:48:14.647183+00') ON CONFLICT (nombre) DO NOTHING;

-- ===== productos (FK → categorias_producto) =====
INSERT INTO public.productos (id, nombre, categoria, descripcion, unidad_tarificacion, activo, created_at, categoria_id) VALUES ('0f6bdd14-3e7c-4b0b-98b0-ea64bc398a66','Puerta armario','Carpintería',NULL,'m2','t','2026-04-21 22:49:49.85296+00','2e902085-27f0-4e3e-9d13-923a3d09d05b');

-- ===== carros (sin FKs) =====
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('d37789c0-062c-4c75-bf5b-838b2f11834c','CARRO-01','Carro 01','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('d7b86d5a-f601-411a-bee1-6aaa223c5077','CARRO-02','Carro 02','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('7ef8de2d-9df8-4ba0-bb37-944620843b03','CARRO-03','Carro 03','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('9b9a500b-3029-4626-85d5-147d3cf4c7d7','CARRO-04','Carro 04','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('cc41e47a-0cf0-4a8a-a76c-8061b7336921','CARRO-05','Carro 05','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('84474a3a-54a7-42f4-8838-3a1a9517c9ec','CARRO-06','Carro 06','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('2bf87862-83bc-40eb-b4a3-deaa64066aba','CARRO-07','Carro 07','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('5c140a3b-3704-4f84-8f31-df677e66fcc8','CARRO-08','Carro 08','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('691ebc6a-f500-47d0-8c80-e8727333153e','CARRO-09','Carro 09','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO public.carros (id, codigo, nombre, capacidad_piezas, capacidad_m2, ubicacion_actual, qr_code, notas, activo, created_at, updated_at) VALUES ('53fd4161-62e4-478f-9cea-981be56c6737','CARRO-10','Carro 10','20','10.00','Taller',NULL,NULL,'t','2026-04-17 20:57:02.55845+00','2026-04-17 20:57:02.55845+00') ON CONFLICT (codigo) DO NOTHING;

-- ===== config_tiempos_proceso (FK → procesos_catalogo, categorias_pieza) =====
INSERT INTO public.config_tiempos_proceso (id, proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min, created_at, updated_at) VALUES ('d6342e74-66c0-4a05-a0a4-c93066b72230','7d96543e-f437-41c3-ad1a-1d139aff7712',NULL,'1.00','0.00','0.00','2026-04-23 05:00:14.606783+00','2026-04-23 05:00:14.606783+00');
INSERT INTO public.config_tiempos_proceso (id, proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min, created_at, updated_at) VALUES ('97eed751-146a-4d33-9d38-b8d7a0588e3f','61605cdd-01f3-47c7-bbb6-8051d8b6821a',NULL,'2.00','15.00','0.00','2026-04-23 05:00:14.606783+00','2026-04-23 05:00:14.606783+00');
INSERT INTO public.config_tiempos_proceso (id, proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min, created_at, updated_at) VALUES ('2fe217cc-7bd4-48b1-8ea9-7a835a649f4f','2b695c9f-470f-46c7-8733-30119e6261cb',NULL,'3.00','12.00','0.00','2026-04-23 05:00:14.606783+00','2026-04-23 05:00:14.606783+00');
INSERT INTO public.config_tiempos_proceso (id, proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min, created_at, updated_at) VALUES ('eafd50f7-ee88-4618-bfd4-66eb2a182b45','a449343e-476f-4105-ab5d-b92638f74428',NULL,'2.00','10.00','0.00','2026-04-23 05:00:14.606783+00','2026-04-23 05:00:14.606783+00');
INSERT INTO public.config_tiempos_proceso (id, proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min, created_at, updated_at) VALUES ('b7d3c2fd-d139-4c5f-bce6-750759d8bb1a','172de86e-214c-44d1-bbbe-9874fd0be776',NULL,'3.00','10.00','0.00','2026-04-23 05:00:14.606783+00','2026-04-23 05:00:14.606783+00');
INSERT INTO public.config_tiempos_proceso (id, proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min, created_at, updated_at) VALUES ('8f2b5c31-963a-41dc-879d-2cd81a1d3fe0','09c03c5e-cabc-4cfd-8de9-725ff83193ee',NULL,'3.00','15.00','0.00','2026-04-23 05:00:14.606783+00','2026-04-23 05:00:14.606783+00');
INSERT INTO public.config_tiempos_proceso (id, proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min, created_at, updated_at) VALUES ('ab26e14e-6dca-49da-993c-268e19dafe30','c86af5d4-0770-4244-98c4-0465dab45738',NULL,'2.00','3.00','0.00','2026-04-23 05:00:14.606783+00','2026-04-23 05:00:14.606783+00');
INSERT INTO public.config_tiempos_proceso (id, proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min, created_at, updated_at) VALUES ('45035796-d018-41d1-a348-c95d831bffd2','91c1d9a3-09e8-49e7-b8a7-216f5939317c',NULL,'1.00','0.00','0.00','2026-04-23 05:00:14.606783+00','2026-04-23 05:00:14.606783+00');
INSERT INTO public.config_tiempos_proceso (id, proceso_id, categoria_pieza_id, tiempo_base_min, tiempo_por_m2_min, tiempo_por_ml_min, created_at, updated_at) VALUES ('34a782d7-0f5c-4feb-828a-53532989278c','0b37b816-59a4-47ea-a281-c660e223b8df',NULL,'2.00','0.00','0.00','2026-04-23 05:00:14.606783+00','2026-04-23 05:00:14.606783+00');

-- ---------- SEED materiales (275 filas: 272 lacados + 1 fondo + catalizador + disolvente) ----------
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ae5f80da-a563-451d-9d9b-25965d201305','catalizador','CATA-DEFAULT','Catalizador por defecto','generico',NULL,'d99a9476-4880-48d1-a9fe-c34e05ebaa7b','15',NULL,NULL,'19.92','0.18039999999999998','0','Placeholder. Reemplazar por el catalizador real desde /materiales.','t','2026-04-21 21:43:01.767512+00','2026-04-23 19:06:01.75+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('819a29cc-6baa-4072-b274-399cdc5fa723','disolvente','DIS-DEFAULT','Disolvente por defecto','generico','#FFFFFF','0a44ad53-d7e5-4b78-aa47-985ec22f5f52','21','5',NULL,'4.84','0.36079999999999995','20','Placeholder. Reemplazar por el disolvente real desde /materiales.','t','2026-04-21 21:43:01.767512+00','2026-04-23 19:06:02.475+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('c28ba1f2-122a-460c-a8f1-431b600f9a70','fondo','FONDO-BLANCO','Fondo blanco genérico','generico',NULL,'dfb13916-13e8-4691-80e0-81a511adbddf','20',NULL,NULL,'9.4','0.984','0','Placeholder inicial. Añade tus fondos reales desde /materiales.','t','2026-04-21 21:43:01.767512+00','2026-04-23 19:06:01.232+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('6db14732-1ed8-4313-b746-359cef5c4403','lacado','NCS S 0300-N','Blanco puro NCS','NCS','#F5F5F0','29e6d6be-c065-47af-a163-3a2528e80e8a',NULL,NULL,NULL,'0','0','0',NULL,'f','2026-04-19 18:07:10.195683+00','2026-04-22 19:26:27.152+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a9249346-2552-4c67-b49a-e355dc487bf9','lacado','NCS S 0500-N','Blanco NCS','NCS','#F0F0EB','29e6d6be-c065-47af-a163-3a2528e80e8a','10',NULL,NULL,'50','0.13440000000000002','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-23 19:06:00.709+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('9032ac96-4f39-4fa7-b84a-fe6c3f865878','lacado','NCS S 0502-B','Blanco azulado','NCS','#EDF0F2','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('c8960bde-0a7b-44e6-9782-f39113e19218','lacado','NCS S 0502-G','Blanco verdoso','NCS','#EFF2ED','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0.768','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-23 05:48:39.094+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3faa34fa-a5b2-4685-8db9-25b345f4a153','lacado','NCS S 0502-R','Blanco rosado','NCS','#F2EDEE','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('8347f3ea-3803-468d-b084-ab6a7d30629e','lacado','NCS S 0502-Y','Blanco cálido','NCS','#F2F0E6','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('454303b7-5611-43c5-9599-041958592a09','lacado','NCS S 0804-G80Y','Blanco arena suave','NCS','#EAE6D2','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('1a18f90e-2c2c-49da-957a-a0d1cfcbe0f6','lacado','NCS S 0804-Y30R','Blanco hueso cálido','NCS','#EDE5D4','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('62368c4a-73f2-4219-9543-35e60df761e5','lacado','NCS S 0804-Y50R','Blanco hueso','NCS','#EDE3D6','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('82b24e9a-e3c8-4a29-a359-23e24f22f05c','lacado','NCS S 1000-N','Gris muy claro NCS','NCS','#E5E5E0','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b85df6d1-7060-4292-9a43-96a1673b94f4','lacado','NCS S 1002-B','Blanco antiguo azulado','NCS','#E0E3E5','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d0001c14-071c-49f2-83fc-d5fa0a64adfd','lacado','NCS S 1002-G','Blanco antiguo verdoso','NCS','#E2E5DA','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a59e5872-3e40-47a0-bf0a-ddc0c8f7c91c','lacado','NCS S 1002-R','Blanco antiguo rosado','NCS','#E5E0DE','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('52a49503-9a13-4fd8-a13f-9a87c169a687','lacado','NCS S 1002-Y','Blanco antiguo cálido','NCS','#E6E2D2','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('1e123f59-1a7c-4f49-9038-c4f1ec76903a','lacado','NCS S 1005-G80Y','Arena claro','NCS','#E0DFC9','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('7e49e774-7196-4ab1-adfa-8d94647bf04b','lacado','NCS S 1005-Y20R','Marfil NCS','NCS','#E3DCCB','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('55ff082c-a67b-4d82-b245-62128017b836','lacado','NCS S 1005-Y50R','Crema claro','NCS','#E3DACF','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3d466047-3bfe-4472-9a3b-d1583546c6d3','lacado','NCS S 1500-N','Gris perla NCS','NCS','#D8D8D3','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('99d57f83-de73-44ee-88da-dc240918b3b1','lacado','NCS S 1502-B','Gris perla azulado','NCS','#D3D6D8','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('da8eda2c-abd4-4a67-9400-8ed8bf0cca6f','lacado','NCS S 1502-G','Gris perla verdoso','NCS','#D4D8D1','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('7e692417-e8e4-492f-b116-fb9b4d0e18b4','lacado','NCS S 1502-R','Gris perla rosado','NCS','#D8D4D3','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('68cdb4fa-46f6-4c25-a663-8689dd489a5d','lacado','NCS S 1502-Y','Gris perla cálido','NCS','#D9D7CB','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('7a81bb43-94b3-4a30-b81a-149d3371f274','lacado','NCS S 2000-N','Gris claro NCS','NCS','#CBCBC6','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('cb9fb065-338a-4a92-985e-3449d3dedd51','lacado','NCS S 2002-B','Gris claro azulado','NCS','#BDC1C4','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('7a4d606e-f36e-473c-813a-1223b99dba07','lacado','NCS S 2002-G','Gris claro verdoso','NCS','#BFC4BB','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('5af281e5-c304-4d83-9da5-3b9141857e65','lacado','NCS S 2002-R','Gris claro rosado','NCS','#C4BFBD','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ec75c9e8-53ed-418b-8fe3-a418c57735a2','lacado','NCS S 2002-Y','Gris claro cálido','NCS','#C5C3B5','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('44fc6cde-3293-43d6-a0c0-83f7b8f9c6c9','lacado','NCS S 2005-Y20R','Gris arena claro','NCS','#C2BDA9','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3b1ae390-a58c-4cf8-ae01-4cb9bdd9cac0','lacado','NCS S 2500-N','Gris plata NCS','NCS','#BDBDB8','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('8adaeee7-de65-4ad3-8033-1222decd65a8','lacado','NCS S 3000-N','Gris medio NCS','NCS','#B0B0AB','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ce1d6c4e-8769-4834-ba46-aadf0b5bde1b','lacado','NCS S 3002-B','Gris medio azulado','NCS','#A3A7AA','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3e377222-8eb4-432b-b606-1805fa74fd06','lacado','NCS S 3002-G','Gris medio verdoso','NCS','#A5AAA0','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('23ddb8a6-1c95-4760-9d49-45f52420921a','lacado','NCS S 3002-R','Gris medio rosado','NCS','#AAA4A2','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('79370c08-5028-45c5-8bac-680453b97faf','lacado','NCS S 3002-Y','Gris medio cálido','NCS','#ACA99A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3ba1d47a-0f26-4bf2-a407-51caa3d1ed8a','lacado','NCS S 3005-Y20R','Gris arena medio','NCS','#A8A28E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('de6f9454-162e-4257-9b57-934868c24511','lacado','NCS S 3500-N','Gris medio oscuro NCS','NCS','#9E9E99','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e018952c-d760-4d94-a9c5-c12656e5cfa3','lacado','NCS S 4000-N','Gris oscuro NCS','NCS','#969691','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('21e659ae-6d0d-452c-990b-f7db1d756f37','lacado','NCS S 4500-N','Gris pizarra claro','NCS','#858580','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('2d525665-c5ce-4c1a-b6b5-16f989a73d03','lacado','NCS S 4502-B','Gris oscuro azulado','NCS','#888C8F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ac331486-077a-4ba4-944b-800cef7d3fdc','lacado','NCS S 4502-G','Gris oscuro verdoso','NCS','#8A8F86','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('15153cbe-b7c1-4970-8022-7b7e0e2ee141','lacado','NCS S 4502-Y','Gris oscuro cálido','NCS','#908D7F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('79ee8a77-28ae-42c8-b62f-b5f29ff70d1c','lacado','NCS S 5000-N','Gris intenso NCS','NCS','#7B7B76','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('c73058be-492c-4cf9-9fe7-77b7a209e72f','lacado','NCS S 5500-N','Gris carbón claro','NCS','#6B6B66','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ed254148-3040-486e-9869-2cce92095b28','lacado','NCS S 5502-B','Gris intenso azulado','NCS','#6D7174','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('cbe9ddc5-60de-4c9b-a98b-f74b07e08e2e','lacado','NCS S 5502-G','Gris intenso verdoso','NCS','#6F746B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('818fa659-79e6-4b2c-9520-d66fde311c66','lacado','NCS S 5502-Y','Gris intenso cálido','NCS','#767363','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0bb9b53c-1ca7-4ed6-9eba-ff6d70d16e83','lacado','NCS S 6000-N','Gris grafito NCS','NCS','#656560','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a1085cf3-c5e4-4de1-9055-ec94b162cd8f','lacado','NCS S 6500-N','Gris antracita NCS','NCS','#565651','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0fc41639-ac20-4e0e-98db-b407553e8d87','lacado','NCS S 6502-B','Gris grafito azulado','NCS','#565A5D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a33a8512-e200-44a1-ab93-7a21c41ce65e','lacado','NCS S 6502-Y','Gris grafito cálido','NCS','#605D4F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('23ed7046-8850-4d96-9453-529fc0ca3e53','lacado','NCS S 7000-N','Gris muy oscuro NCS','NCS','#4D4D48','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('6152b861-d4eb-46a0-be2e-6cef71f5c9d3','lacado','NCS S 7500-N','Gris oscuro profundo','NCS','#3F3F3A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('2da4b2be-5441-4a0c-9546-2d79d2b74715','lacado','NCS S 7502-B','Gris acero oscuro','NCS','#424649','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('9c3fb690-d04c-4d3f-a71b-a670b1bd7153','lacado','NCS S 7502-Y','Gris pardo oscuro','NCS','#4A4739','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('313b1446-d933-48f3-8b6b-8235a411435a','lacado','NCS S 8000-N','Gris negruzco NCS','NCS','#363631','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e03e9c42-b3a9-45e2-bc52-4d7d5bd83ff7','lacado','NCS S 8500-N','Casi negro NCS','NCS','#2A2A25','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('f299397a-2a5a-4e32-9135-9a904a2ecb57','lacado','NCS S 8502-B','Negro azulado NCS','NCS','#282C2F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('998295ea-06be-42b5-bad8-f2c2d66e236a','lacado','NCS S 8502-Y','Negro cálido NCS','NCS','#302D22','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4af677d1-45cf-4559-910d-2000bc263f8c','lacado','NCS S 9000-N','Negro NCS','NCS','#1A1A17','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-19 18:07:10.195683+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('c8445857-5bf2-4d77-88a0-95f04d3d9f7c','lacado','RAL 1000','Beige verdoso','RAL','#BEBD7F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ca37a83a-92b0-4040-91a1-70f178754f20','lacado','RAL 1001','Beige','RAL','#C2B078','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b8de6a08-5068-4369-bb8e-e82849c13438','lacado','RAL 1002','Beige arena','RAL','#C6A664','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('967f422d-f711-42bd-8724-8599702235c1','lacado','RAL 1003','Amarillo señales','RAL','#E5BE01','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('9881f26f-b3ad-4bb4-9361-91d6dbd0b2e1','lacado','RAL 1004','Amarillo oro','RAL','#CDA434','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a37af709-8817-4e49-8338-0933ec3d5815','lacado','RAL 1005','Amarillo miel','RAL','#A98307','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('41c915dc-aa41-43b7-b4e7-f96f54ebc8f8','lacado','RAL 1006','Amarillo maíz','RAL','#E4A010','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('81a5a013-5bbd-4378-9f4d-ac8b722768a7','lacado','RAL 1007','Amarillo narciso','RAL','#DC9D00','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a5311ed3-c485-4fd0-9c28-63e7253d0aa3','lacado','RAL 1011','Beige parduzco','RAL','#8A6642','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('138dedf9-30ff-49c6-a2b6-4b727258de2e','lacado','RAL 1012','Amarillo limón','RAL','#C7B446','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4c094ff0-07d8-4512-81b4-99b7a929d2f7','lacado','RAL 1013','Blanco perla','RAL','#EAE6CA','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ec30f974-2b86-49c0-adea-4895fdbca276','lacado','RAL 1014','Marfil','RAL','#E1CC4F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3d120a85-5271-42e4-b595-82ac7e58ac81','lacado','RAL 1015','Marfil claro','RAL','#E6D690','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3dd4bda2-fb55-43ea-a980-5a939b84403a','lacado','RAL 1016','Amarillo azufre','RAL','#EDFF21','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('c8007ba3-c241-448d-b298-9faaa1374862','lacado','RAL 1017','Amarillo azafrán','RAL','#F5D033','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('bc132fc9-e51b-49f8-9e15-f0a670e082ae','lacado','RAL 1018','Amarillo zinc','RAL','#F8F32B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('1bca599e-8cf6-4ff5-a042-0df56e280334','lacado','RAL 1019','Beige agrisado','RAL','#9E9764','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d066ade1-ed34-4402-9958-4d7210291ae6','lacado','RAL 1020','Amarillo oliva','RAL','#999950','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('36ca475d-489c-42c7-bed6-ffe8ba60baed','lacado','RAL 1021','Amarillo colza','RAL','#F3DA0B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a4c602ad-f918-4922-91ab-f8093cbe4066','lacado','RAL 1023','Amarillo tráfico','RAL','#FAD201','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3b215bd7-172b-4718-b969-6a01a2372632','lacado','RAL 1024','Amarillo ocre','RAL','#AEA04B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('298f7eb1-de3d-40b2-961a-5405cafb3b9b','lacado','RAL 1026','Amarillo brillante','RAL','#FFFF00','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d10788fe-9dd2-4e63-a46b-cf30dcd8858b','lacado','RAL 1027','Amarillo curry','RAL','#9D9101','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('60b5e348-f5c2-4e9b-91d3-7638ce0e0f8f','lacado','RAL 1028','Amarillo melón','RAL','#F4A900','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('db53e3b7-3ae7-4174-a3aa-595379988fda','lacado','RAL 1032','Amarillo retama','RAL','#D6AE01','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('306ab3c0-60d7-405d-b0dc-bc00cf47aae5','lacado','RAL 1033','Amarillo dalia','RAL','#F3A505','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('779ca7c2-a7e2-4ecb-a747-dbdab4b0850b','lacado','RAL 1034','Amarillo pastel','RAL','#EFA94A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0620bba3-779a-4d09-987a-2733417530aa','lacado','RAL 1035','Beige perlado','RAL','#6A5D4D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0d3a1c97-edab-483c-bfca-cd9df7c82375','lacado','RAL 1036','Oro perlado','RAL','#705335','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('29200712-4f87-4d18-ae98-bb6318718d3a','lacado','RAL 1037','Amarillo sol','RAL','#F39F18','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('be428d31-0725-4561-be2f-804c2848bd41','lacado','RAL 2000','Amarillo naranja','RAL','#ED760E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('38558682-0c6d-4056-8969-11ba33ac44ac','lacado','RAL 2001','Rojo anaranjado','RAL','#C93C20','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('88251d14-1735-4950-9e02-c900a0a9476f','lacado','RAL 2002','Naranja sanguíneo','RAL','#CB2821','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('7e2a02ad-963c-43ab-9f6f-86c91120711a','lacado','RAL 2003','Naranja pastel','RAL','#FF7514','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('9a496fb9-4ac4-4427-97ff-99399323a3c4','lacado','RAL 2004','Naranja puro','RAL','#F44611','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('333d9139-a773-462f-85a0-6c9f61514935','lacado','RAL 2005','Naranja brillante','RAL','#FF2301','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('56b9e49b-e929-4d47-8371-17760b92cfb2','lacado','RAL 2007','Amarillo anaranjado','RAL','#FFA420','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e120ea05-5faa-4dc6-b7bd-6e9d8dfd0be1','lacado','RAL 2008','Rojo claro anaranjado','RAL','#F75E25','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('72ff2a3e-6e86-46be-a353-bb56590ab3ba','lacado','RAL 2009','Naranja tráfico','RAL','#F54021','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('53607d2a-f14e-4369-a964-b0471e0ed360','lacado','RAL 2010','Naranja señales','RAL','#D84B20','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('c8861506-f934-48b3-aa1a-89e6dcacc557','lacado','RAL 2011','Naranja intenso','RAL','#EC7C26','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('2b5adc93-4a72-4ee7-ada8-e55dc1b9f9af','lacado','RAL 2012','Naranja salmón','RAL','#E55137','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a4a205ee-fd31-40c1-b459-d7ab865ae903','lacado','RAL 2013','Naranja perlado','RAL','#C35831','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('fd3bca9c-e056-452a-b913-c5aafeb0ace0','lacado','RAL 3000','Rojo fuego','RAL','#AF2B1E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0e0f1012-44fd-476d-84e8-7319f1bbb164','lacado','RAL 3001','Rojo señales','RAL','#A52019','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('1609da87-f377-43f1-8c34-be346d8b40f7','lacado','RAL 3002','Rojo carmín','RAL','#A2231D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('6b289c6b-1cbe-4db2-a4f6-2704581d4088','lacado','RAL 3003','Rojo rubí','RAL','#9B111E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4c823cb1-8569-48d4-b24a-cd4b1ccc46f0','lacado','RAL 3004','Rojo púrpura','RAL','#75151E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('fc366d64-d942-441c-bcb1-06415e775223','lacado','RAL 3005','Rojo vino','RAL','#5E2129','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3a62922c-0cca-4aaf-8efe-a3811b0a4916','lacado','RAL 3007','Rojo negruzco','RAL','#412227','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('bc9e824a-5376-4959-aff4-bef08e5b7ef7','lacado','RAL 3009','Rojo óxido','RAL','#642424','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('fdc232db-6121-4360-893d-6da7d3c93984','lacado','RAL 3011','Rojo pardo','RAL','#781F19','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('bdbc5189-846c-4ede-8d7a-c3b56905000d','lacado','RAL 3012','Rojo beige','RAL','#C1876B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('1b4ee7a8-9e87-473d-94f3-589f4917ce16','lacado','RAL 3013','Rojo tomate','RAL','#A12312','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('f3da61c3-6d4b-4fd6-a34b-dff2db311afc','lacado','RAL 3014','Rosa antiguo','RAL','#D36E70','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ce4ea350-9198-4dbd-8132-256317f23a8e','lacado','RAL 3015','Rosa claro','RAL','#EA899A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('6381aa6c-98f8-4b73-b9f1-19011713bc9f','lacado','RAL 3016','Rojo coral','RAL','#B32821','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4544dd02-f180-474d-ad44-51d519b5009f','lacado','RAL 3017','Rosa fresa','RAL','#E63244','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('76b2b47e-122c-46a0-a0f1-3554e30c0623','lacado','RAL 3018','Rojo fresa','RAL','#D53032','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('08850ccb-7d17-405c-9d70-f1e6e6997d49','lacado','RAL 3020','Rojo tráfico','RAL','#CC0605','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('bc1deda2-7f9e-4530-a562-1019ab194e18','lacado','RAL 3022','Rojo salmón','RAL','#D95030','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a4a9ea2e-4f9f-4f0b-b0db-2177d3dafab0','lacado','RAL 3024','Rojo brillante','RAL','#F80000','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('aeebe773-482a-4dce-a753-3eb1be833715','lacado','RAL 3026','Rojo vivo brillante','RAL','#FE0000','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('deba2ca8-ab51-4748-a302-4834d8f29fd2','lacado','RAL 3027','Rojo frambuesa','RAL','#C51D34','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('307bd192-0199-4960-a422-885f8a87e453','lacado','RAL 3028','Rojo puro','RAL','#CB3234','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('1d9f00fe-1468-403c-95bf-cc6806132d41','lacado','RAL 3031','Rojo oriente','RAL','#B32428','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('78ba66f9-6071-4bd1-8ee8-a54a76897017','lacado','RAL 3032','Rojo rubí perlado','RAL','#721422','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e315f3da-e78f-4798-bae3-ed8a220a2f48','lacado','RAL 3033','Rosa perlado','RAL','#B44C43','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('9cbd38ec-a6a0-4345-b23d-4210e0a8d0b4','lacado','RAL 4001','Lila rojizo','RAL','#6D3F5B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('026b19ff-4fab-46b1-bbfd-81ed2d1d4aff','lacado','RAL 4002','Violeta rojizo','RAL','#922B3E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('797836cf-dc1d-4432-87e8-44ec4546b6a5','lacado','RAL 4003','Violeta erica','RAL','#DE4C8A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4fceb093-df92-4083-8f4e-f74422d7a796','lacado','RAL 4004','Violeta burdeos','RAL','#641C34','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('1e1b492d-35a0-46ae-aa17-2429420908e3','lacado','RAL 4005','Violeta azulado','RAL','#6C4675','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e19e99eb-bf0c-43dd-a9ae-07b9a6fef8ff','lacado','RAL 4006','Púrpura tráfico','RAL','#A03472','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ab1b6cb2-fbe4-4bcc-aff5-bb0bc131dc7a','lacado','RAL 4007','Violeta púrpura','RAL','#4A192C','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d3a7d02f-b100-46ab-a000-845fb2a286cc','lacado','RAL 4008','Violeta señales','RAL','#924E7D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('7a5b03f6-1289-4943-bf36-26e8bdf1930c','lacado','RAL 4009','Violeta pastel','RAL','#A18594','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('c4c866fd-7ae5-4a7d-83a5-7b8c9aacb74b','lacado','RAL 4010','Magenta telemagenta','RAL','#CF3476','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b2fc14f1-7074-4d79-93e1-d7e30134687d','lacado','RAL 4011','Violeta perlado','RAL','#8673A1','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d84cfe9f-8070-4c14-ac1c-770d2922997f','lacado','RAL 4012','Violeta perla','RAL','#6C6874','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('29808c78-3a50-4152-ad86-f206a3765aea','lacado','RAL 5000','Azul violeta','RAL','#354D73','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('69c3534d-e916-4f6e-a6ef-2df04a983970','lacado','RAL 5001','Azul verdoso','RAL','#1F3438','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('15b6bbb7-1b27-4bdc-8568-9e8bcd3c8381','lacado','RAL 5002','Azul ultramar','RAL','#20214F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4af05f89-e95b-401b-a10b-172c87e045d5','lacado','RAL 5003','Azul zafiro','RAL','#1D1E33','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ab1e2e7f-7758-4476-b1d6-17ef3f0fa303','lacado','RAL 5004','Azul negruzco','RAL','#18171C','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('175a41ca-f599-41bd-b719-a404928d14c3','lacado','RAL 5005','Azul señales','RAL','#1E2460','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('47b5c563-49fe-44e0-a1c3-9c80d2b5d8c4','lacado','RAL 5007','Azul brillante','RAL','#3E5F8A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('94c63607-32e6-4d6a-8322-45968f2183d2','lacado','RAL 5008','Azul grisáceo','RAL','#26252D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b7db4ee8-071a-4a49-8286-433e182f4214','lacado','RAL 5009','Azul azur','RAL','#025669','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d6744135-775b-4197-8577-f87c9d3e0012','lacado','RAL 5010','Azul genciana','RAL','#0E294B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4fcd4a6e-e9b9-4e8e-9517-9712a252afc1','lacado','RAL 5011','Azul acero','RAL','#231A24','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('17b0977e-e3fe-4eab-b42b-9aba88023939','lacado','RAL 5012','Azul claro','RAL','#3B83BD','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('f71a8b91-448d-48b3-bc7b-c7f7c0389d15','lacado','RAL 5013','Azul cobalto','RAL','#1E213D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('85e4b44b-3059-45ca-aeb3-493a011a0d5e','lacado','RAL 5014','Azul paloma','RAL','#606E8C','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0baa0920-5183-4d44-9868-9b2710e2fd7d','lacado','RAL 5015','Azul cielo','RAL','#2271B3','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('199204c9-7464-496c-9d92-fdc617f94d5a','lacado','RAL 5017','Azul tráfico','RAL','#063971','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('233146f4-42df-4869-8a2d-205398b359d7','lacado','RAL 5018','Azul turquesa','RAL','#3F888F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('131d2b68-0752-49b6-99e4-81dd90a96533','lacado','RAL 5019','Azul capri','RAL','#1B5583','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('f39c5e26-6084-4c9b-aa66-1ab6ee387b60','lacado','RAL 5020','Azul océano','RAL','#1D334A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('abd266fe-e110-4c37-a9be-a94120dd0c64','lacado','RAL 5021','Azul agua marina','RAL','#256D7B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ec1bab03-15b0-44d3-a8c8-0b3ed33df047','lacado','RAL 5022','Azul noche','RAL','#252850','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('09aedeea-d009-4153-a5dd-4a8884408e55','lacado','RAL 5023','Azul lejano','RAL','#49678D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('504f179e-abe0-4f47-9bea-e4c320f0715c','lacado','RAL 5024','Azul pastel','RAL','#5D9B9B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b5e3ea04-ce34-49f3-9ffc-4a2ddcaa1eeb','lacado','RAL 5025','Azul genciana perlado','RAL','#2A6478','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('87f35b95-37d5-4fa3-9444-3014f76f6152','lacado','RAL 5026','Azul noche perlado','RAL','#102C54','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('70b797b0-13dd-414c-8e67-e56d51a10867','lacado','RAL 6000','Verde patina','RAL','#316650','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('957996de-0fbc-4b19-9b08-ecc4c22769db','lacado','RAL 6001','Verde esmeralda','RAL','#287233','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('6cc0ac8e-0c44-4f21-8121-74ff3a53cc75','lacado','RAL 6002','Verde hoja','RAL','#2D572C','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('67199742-2c14-4dfa-9aae-915bd1190be7','lacado','RAL 6003','Verde oliva','RAL','#424632','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('872dbf5b-4f18-48e4-9be4-f09d400985ea','lacado','RAL 6004','Verde azulado','RAL','#1F3A3D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('00f9ddc4-e447-473b-b23f-ad4796b52d75','lacado','RAL 6005','Verde musgo','RAL','#2F4538','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('f4bf2ea3-f785-424e-b642-8fe4ec96f1c7','lacado','RAL 6006','Verde oliva grisáceo','RAL','#3E3B32','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('280236c0-011d-4bbf-8f4e-62a958e06493','lacado','RAL 6007','Verde botella','RAL','#343B29','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('5e60f709-5fee-4201-b8c5-bb990bcff271','lacado','RAL 6008','Verde parduzco','RAL','#39352A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('27265588-878d-4861-a01a-82223f15e1c0','lacado','RAL 6009','Verde abeto','RAL','#31372B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4b6b795a-aa50-47d7-a4f5-63e4055b19eb','lacado','RAL 6010','Verde hierba','RAL','#35682D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d025f98e-a1f6-4cea-b1e4-0f51556712c3','lacado','RAL 6011','Verde reseda','RAL','#587246','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('5f307395-0049-4aa4-a91e-1c27a7fb8e06','lacado','RAL 6012','Verde negruzco','RAL','#343E40','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('018d824c-91db-48f7-87ef-b024a47483a9','lacado','RAL 6013','Verde caña','RAL','#6C7156','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('9d0056e7-ccbb-4c42-911c-e17807d1268c','lacado','RAL 6014','Amarillo oliva','RAL','#47402E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('18608a18-2fb3-4baa-86ed-1d663dedcf9b','lacado','RAL 6015','Oliva negruzco','RAL','#3B3C36','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b7acd901-331d-43be-899d-babaeff99a3a','lacado','RAL 6016','Verde turquesa','RAL','#1E5945','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('8bfb3a52-c66f-4859-a1bf-f1b3e81a66fa','lacado','RAL 6017','Verde mayo','RAL','#4C9141','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('496db4fb-87e2-4bdd-b186-c78dbc3d10b2','lacado','RAL 6018','Verde amarillento','RAL','#57A639','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('8773e755-7c1b-4718-901f-dcbf827ae175','lacado','RAL 6019','Verde blanquecino','RAL','#BDECB6','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('dd2949ec-372b-4287-8fe8-cdfdf45bb627','lacado','RAL 6020','Verde cromo','RAL','#2E3A23','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ed47f1ee-277a-4097-ac51-171cebe17054','lacado','RAL 6021','Verde pálido','RAL','#89AC76','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('2e4fe1fb-884e-4086-a204-7504d7f286a8','lacado','RAL 6022','Oliva parduzco','RAL','#25221B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('87009bf9-f323-47ff-bb84-7efc5efb2dcb','lacado','RAL 6024','Verde tráfico','RAL','#308446','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('459a2811-4b31-490b-8c3b-3920545cf07f','lacado','RAL 6025','Verde helecho','RAL','#3D642D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0036c947-dda1-4849-96bc-19a3542e0900','lacado','RAL 6026','Verde opalino','RAL','#015D52','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4a1385ac-820f-4539-b6ea-775292b60df1','lacado','RAL 6027','Verde claro','RAL','#84C3BE','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0be9708f-51fc-49ea-b429-76d9197d8d51','lacado','RAL 6028','Verde pino','RAL','#2C5545','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('cc54692b-aede-4de9-b9d0-fd26beb1d593','lacado','RAL 6029','Verde menta','RAL','#20603D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('12f5cd1b-235f-454e-bc4a-779d00742239','lacado','RAL 6032','Verde señales','RAL','#317F43','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('83d3cd9a-9898-4d7e-b373-d67fc9c3fb38','lacado','RAL 6033','Turquesa menta','RAL','#497E76','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a8db205f-42f6-4a83-8506-0aa4bd541092','lacado','RAL 6034','Turquesa pastel','RAL','#7FB5B5','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ac0336c3-cd78-4b3b-8542-4e4af294887c','lacado','RAL 6035','Verde perlado','RAL','#1C542D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('f1a764cf-ddbd-4a4f-83e1-ee4c66fdddb4','lacado','RAL 6036','Verde ópalo perlado','RAL','#193737','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('19bafdc4-8dd5-42ff-a0f2-207017fe305e','lacado','RAL 6037','Verde puro','RAL','#008F39','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d36826b2-9dcc-4146-9020-12df8c87fce3','lacado','RAL 6038','Verde claro brillante','RAL','#00BB2D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('2ef0a3a4-1ecc-43ca-8ac3-d19ba5611911','lacado','RAL 7000','Gris ardilla','RAL','#78858B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('8ffa4fe2-7107-4cc9-b6e3-0f751fa45f90','lacado','RAL 7001','Gris plata','RAL','#8A9597','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('7686c060-0726-481c-9807-f3fb4819eba2','lacado','RAL 7002','Gris oliva','RAL','#7E7B52','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('70e09e1b-f7a2-475e-8329-7202597347df','lacado','RAL 7003','Gris musgo','RAL','#6C7059','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('75070ea2-d4ff-4331-a3a4-9af5ef1311a4','lacado','RAL 7004','Gris señales','RAL','#969992','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0fbbfe34-c87a-45cb-a600-6fef95729050','lacado','RAL 7005','Gris ratón','RAL','#646B63','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('54c3d5a4-3eff-4389-b0fc-8002607f18be','lacado','RAL 7006','Gris beige','RAL','#6D6552','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('f7e6d06a-c442-4a1c-9a80-6a0e9cc05b6b','lacado','RAL 7008','Gris caqui','RAL','#6A5F31','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d110545d-cf40-4bc5-bd6a-85e09ffb867e','lacado','RAL 7009','Gris verdoso','RAL','#4D5645','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('7ff48aa6-6df7-4e5f-b6f4-1c323f25f366','lacado','RAL 7010','Gris lona','RAL','#4C514A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('f8ff9bba-931f-4377-bb40-b4b2645d00fa','lacado','RAL 7011','Gris hierro','RAL','#434B4D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('ee32cf3d-551b-4d0c-bf80-be8633e5d48c','lacado','RAL 7012','Gris basalto','RAL','#4E5754','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a854cb26-68c9-4c8f-a6a9-b00cf9616dfd','lacado','RAL 7013','Gris parduzco','RAL','#464531','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('3afe405d-7bd7-4dd6-b85c-61113918eb5d','lacado','RAL 7015','Gris pizarra','RAL','#434750','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b2f5f3f9-a559-4338-bbe9-134d1bd7b5c9','lacado','RAL 7016','Gris antracita','RAL','#293133','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('7798fe66-fabc-4948-9bfc-c58e86057170','lacado','RAL 7021','Gris negruzco','RAL','#23282B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e0de2420-0627-47a1-97a6-cb30589372b9','lacado','RAL 7022','Gris umbra','RAL','#332F2C','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('6dafd89e-6ed9-4ee8-8dc6-db1a278202a5','lacado','RAL 7023','Gris hormigón','RAL','#686C5E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e69bfbaa-4e2e-4cc8-9cd6-a657318a4042','lacado','RAL 7024','Gris grafito','RAL','#474A51','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e5666dbd-49bc-4bf8-b28c-f50ca70f1374','lacado','RAL 7026','Gris granito','RAL','#2F353B','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('93430fe3-be33-4f7f-9e18-2c2abbf9aa7a','lacado','RAL 7030','Gris piedra','RAL','#8B8C7A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('64caf40c-1df1-4fa8-8dd6-b2a7c0da6904','lacado','RAL 7031','Gris azulado','RAL','#474B4E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('24d00510-96cc-48d6-a0b9-7ce135045264','lacado','RAL 7032','Gris guijarro','RAL','#B8B799','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('aff177a7-1d9e-4c47-b104-b9e67105da26','lacado','RAL 7033','Gris cemento','RAL','#7D8471','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e62a484d-afae-4d2b-85b0-a1f1b0232821','lacado','RAL 7034','Gris amarillento','RAL','#8F8B66','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('262ca076-4206-4a84-b862-17f42b559c80','lacado','RAL 7035','Gris luminoso','RAL','#D7D7D7','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('599d0e47-95c7-4848-a360-04b2f95b47f5','lacado','RAL 7036','Gris platino','RAL','#7F7679','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e83f3eb1-fc2d-42f6-9d6a-6f2cf40fa840','lacado','RAL 7037','Gris polvo','RAL','#7D7F7D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b64544b5-9236-45a1-be65-f980a175b3a0','lacado','RAL 7038','Gris ágata','RAL','#B5B8B1','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0fee4b4a-5609-4851-bdc8-57b444cc86aa','lacado','RAL 7039','Gris cuarzo','RAL','#6C6960','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b4f482c4-329c-4398-a842-a83f311aee00','lacado','RAL 7040','Gris ventana','RAL','#9DA1AA','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('119394a1-c45a-4a7b-9022-59d6e76e259c','lacado','RAL 7042','Gris tráfico A','RAL','#8D948D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b743f769-5001-449f-bbda-ec7bbc1a67e1','lacado','RAL 7043','Gris tráfico B','RAL','#4E5452','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('fdb97e2b-8f35-4776-8e61-920b4905fea1','lacado','RAL 7044','Gris seda','RAL','#CAC4B0','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('71feaf9b-5e6e-47b0-bcb6-70e584c60893','lacado','RAL 7045','Gris tele 1','RAL','#909090','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('94348e95-8bfa-4d1b-b2f7-814c1a053657','lacado','RAL 7046','Gris tele 2','RAL','#82898F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('06b7577d-8519-4b86-891b-222fffda72cf','lacado','RAL 7047','Gris tele 4','RAL','#D0D0D0','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e9737836-f807-4de7-b95a-46b4ff457196','lacado','RAL 7048','Gris musgo perlado','RAL','#898176','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('38325f82-5dd0-4987-8090-efb891aec710','lacado','RAL 8000','Marrón amarillento','RAL','#826C34','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e6bf2c6d-69f7-435e-821f-9b37287dae63','lacado','RAL 8001','Marrón ocre','RAL','#955F20','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('65791a65-39a6-4988-823a-0567e8af3238','lacado','RAL 8002','Marrón señales','RAL','#6C3B2A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('9292b0ad-9b8d-4422-a6e6-752da636612e','lacado','RAL 8003','Marrón arcilla','RAL','#734222','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('51667b0f-5c07-4ab4-84c5-955685ebe201','lacado','RAL 8004','Marrón cobre','RAL','#8E402A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('6d9f01e9-6ef5-479b-a78c-1ae55c8b4dea','lacado','RAL 8007','Marrón corzo','RAL','#59351F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('2be21c01-8219-4a60-8fc5-81f598ad8b41','lacado','RAL 8008','Marrón oliva','RAL','#6F4F28','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('b6402e66-520a-43e2-8097-8e0400cf0828','lacado','RAL 8011','Marrón nuez','RAL','#5B3A29','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('782675d1-2958-4371-a759-b586c23a4104','lacado','RAL 8012','Marrón rojizo','RAL','#592321','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('601ea2aa-67a8-4de7-b7f0-b4b717babce3','lacado','RAL 8014','Marrón sepia','RAL','#382C1E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('0fa99fba-9018-4742-8db0-f06afa8cc6de','lacado','RAL 8015','Marrón castaño','RAL','#633A34','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('6ea56715-6f04-40d3-9b52-92a1f77e60a5','lacado','RAL 8016','Marrón caoba','RAL','#4C2F27','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d294136e-2111-4939-b9a5-e3a0d10a4e2b','lacado','RAL 8017','Marrón chocolate','RAL','#45322E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4cf1b0f7-ce94-462b-96d7-91ac00818f88','lacado','RAL 8019','Marrón grisáceo','RAL','#403A3A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('218ef943-af1a-43c0-9c33-6d1bd009384e','lacado','RAL 8022','Marrón negruzco','RAL','#212121','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4f83c482-3d74-49e2-b9f1-a6a4c5c85903','lacado','RAL 8023','Marrón anaranjado','RAL','#A65E2E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('6352fb1f-77ad-4419-b570-1889d8a06559','lacado','RAL 8024','Marrón beige','RAL','#79553D','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('cdb93faf-0943-4218-873a-1191b7a85f28','lacado','RAL 8025','Marrón pálido','RAL','#755C48','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('f87e3560-b42c-45d4-872a-13b174ce5640','lacado','RAL 8028','Marrón tierra','RAL','#4E3B31','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('cb0e3393-1092-4a0a-945d-6e177b41b356','lacado','RAL 8029','Cobre perlado','RAL','#763C28','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('1fe1220a-2613-4a26-80a7-7b93144a23a3','lacado','RAL 9001','Blanco crema','RAL','#FDF4E3','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('e7a63566-1748-4a57-ab74-7254521dc0f4','lacado','RAL 9002','Blanco grisáceo','RAL','#E7EBDA','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('845d7889-9608-405e-80f1-39fcf8781113','lacado','RAL 9003','Blanco señales','RAL','#F4F4F4','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'-0.24','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-23 04:48:20.83+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('4e0a0ad0-b311-4976-8c96-01dc59f53316','lacado','RAL 9004','Negro señales','RAL','#282828','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('37b14203-babb-410e-82b2-b2b5283c0955','lacado','RAL 9005','Negro intenso','RAL','#0A0A0A','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('fd67eb10-ac8c-4398-ba67-0a84b8e9acfa','lacado','RAL 9006','Aluminio blanco','RAL','#A5A5A5','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('33b5b0d3-3b9d-48a0-8781-d3af16130ab6','lacado','RAL 9007','Aluminio gris','RAL','#8F8F8F','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('77ade46f-4cf4-4c77-bda6-d8dc57b64a3b','lacado','RAL 9010','Blanco puro','RAL','#FFFFFF','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('cbc097a4-0971-4259-8492-dc5f64f62629','lacado','RAL 9011','Negro grafito','RAL','#1C1C1C','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('a614af1c-f54a-4126-8608-48b39539e6c3','lacado','RAL 9016','Blanco tráfico','RAL','#F6F6F6','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('9e11bf76-42ec-4a8c-8446-2acab8378400','lacado','RAL 9017','Negro tráfico','RAL','#1E1E1E','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('d63bd405-332c-4a58-bc66-0ce460d08019','lacado','RAL 9018','Blanco papiro','RAL','#D7D7D7','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('5d500e65-f1dc-406a-adc1-3627a9d8d413','lacado','RAL 9022','Gris claro perlado','RAL','#9C9C9C','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;
INSERT INTO public.materiales (id, tipo, codigo, nombre, familia, hex_aproximado, proveedor_id, precio_kg_sobrescrito, formato_compra_kg, rendimiento_kg_m2_sobrescrito, stock_fisico_kg, stock_reservado_kg, stock_minimo_kg, observaciones, activo, created_at, updated_at) VALUES ('358c8098-1dd6-4b93-a7ca-1a44f10b9557','lacado','RAL 9023','Gris oscuro perlado','RAL','#828282','29e6d6be-c065-47af-a163-3a2528e80e8a','10.00',NULL,NULL,'0','0','0',NULL,'t','2026-04-18 06:44:42.019988+00','2026-04-22 20:08:17.015822+00') ON CONFLICT DO NOTHING;


-- ---------- 7d) configuracion_empresa + secuencias (FK → materiales) ----------
-- ===== configuracion_empresa (FK → materiales para default IDs) =====
-- DEBE ir DESPUÉS de materiales por la FK material_catalizador_default_id.
INSERT INTO public.configuracion_empresa (id, razon_social, nombre_comercial, cif_nif, direccion, codigo_postal, ciudad, provincia, pais, telefono, email, web, iban, logo_url, texto_pie_presupuesto, condiciones_pago_default, iva_default, created_at, updated_at, rendimiento_lacado_kg_m2, rendimiento_fondo_kg_m2, ratio_cata_lacado, ratio_dis_lacado, ratio_cata_fondo, ratio_dis_fondo, coste_minuto_operario, jornada_horas, margen_objetivo_porcentaje, ancho_minimo_pistola_cm, material_catalizador_default_id, material_disolvente_default_id, umbral_alerta_merma_pct) VALUES ('1','TURIAVAL S.L. (por configurar)','Turiaval','B971234567','Avd Perez Galdos 13 pta 12','46007','Valencia','Valencia','España','+34669476687','pablo@myturmalina.com','www.turiaval.es','ES00 86 2100 461412541254','https://oakkoouczwmipomacewh.supabase.co/storage/v1/object/public/empresa-assets/logo-1776700296425.jpg','Este presupuesto no es contractual. ','Pago a 30 días fecha factura','21','2026-04-20 15:18:49.259389+00','2026-04-21 21:43:58.696992+00','0.12','0.15','8','4','12','6','0.40','8','30','15','ae5f80da-a563-451d-9d9b-25965d201305','819a29cc-6baa-4072-b274-399cdc5fa723','15.00') ON CONFLICT (id) DO NOTHING;

-- ===== secuencias (estado actual de numeración) =====
-- En migración fresca puedes omitir estas líneas (arrancará desde 1).
INSERT INTO public.secuencias (id, anio, ultimo_numero) VALUES ('pedido','2026','4') ON CONFLICT (id, anio) DO NOTHING;
INSERT INTO public.secuencias (id, anio, ultimo_numero) VALUES ('presupuesto','2026','2') ON CONFLICT (id, anio) DO NOTHING;

-- =====================================================================
-- 8) VERIFICACIÓN FINAL (ejecutar manualmente tras la migración)
-- =====================================================================
-- Descomenta para comprobar:
--
-- SELECT 'tablas' AS tipo, count(*) FROM information_schema.tables WHERE table_schema='public';
-- SELECT 'colores_legacy' AS tipo, count(*) FROM colores_legacy;      -- esperado 272
-- SELECT 'materiales' AS tipo, count(*) FROM materiales;              -- esperado 275
-- SELECT 'procesos_catalogo' AS tipo, count(*) FROM procesos_catalogo; -- esperado 13
-- SELECT 'tratamientos' AS tipo, count(*) FROM tratamientos;          -- esperado 12
-- SELECT 'categorias_pieza' AS tipo, count(*) FROM categorias_pieza;  -- esperado 6
-- SELECT 'config_tiempos_proceso' AS tipo, count(*) FROM config_tiempos_proceso; -- esperado 9
-- SELECT 'configuracion_empresa' AS tipo, count(*) FROM configuracion_empresa;   -- esperado 1
-- SELECT generar_numero_secuencial('PIE');   -- debe devolver PIE-26-NNNN
-- SELECT generar_numero_secuencial('pres');  -- debe devolver PRES-26-NNNN