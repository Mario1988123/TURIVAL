/**
 * Parser de comandos de voz para el asistente TURIVAL — 100% gratis.
 *
 * NO usa LLM. Asocia palabras de la transcripcion a tablas/acciones de
 * la BD via diccionario y regex. Mario habla con frases como:
 *
 *   "presupuesto para TURMALINA, tablon 200 por 50, RAL 9003, doble fondeado"
 *   "anade linea zocalo 30 metros lineales lacado RAL 9010"
 *   "fecha de entrega para el 5 de mayo"
 *   "muestrame pedidos urgentes"
 *   "reorganiza dando prioridad a PED-26-0042"
 *
 * El parser devuelve una IntencionDetectada que el endpoint server
 * convierte en llamada(s) a los services existentes.
 */

export type TipoIntencion =
  | 'crear_presupuesto'
  | 'anadir_linea'
  | 'fijar_fecha'
  | 'listar_urgentes'
  | 'simular_fecha'
  | 'proponer_reorganizacion'
  | 'cancelar'
  | 'desconocido'

export interface LineaDictada {
  descripcion: string
  categoria?: string
  ancho_mm?: number
  alto_mm?: number
  longitud_ml?: number
  grosor_mm?: number
  color_ral?: string
  procesos: string[]
  cantidad: number
  modo_precio?: 'm2' | 'pieza' | 'ml'
}

export interface IntencionDetectada {
  tipo: TipoIntencion
  texto_original: string
  cliente_nombre?: string
  cliente_varios?: boolean
  lineas?: LineaDictada[]
  fecha_iso?: string
  pedido_referencia?: string
  warnings: string[]
}

// =============================================================
// DICCIONARIO de palabras → procesos catalogo
// =============================================================

const SINONIMOS_PROCESO: Record<string, string> = {
  // LIJADO
  'lijado': 'LIJADO',
  'lija': 'LIJADO',
  'lijar': 'LIJADO',
  // FONDO
  'fondo': 'FONDO',
  'fondear': 'FONDO',
  'fondeado': 'FONDO',
  'fondeo': 'FONDO',
  // LIJADO_2 / FONDEADO_2 (doble)
  'doble lijado': 'LIJADO_2',
  'segundo lijado': 'LIJADO_2',
  'doble fondeado': 'FONDEADO_2',
  'doble fondo': 'FONDEADO_2',
  'segundo fondo': 'FONDEADO_2',
  'segundo fondeado': 'FONDEADO_2',
  // LACADO
  'lacado': 'LACADO',
  'lacar': 'LACADO',
  'pintado': 'LACADO',
  'pintura': 'LACADO',
  // TERMINACION
  'terminacion': 'TERMINACION',
  'terminación': 'TERMINACION',
  'acabado': 'TERMINACION',
  // RECEPCION
  'recepcion': 'RECEPCION',
  'recepción': 'RECEPCION',
  // PICKING
  'picking': 'PICKING',
  'preparacion': 'PICKING',
  'preparación': 'PICKING',
  // COMPROBACION MATERIAL
  'comprobacion': 'COMPROB_MATERIAL',
  'comprobación': 'COMPROB_MATERIAL',
  'comprobar material': 'COMPROB_MATERIAL',
}

// =============================================================
// DICCIONARIO de tipos de pieza
// =============================================================

const SINONIMOS_CATEGORIA: Record<string, string> = {
  'tablon': 'tablon',
  'tablón': 'tablon',
  'tabla': 'tablon',
  'zocalo': 'zocalo',
  'zócalo': 'zocalo',
  'puerta': 'puerta',
  'panel': 'panel',
  'cajon': 'cajon',
  'cajón': 'cajon',
  'frente': 'frente',
  'molduras': 'moldura',
  'moldura': 'moldura',
}

// =============================================================
// HELPERS
// =============================================================

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // quita tildes
    .replace(/\s+/g, ' ')
    .trim()
}

function extraerNumero(palabra: string): number | null {
  const limpio = palabra.replace(/[^\d.,]/g, '').replace(',', '.')
  if (!limpio) return null
  const n = parseFloat(limpio)
  return isFinite(n) ? n : null
}

const NUMEROS_LITERALES: Record<string, number> = {
  'cero': 0, 'una': 1, 'uno': 1, 'un': 1, 'dos': 2, 'tres': 3,
  'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8,
  'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12, 'trece': 13,
  'catorce': 14, 'quince': 15, 'veinte': 20, 'treinta': 30,
  'cuarenta': 40, 'cincuenta': 50, 'cien': 100, 'ciento': 100,
  'mil': 1000,
}

function literalANumero(palabra: string): number | null {
  return NUMEROS_LITERALES[palabra] ?? null
}

// =============================================================
// EXTRACTORES
// =============================================================

function extraerProcesos(texto: string): string[] {
  const t = ` ${texto} `
  const detectados = new Set<string>()
  // Iteramos sinonimos ordenados por longitud descendente
  const claves = Object.keys(SINONIMOS_PROCESO).sort((a, b) => b.length - a.length)
  for (const k of claves) {
    if (t.includes(` ${k} `) || t.includes(` ${k},`) || t.includes(` ${k}.`)) {
      detectados.add(SINONIMOS_PROCESO[k])
    }
  }
  return Array.from(detectados)
}

function extraerCategoria(texto: string): string | undefined {
  for (const [k, v] of Object.entries(SINONIMOS_CATEGORIA)) {
    if (texto.includes(k)) return v
  }
  return undefined
}

function extraerRAL(texto: string): string | undefined {
  // Acepta "ral 9003", "RAL9003", "ral nueve mil tres" (raro pero)
  const m = texto.match(/ral\s*(\d{4})/i)
  if (m) return `RAL ${m[1]}`
  return undefined
}

function extraerDimensiones(texto: string): {
  ancho_mm?: number
  alto_mm?: number
  grosor_mm?: number
  longitud_ml?: number
  modo_precio?: 'm2' | 'pieza' | 'ml'
} {
  const out: ReturnType<typeof extraerDimensiones> = {}

  // "200 por 50" o "200x50" o "200 x 50 x 19"
  const dimRe = /(\d{1,4}(?:[.,]\d+)?)\s*(?:x|por)\s*(\d{1,4}(?:[.,]\d+)?)(?:\s*(?:x|por)\s*(\d{1,4}(?:[.,]\d+)?))?/i
  const m = texto.match(dimRe)
  if (m) {
    const a = extraerNumero(m[1])
    const b = extraerNumero(m[2])
    const c = m[3] ? extraerNumero(m[3]) : null
    if (a) out.ancho_mm = a
    if (b) out.alto_mm = b
    if (c) out.grosor_mm = c
    out.modo_precio = 'm2'
  }

  // "30 metros lineales" / "30 ml"
  const mlRe = /(\d+(?:[.,]\d+)?)\s*(?:metros?\s*lineales?|ml\b)/i
  const ml = texto.match(mlRe)
  if (ml) {
    const n = extraerNumero(ml[1])
    if (n) {
      out.longitud_ml = n
      out.modo_precio = 'ml'
    }
  }

  // "por pieza" / "5 piezas"
  if (/por\s+pieza/i.test(texto) || /\bpieza(s)?\b/i.test(texto)) {
    if (!out.modo_precio) out.modo_precio = 'pieza'
  }

  return out
}

function extraerCantidad(texto: string): number {
  // "5 unidades", "tres tablones", etc. — solo el primero antes de la palabra clave.
  const numRe = /(\d+|una?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(unidades?|piezas?|tablones?|zocalos?|paneles?|puertas?)/i
  const m = texto.match(numRe)
  if (!m) return 1
  const num = extraerNumero(m[1]) ?? literalANumero(m[1].toLowerCase()) ?? 1
  return Math.max(1, Math.round(num))
}

// =============================================================
// DETECTAR INTENCION
// =============================================================

export function parsearComandoVoz(textoBruto: string): IntencionDetectada {
  const original = textoBruto
  const texto = normalizar(textoBruto)
  const warnings: string[] = []

  // CANCELAR
  if (/^(cancela|cancelar|olvida|borra eso|no importa)/.test(texto)) {
    return { tipo: 'cancelar', texto_original: original, warnings }
  }

  // LISTAR URGENTES
  if (/(urgentes|prioridad|que\s*pedidos.*hoy|que\s*va\s*mal\s*de\s*plazo)/.test(texto)) {
    return { tipo: 'listar_urgentes', texto_original: original, warnings }
  }

  // PROPONER REORGANIZACION
  if (/(reorganiza|reorganizar|prioriza|adelanta|mete antes)/.test(texto)) {
    const refMatch = texto.match(/ped[-\s]*\d+[-\s]*\d+/i)
    return {
      tipo: 'proponer_reorganizacion',
      texto_original: original,
      pedido_referencia: refMatch ? refMatch[0].toUpperCase().replace(/\s+/g, '-') : undefined,
      warnings,
    }
  }

  // SIMULAR FECHA / FECHA DE ENTREGA
  if (/(fecha\s*de\s*entrega|cuando\s*estaria|para\s*cuando|simula\s*fecha)/.test(texto)) {
    const fecha = extraerFechaTexto(texto)
    return {
      tipo: 'simular_fecha',
      texto_original: original,
      fecha_iso: fecha ?? undefined,
      warnings: fecha ? [] : ['no detecte fecha — usare la mas temprana posible'],
    }
  }

  // FIJAR FECHA
  if (/(la fecha es|fecha limite|comprometelo|comprometelo para)/.test(texto)) {
    const fecha = extraerFechaTexto(texto)
    return {
      tipo: 'fijar_fecha',
      texto_original: original,
      fecha_iso: fecha ?? undefined,
      warnings: fecha ? [] : ['no detecte fecha'],
    }
  }

  // ANADIR LINEA
  if (/^(anade|añade|agrega|agregar|otra linea|otra\s*pieza|mete tambien|mete\s*una)/.test(texto)) {
    const linea = extraerLinea(texto, warnings)
    return {
      tipo: 'anadir_linea',
      texto_original: original,
      lineas: [linea],
      warnings,
    }
  }

  // CREAR PRESUPUESTO (default cuando hay palabras clave)
  if (/(presupuesto|presupuestar|cotizacion|cotizar|hazme\s*un\s*presupuesto)/.test(texto)) {
    const cliente = extraerCliente(texto)
    const linea = extraerLinea(texto, warnings)
    return {
      tipo: 'crear_presupuesto',
      texto_original: original,
      cliente_nombre: cliente.cliente_nombre,
      cliente_varios: cliente.cliente_varios,
      lineas: [linea],
      warnings,
    }
  }

  return {
    tipo: 'desconocido',
    texto_original: original,
    warnings: ['no entendi el comando — di "presupuesto", "anade linea", "fecha de entrega", "urgentes" o "reorganiza"'],
  }
}

// =============================================================
// EXTRACTORES COMPUESTOS
// =============================================================

function extraerCliente(texto: string): {
  cliente_nombre?: string
  cliente_varios?: boolean
} {
  if (/cliente\s*var(io|ios)/.test(texto)) return { cliente_varios: true }

  // Patron: "para CLIENTE_X" / "cliente CLIENTE_X" / "del cliente CLIENTE_X"
  const patrones = [
    /para\s+(?:el\s+)?cliente\s+([a-zñáéíóú0-9.\-\s]+?)(?:,|\.|$|\s+(?:tablon|tabla|zocalo|puerta|panel|frente|moldura|de|que|y|con))/i,
    /cliente\s+([a-zñáéíóú0-9.\-\s]+?)(?:,|\.|$|\s+(?:tablon|tabla|zocalo|puerta|panel|frente|moldura|de|que|y|con))/i,
    /para\s+([A-ZÑÁÉÍÓÚ][A-ZÑÁÉÍÓÚ0-9.\-\s]{2,})(?:,|\.|$)/,
  ]
  for (const re of patrones) {
    const m = texto.match(re)
    if (m && m[1]) {
      const nombre = m[1].trim().replace(/\s+/g, ' ')
      if (nombre.length >= 2 && nombre.length < 60) {
        return { cliente_nombre: nombre.toUpperCase() }
      }
    }
  }
  return {}
}

function extraerLinea(texto: string, warnings: string[]): LineaDictada {
  const dims = extraerDimensiones(texto)
  const procesos = extraerProcesos(texto)
  if (procesos.length === 0) {
    procesos.push('LIJADO', 'FONDO', 'LACADO', 'TERMINACION')
    warnings.push('no detecte procesos, asumo: lijado + fondo + lacado + terminacion')
  }
  const categoria = extraerCategoria(texto)
  const color = extraerRAL(texto)
  const cantidad = extraerCantidad(texto)

  // Descripcion: arma una desde lo detectado
  const partes: string[] = []
  if (categoria) partes.push(categoria)
  if (cantidad > 1) partes.unshift(`${cantidad}`)
  if (dims.ancho_mm && dims.alto_mm) {
    partes.push(`${dims.ancho_mm}×${dims.alto_mm}${dims.grosor_mm ? '×' + dims.grosor_mm : ''} mm`)
  } else if (dims.longitud_ml) {
    partes.push(`${dims.longitud_ml} ml`)
  }
  if (color) partes.push(color)
  const descripcion = partes.length > 0 ? partes.join(' ') : texto.slice(0, 80)

  return {
    descripcion,
    categoria,
    ancho_mm: dims.ancho_mm,
    alto_mm: dims.alto_mm,
    grosor_mm: dims.grosor_mm,
    longitud_ml: dims.longitud_ml,
    color_ral: color,
    procesos,
    cantidad,
    modo_precio: dims.modo_precio,
  }
}

function extraerFechaTexto(texto: string): string | null {
  // "5 de mayo" / "el 5 de mayo" / "12-05" / "12/05/2026"
  const meses: Record<string, number> = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4,
    'junio': 5, 'julio': 6, 'agosto': 7, 'septiembre': 8,
    'setiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
  }
  const m1 = texto.match(/(\d{1,2})\s*de\s*([a-z]+)(?:\s*(?:de\s*)?(\d{4}))?/i)
  if (m1) {
    const dia = parseInt(m1[1], 10)
    const mes = meses[m1[2].toLowerCase()]
    const ano = m1[3] ? parseInt(m1[3], 10) : new Date().getFullYear()
    if (dia >= 1 && dia <= 31 && mes != null) {
      const d = new Date(ano, mes, dia)
      if (d < new Date()) d.setFullYear(d.getFullYear() + 1)
      return d.toISOString()
    }
  }
  const m2 = texto.match(/(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?/)
  if (m2) {
    const dia = parseInt(m2[1], 10)
    const mes = parseInt(m2[2], 10) - 1
    let ano = m2[3] ? parseInt(m2[3], 10) : new Date().getFullYear()
    if (ano < 100) ano += 2000
    if (dia >= 1 && dia <= 31 && mes >= 0 && mes < 12) {
      return new Date(ano, mes, dia).toISOString()
    }
  }
  return null
}
