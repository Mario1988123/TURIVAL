// Servicios
export * from './presupuestos'
export * from './piezas'
export * from './ocr'
export * from './documentos'
export * from './clientes'

// catalogo.ts solapa con productos.ts en (crearProducto, listarProductos,
// actualizarProducto). Reexportamos solo las funciones propias del catálogo
// para evitar ambigüedad. Las funciones de Producto/Catálogo canónicas viven
// en productos.ts.
export {
  obtenerProducto,
  crearColor,
  listarColores,
  obtenerColor,
  buscarColorPorCodigo,
  actualizarColor,
  crearTratamiento,
  listarTratamientos,
  obtenerTratamiento,
  actualizarTratamiento,
  crearAcabado,
  listarAcabados,
  obtenerAcabado,
  actualizarAcabado,
  crearTarifa,
  listarTarifas,
  obtenerTarifa,
  actualizarTarifa,
  obtenerCatalogoPrecio,
} from './catalogo'

export * from './procesos'
export * from './configuracion'

// productos.ts solapa con:
//   · catalogo.ts: crearProducto, listarProductos, actualizarProducto, obtenerProducto
//   · procesos.ts: listarProcesosCatalogo
// Re-exportamos solo lo NO ambiguo. Consumidores que necesiten las versiones
// canónicas hacen import directo al archivo (ej. '@/lib/services/productos').
export {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  listarProcesosDeProducto,
  guardarProcesosDeProducto,
  estimarTiempoProceso,
  registrarTiempoRealEnHistorial,
  type ProductoForm,
  type ProcesoCatalogoExt,
  type ProcesoProductoDetalle,
  type ProcesoProductoForm,
} from './productos'

export * from './categorias-producto'

// Tipos
export * from '../types/erp'

// Supabase
export { createClient } from '../supabase/client'
export { useSupabase } from '../supabase/hooks'
