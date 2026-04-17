// Tipos completos para el ERP/CRM de lacados

export interface Profile {
  id: string
  nombre: string
  email: string
  rol: 'admin' | 'usuario' | 'operario'
  activo: boolean
  fecha_alta: string
  ultima_actividad: string | null
}

export interface Cliente {
  id: string
  tipo: 'precliente' | 'cliente_activo' | 'cliente_recurrente'
  nombre_comercial: string
  razon_social: string | null
  cif_nif: string | null
  persona_contacto: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  codigo_postal: string | null
  ciudad: string | null
  provincia: string | null
  notas: string | null
  origen: string | null
  observaciones_internas: string | null
  frecuencia_trabajo: string | null
  condiciones_pago: string
  descuento_general: number
  created_at: string
  updated_at: string
  user_id: string
}

export interface Producto {
  id: string
  nombre: string
  categoria: string | null
  descripcion: string | null
  unidad_tarificacion: 'm2' | 'pieza'
  activo: boolean
  created_at: string
}

export interface Color {
  id: string
  codigo: string
  nombre: string
  tipo: 'RAL' | 'NCS' | 'referencia_interna' | 'muestra_cliente'
  hex_aproximado: string | null
  observaciones: string | null
  sobrecoste: number
  activo: boolean
  created_at: string
}

export interface Tratamiento {
  id: string
  nombre: string
  descripcion: string | null
  multiplicador_coste: number
  tiempo_estimado_base: number | null
  activo: boolean
  created_at: string
}

export interface Acabado {
  id: string
  codigo: string
  color_id: string | null
  tratamiento_id: string | null
  acabado: string | null
  brillo: number | null
  textura: string | null
  notas_tecnicas: string | null
  ficha_tecnica: Record<string, any> | null
  activo: boolean
  created_at: string
}

export interface Tarifa {
  id: string
  nombre: string
  producto_id: string | null
  modo_precio: 'm2' | 'pieza' | 'ambos'
  precio_m2: number | null
  precio_pieza: number | null
  precio_minimo: number
  coste_adicional_color: number
  coste_adicional_tratamiento: number
  coste_adicional_embalaje: number
  tiempo_estimado_m2: number | null
  tiempo_estimado_pieza: number | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface ReferenciaCliente {
  id: string
  cliente_id: string
  referencia_cliente: string
  referencia_interna: string | null
  descripcion: string | null
  producto_id: string | null
  dimensiones_habituales: Record<string, any> | null
  color_id: string | null
  tratamiento_id: string | null
  tarifa_id: string | null
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface Presupuesto {
  id: string
  numero: string
  fecha: string
  cliente_id: string
  estado: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'caducado'
  validez_dias: number
  observaciones_comerciales: string | null
  observaciones_internas: string | null
  subtotal: number
  descuento_porcentaje: number
  descuento_importe: number
  base_imponible: number
  iva_porcentaje: number
  iva_importe: number
  total: number
  margen_estimado: number | null
  tiempo_estimado_total: number | null
  created_at: string
  updated_at: string
  user_id: string
}

export interface LineaPresupuesto {
  id: string
  presupuesto_id: string
  producto_id: string | null
  tarifa_id: string | null
  descripcion: string | null
  cantidad: number
  modo_precio: 'm2' | 'pieza'
  ancho: number | null
  alto: number | null
  grosor: number | null
  unidad: string
  cara_frontal: boolean
  cara_trasera: boolean
  canto_superior: boolean
  canto_inferior: boolean
  canto_izquierdo: boolean
  canto_derecho: boolean
  superficie_m2: number | null
  precio_unitario: number | null
  precio_m2: number | null
  precio_pieza: number | null
  precio_minimo: number
  color_id: string | null
  tratamiento_id: string | null
  acabado_id: string | null
  acabado_texto: string | null
  extras: Record<string, any> | null
  suplemento_manual: number
  suplemento_descripcion: string | null
  total_linea: number
  tiempo_estimado: number | null
  notas: string | null
  orden: number
  created_at: string
}

export interface Pedido {
  id: string
  numero: string
  cliente_id: string
  presupuesto_id: string | null
  origen: 'presupuesto' | 'ocr' | 'manual'
  estado: 'pendiente' | 'en_produccion' | 'pausado' | 'terminado' | 'entregado' | 'cancelado'
  fecha_entrada: string
  fecha_prevista_entrega: string | null
  fecha_entrega_real: string | null
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente'
  observaciones_internas: string | null
  observaciones_cliente: string | null
  total_estimado: number | null
  total_final: number | null
  forma_pago: string | null
  estado_pago: 'pendiente' | 'parcial' | 'pagado'
  porcentaje_avance: number
  created_at: string
  updated_at: string
  user_id: string
}

export interface Lote {
  id: string
  codigo: string
  pedido_id: string
  descripcion: string | null
  color_id: string | null
  tratamiento_id: string | null
  estado: 'pendiente' | 'en_proceso' | 'terminado' | 'incidencia'
  total_piezas: number
  piezas_terminadas: number
  created_at: string
  updated_at: string
}

export interface Pieza {
  id: string
  codigo: string
  qr_data: string
  pedido_id: string
  lote_id: string | null
  cliente_id: string
  referencia_cliente: string | null
  producto_id: string | null
  acabado_id: string | null
  cantidad: number
  ancho: number | null
  alto: number | null
  grosor: number | null
  superficie_m2: number | null
  modo_precio: 'm2' | 'pieza' | null
  color_id: string | null
  tratamiento_id: string | null
  acabado_texto: string | null
  estado: 'pendiente' | 'en_proceso' | 'terminado' | 'incidencia' | 'cancelado'
  fase_actual: string | null
  observaciones: string | null
  tiempo_estimado: number | null
  tiempo_real: number | null
  created_at: string
  updated_at: string
}

export interface FaseProduccion {
  id: string
  pieza_id: string
  fase: 'recepcion' | 'lijado' | 'fondo' | 'lacado' | 'secado' | 'manipulado' | 'terminacion' | 'empaquetado' | 'listo_entrega'
  estado: 'pendiente' | 'en_proceso' | 'completado' | 'incidencia'
  orden: number
  inicio: string | null
  fin: string | null
  duracion_minutos: number | null
  operario_id: string | null
  observaciones: string | null
  incidencias: string | null
  validacion_ok: boolean | null
  created_at: string
}

export interface CapacidadDiaria {
  id: string
  fecha: string
  capacidad_disponible_minutos: number
  capacidad_asignada_minutos: number
  created_at: string
}

export interface Planificacion {
  id: string
  fecha_inicio: string
  fecha_fin: string | null
  pieza_id: string
  fase_id: string | null
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente'
  duracion_minutos: number | null
  operario_asignado: string | null
  estado: 'pendiente' | 'asignado' | 'en_proceso' | 'completado'
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface Albaran {
  id: string
  numero: string
  pedido_id: string
  cliente_id: string
  estado: 'borrador' | 'impreso' | 'entregado'
  fecha_entrega: string
  observaciones: string | null
  firma_cliente: string | null
  created_at: string
  updated_at: string
}

export interface LineaAlbaran {
  id: string
  albaran_id: string
  pieza_id: string | null
  lote_id: string | null
  descripcion: string | null
  cantidad: number
  observaciones: string | null
}

export interface Pago {
  id: string
  pedido_id: string
  importe: number
  fecha_pago: string
  metodo_pago: string
  referencia_transaccion: string | null
  observaciones: string | null
  created_at: string
}

export interface HistorialPagos {
  id: string
  pedido_id: string
  importe_anterior: number
  importe_nuevo: number
  motivo: string
  created_at: string
}

export interface OCRDocumento {
  id: string
  cliente_id: string | null
  archivo_url: string
  texto_extraido: string | null
  estado: 'pendiente' | 'procesado' | 'validado' | 'rechazado'
  datos_extraidos: Record<string, any> | null
  referencia_pedido: string | null
  observaciones: string | null
  created_at: string
  updated_at: string
}

export interface Secuencia {
  id: string
  anio: number
  ultimo_numero: number
}


// ============================================================
// TIPOS NUEVOS (migración 004) — Procesos, Carros, Empleados, etc.
// ============================================================

export interface NivelComplejidad {
  id: number
  codigo: 'SIMPLE' | 'MEDIA' | 'COMPLEJA'
  nombre: string
  multiplicador: number
  descripcion: string | null
  orden: number
  activo: boolean
  created_at: string
}

export interface ProcesoCatalogo {
  id: string
  codigo: string // RECEPCION, LIJADO, FONDO, LACADO, SECADO, MANIPULADO, TERMINACION, EMPAQUETADO, LISTO_ENTREGA
  nombre: string
  orden_tipico: number
  color_gantt: string
  permite_repetir: boolean
  es_tiempo_espera: boolean
  requiere_operario: boolean
  descripcion: string | null
  activo: boolean
  created_at: string
}

export interface Carro {
  id: string
  codigo: string
  nombre: string
  capacidad_piezas: number | null
  capacidad_m2: number | null
  ubicacion_actual: string | null
  qr_code: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Empleado {
  id: string
  profile_id: string | null
  nombre: string
  apellidos: string | null
  dni: string | null
  puesto: string | null
  proceso_principal_id: string | null
  horas_dia: number
  turno_horario: string | null
  fecha_alta: string
  fecha_baja: string | null
  activo: boolean
  notas: string | null
  created_at: string
  updated_at: string
}

export interface ProcesoProducto {
  id: string
  producto_id: string
  proceso_id: string
  secuencia: number
  tiempo_base_minutos: number
  tiempo_por_m2_minutos: number
  factor_simple: number
  factor_media: number
  factor_compleja: number
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

// Cuando se pide el flujo de un producto con info del proceso maestro incluida
export interface ProcesoProductoConDetalle extends ProcesoProducto {
  proceso: ProcesoCatalogo
}

export interface LineaPedido {
  id: string
  pedido_id: string
  producto_id: string | null
  color_id: string | null
  tratamiento_id: string | null
  acabado_id: string | null
  referencia_cliente: string | null
  descripcion: string | null
  cantidad: number
  ancho_mm: number | null
  alto_mm: number | null
  grosor_mm: number | null
  superficie_m2: number | null
  nivel_complejidad: number
  precio_unitario: number | null
  precio_total_linea: number | null
  observaciones: string | null
  orden: number
  created_at: string
  updated_at: string
}

export interface TareaProduccion {
  id: string
  pieza_id: string
  proceso_id: string
  secuencia: number
  estado: 'pendiente' | 'en_progreso' | 'pausada' | 'completada' | 'cancelada'
  tiempo_estimado_minutos: number | null
  tiempo_real_minutos: number | null
  fecha_inicio_planificada: string | null
  fecha_fin_planificada: string | null
  fecha_inicio_real: string | null
  fecha_fin_real: string | null
  carro_id: string | null
  empleado_id: string | null
  nivel_complejidad_aplicado: number | null
  superficie_m2_aplicada: number | null
  notas_operario: string | null
  created_at: string
  updated_at: string
}
