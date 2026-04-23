/**
 * lib/motor/etiquetas.ts
 * ================================================================
 * Funciones puras (sin BD, sin IO) para generar el contenido de
 * cada etiqueta imprimible de pieza.
 *
 * Una etiqueta tiene 4 partes:
 *   1) Nombre comercial del cliente       (grande, legible, auto-fit)
 *   2) Código compacto de procesos+medidas (ej: LFLA-800x600x19)
 *   3) QR o Code128 con el número PIE-YYYY-NNNN
 *   4) Número PIE-YYYY-NNNN en texto pequeño abajo
 *
 * Ver T2-etiquetas en la memoria del proyecto.
 * ================================================================
 */

/** Mapa código_proceso → inicial para el código compacto de etiqueta. */
const INICIALES_PROCESO: Record<string, string> = {
  LIJADO: 'L',
  FONDO: 'F',
  LIJADO_2: 'L2',
  FONDEADO_2: 'F2',
  LACADO: 'LA',
  // Procesos no visibles en el código compacto (no aportan info útil
  // al operario en una etiqueta física):
  //   COMPROB_MATERIAL, TERMINACION, RECEPCION, PICKING → se omiten.
}

/**
 * Input mínimo necesario para construir una etiqueta. Reutiliza
 * los campos que ya trae `obtenerPedido()` sin tocar nada.
 */
export interface DatosEtiqueta {
  // Identificación
  pieza_numero: string // ej "PIE-2026-0001"
  pedido_numero?: string | null // ej "DOC-2026-0001"
  // Cliente (texto grande arriba)
  cliente_nombre_comercial: string
  // Descripción breve (2ª línea de texto)
  descripcion?: string | null
  // Procesos elegidos (códigos). Acepta los del flujo v2 y puede
  // venir también reconstruido desde las tareas del flujo clásico.
  procesos_codigos?: string[] | null
  // Tratamiento (si tiene → añade 'X' al código compacto)
  tratamiento_nombre?: string | null
  // Dimensiones
  modo_precio?: 'm2' | 'pieza' | 'ml' | 'manual' | null
  ancho?: number | null
  alto?: number | null
  grosor?: number | null
  longitud_ml?: number | null
}

/**
 * Construye el código compacto estilo "LFLA-800x600x19".
 *
 * Reglas (definidas con Mario 23-abr-2026):
 *  - Solo procesos: L, F, L2, F2, LA. El resto se omite.
 *  - Si hay tratamiento → se añade 'X' al final del bloque de procesos.
 *  - Separador: guión.
 *  - Medidas:
 *      modo_precio === 'ml' → "<longitud>ml"
 *      otro modo con ancho y alto → "AxBxC" (C = grosor, omitido si 0/null)
 *      sin info → "SIN-MEDIDAS"
 *  - Si no hay ningún proceso conocido → "SIN-PROCESOS".
 */
export function construirCodigoCompacto(d: DatosEtiqueta): string {
  // 1) Bloque de procesos
  const bloqueProcesos: string[] = []
  if (d.procesos_codigos && d.procesos_codigos.length > 0) {
    for (const codigo of d.procesos_codigos) {
      const inicial = INICIALES_PROCESO[codigo]
      if (inicial) bloqueProcesos.push(inicial)
    }
  }
  if (d.tratamiento_nombre && d.tratamiento_nombre.trim().length > 0) {
    bloqueProcesos.push('X')
  }
  const parteProcesos =
    bloqueProcesos.length > 0 ? bloqueProcesos.join('') : 'SIN-PROCESOS'

  // 2) Bloque de medidas
  let parteMedidas = 'SIN-MEDIDAS'
  if (d.modo_precio === 'ml' && d.longitud_ml && d.longitud_ml > 0) {
    parteMedidas = `${formatearNumero(d.longitud_ml)}ml`
  } else if (d.ancho && d.alto && d.ancho > 0 && d.alto > 0) {
    const partes = [formatearNumero(d.ancho), formatearNumero(d.alto)]
    if (d.grosor && d.grosor > 0) partes.push(formatearNumero(d.grosor))
    parteMedidas = partes.join('x')
  }

  return `${parteProcesos}-${parteMedidas}`
}

/**
 * Formatea un número quitando decimales innecesarios. 800 → "800",
 * 19.5 → "19.5", 19.00 → "19".
 */
function formatearNumero(n: number): string {
  const redondeado = Math.round(n * 100) / 100
  if (Number.isInteger(redondeado)) return String(redondeado)
  return String(redondeado)
}

/**
 * URL pública de trazabilidad de una pieza. Usada en el contenido
 * del QR para que un móvil pueda escanearlo y caer en /t/[qr_codigo].
 *
 * `baseUrl` debe venir de window.location.origin (en cliente) para
 * que funcione igual en preview y en producción.
 */
export function urlPublicaPieza(piezaNumero: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/t/${encodeURIComponent(piezaNumero)}`
}
