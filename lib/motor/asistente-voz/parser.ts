/**
 * Parser de comandos de voz/texto del asistente TURIVAL — sin LLM.
 *
 * Recibe texto bruto + DiccionarioAsistente (construido desde la BD) y
 * devuelve una IntencionDetectada con todas las referencias resueltas
 * (cliente_id, categoria_id, material_id, referencia_id) listas para
 * ejecutar contra los services.
 */

import {
  normalizar,
  detectarProcesos,
  buscarCliente,
  buscarCategoria,
  buscarMaterial,
  buscarReferencia,
  type DiccionarioAsistente,
  type ClienteDic,
  type CategoriaPiezaDic,
  type MaterialDic,
  type ReferenciaDic,
} from './diccionario'

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
  categoria?: CategoriaPiezaDic
  ancho_mm?: number
  alto_mm?: number
  longitud_ml?: number
  grosor_mm?: number
  color_ral?: string
  material_lacado?: MaterialDic
  material_fondo?: MaterialDic
  procesos: string[]
  cantidad: number
  modo_precio?: 'm2' | 'pieza' | 'ml'
  referencia?: ReferenciaDic            // si la frase apunta a una referencia
  pendiente?: boolean                   // true si no pudimos resolver datos clave
  motivo_pendiente?: string             // explicacion para mostrar en UI
}

export interface IntencionDetectada {
  tipo: TipoIntencion
  texto_original: string
  cliente?: ClienteDic
  cliente_varios?: boolean
  lineas?: LineaDictada[]
  fecha_iso?: string
  pedido_referencia?: string
  warnings: string[]
  resueltos: string[]                   // log de lo que detectamos bien
}

// =============================================================
// HELPERS
// =============================================================

function extraerNumero(s: string): number | null {
  const limpio = s.replace(/[^\d.,]/g, '').replace(',', '.')
  if (!limpio) return null
  const n = parseFloat(limpio)
  return isFinite(n) ? n : null
}

const NUMEROS_LITERALES: Record<string, number> = {
  'cero': 0, 'una': 1, 'uno': 1, 'un': 1, 'dos': 2, 'tres': 3,
  'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8,
  'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12, 'trece': 13,
  'catorce': 14, 'quince': 15, 'dieciseis': 16, 'diecisiete': 17,
  'dieciocho': 18, 'diecinueve': 19, 'veinte': 20, 'veinticinco': 25,
  'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
  'setenta': 70, 'ochenta': 80, 'noventa': 90, 'cien': 100, 'ciento': 100,
  'doscientos': 200, 'trescientos': 300, 'cuatrocientos': 400,
  'quinientos': 500, 'mil': 1000,
}

function extraerDimensiones(texto: string) {
  const out: {
    ancho_mm?: number
    alto_mm?: number
    grosor_mm?: number
    longitud_ml?: number
    modo_precio?: 'm2' | 'pieza' | 'ml'
  } = {}

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

  const mlRe = /(\d+(?:[.,]\d+)?)\s*(?:metros?\s*lineales?|ml\b)/i
  const ml = texto.match(mlRe)
  if (ml) {
    const n = extraerNumero(ml[1])
    if (n) {
      out.longitud_ml = n
      out.modo_precio = 'ml'
    }
  }

  if (!out.modo_precio && /\bpieza(s)?\b/i.test(texto) && !out.ancho_mm) {
    out.modo_precio = 'pieza'
  }

  return out
}

function extraerCantidad(texto: string): number {
  const numRe = /(\d+|una?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cincuenta)\s+(unidades?|piezas?|tablones?|tablas?|zocalos?|zócalos?|paneles?|puertas?|frentes?|cajones?|listones?|molduras?)/i
  const m = texto.match(numRe)
  if (!m) return 1
  const num = extraerNumero(m[1]) ?? NUMEROS_LITERALES[m[1].toLowerCase()] ?? 1
  return Math.max(1, Math.round(num))
}

function extraerRAL(texto: string): string | undefined {
  const m = texto.match(/ral\s*(\d{4})/i)
  return m ? `RAL ${m[1]}` : undefined
}

function extraerFechaTexto(texto: string): string | null {
  const meses: Record<string, number> = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4,
    'junio': 5, 'julio': 6, 'agosto': 7, 'septiembre': 8, 'setiembre': 8,
    'octubre': 9, 'noviembre': 10, 'diciembre': 11,
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

// =============================================================
// EXTRAER LINEA con resolucion de referencias / materiales
// =============================================================

function extraerLinea(
  texto: string,
  textoNorm: string,
  dic: DiccionarioAsistente,
  cliente_id: string | undefined,
  warnings: string[],
  resueltos: string[],
): LineaDictada {
  const dims = extraerDimensiones(texto)
  let procesos = detectarProcesos(textoNorm)
  const categoria = buscarCategoria(textoNorm, dic) ?? undefined
  if (categoria) resueltos.push(`categoria: ${categoria.nombre}`)

  // RAL → material lacado
  const ral = extraerRAL(texto)
  let materialLacado: MaterialDic | undefined
  if (ral) {
    const ralNorm = normalizar(ral)
    materialLacado = buscarMaterial(ralNorm, dic, 'lacado') ?? undefined
    if (materialLacado) resueltos.push(`lacado: ${materialLacado.nombre}`)
  } else {
    // Buscar cualquier material lacado por nombre dentro del texto
    materialLacado = buscarMaterial(textoNorm, dic, 'lacado') ?? undefined
    if (materialLacado) resueltos.push(`lacado: ${materialLacado.nombre}`)
  }

  // Fondo
  const materialFondo = buscarMaterial(textoNorm, dic, 'fondo') ?? undefined
  if (materialFondo) resueltos.push(`fondo: ${materialFondo.nombre}`)

  // Referencia recurrente (si tenemos cliente_id, prioriza ese)
  const referencia = buscarReferencia(textoNorm, dic, cliente_id) ?? undefined
  if (referencia) {
    resueltos.push(`referencia: ${referencia.referencia_cliente}`)
    // Si hay procesos vacios y la referencia tiene procesos, los heredamos despues en el ejecutor
  }

  if (procesos.length === 0 && !referencia) {
    procesos = ['LIJADO', 'FONDO', 'LACADO', 'TERMINACION']
    warnings.push('no detecte procesos, asumo lijado + fondo + lacado + terminacion')
  }

  const cantidad = extraerCantidad(texto)

  // Linea pendiente si no tiene ni dimensiones ni referencia ni categoria
  const tieneAlgo = dims.ancho_mm || dims.longitud_ml || referencia || categoria
  const pendiente = !tieneAlgo
  const motivo_pendiente = pendiente
    ? 'Faltan datos clave (dimensiones, categoria o referencia). Repasa la linea en el presupuesto.'
    : undefined

  // Descripcion
  const partes: string[] = []
  if (referencia) partes.push(referencia.nombre_pieza ?? referencia.referencia_cliente)
  else if (categoria) partes.push(categoria.nombre)
  if (cantidad > 1) partes.unshift(`${cantidad}`)
  if (dims.ancho_mm && dims.alto_mm) {
    partes.push(`${dims.ancho_mm}×${dims.alto_mm}${dims.grosor_mm ? '×' + dims.grosor_mm : ''} mm`)
  } else if (dims.longitud_ml) {
    partes.push(`${dims.longitud_ml} ml`)
  }
  if (ral) partes.push(ral)
  else if (materialLacado) partes.push(materialLacado.nombre)
  const descripcion = partes.length > 0 ? partes.join(' ') : (texto.slice(0, 80) || 'Linea pendiente')

  return {
    descripcion, categoria,
    ancho_mm: dims.ancho_mm, alto_mm: dims.alto_mm,
    grosor_mm: dims.grosor_mm, longitud_ml: dims.longitud_ml,
    color_ral: ral, material_lacado: materialLacado, material_fondo: materialFondo,
    procesos, cantidad, modo_precio: dims.modo_precio,
    referencia, pendiente, motivo_pendiente,
  }
}

// =============================================================
// PARSEAR
// =============================================================

export function parsearComandoVoz(
  textoBruto: string,
  dic: DiccionarioAsistente,
): IntencionDetectada {
  const original = textoBruto
  const textoNorm = normalizar(textoBruto)
  const warnings: string[] = []
  const resueltos: string[] = []

  if (/^(cancela|cancelar|olvida|borra eso|no importa)/.test(textoNorm)) {
    return { tipo: 'cancelar', texto_original: original, warnings, resueltos }
  }

  if (/(urgentes|prioridad|que pedidos.*hoy|que va mal de plazo|sin reservar)/.test(textoNorm)) {
    return { tipo: 'listar_urgentes', texto_original: original, warnings, resueltos }
  }

  if (/(reorganiza|reorganizar|prioriza|adelanta|mete antes|mover)/.test(textoNorm)) {
    const refMatch = textoNorm.match(/ped[\s\-]*\d+[\s\-]*\d+/i)
    return {
      tipo: 'proponer_reorganizacion', texto_original: original,
      pedido_referencia: refMatch ? refMatch[0].toUpperCase().replace(/\s+/g, '-') : undefined,
      warnings, resueltos,
    }
  }

  if (/(fecha de entrega|cuando estaria|para cuando|simula fecha)/.test(textoNorm)) {
    const fecha = extraerFechaTexto(textoNorm)
    return {
      tipo: 'simular_fecha', texto_original: original,
      fecha_iso: fecha ?? undefined,
      warnings: fecha ? warnings : [...warnings, 'no detecte fecha — usare la mas temprana posible'],
      resueltos,
    }
  }

  // Cliente: busca antes de extraer linea (la linea puede usar ese cliente_id)
  let cliente: ClienteDic | undefined
  let cliente_varios = false
  if (/\bclient[ea]\s*vari(o|os|as|a)\b|\bvarios?\b\s*$|\bvarias?\b\s*$/i.test(textoNorm)) {
    cliente_varios = true
    const cVarios = dic.clientes.find((c) =>
      c.alias.some((a) => a.includes('vario') || a.includes('varia')),
    )
    if (cVarios) {
      cliente = cVarios
      resueltos.push(`cliente: ${cliente.razon_social ?? cliente.nombre_comercial} (varios)`)
    }
  } else {
    const c = buscarCliente(textoNorm, dic)
    if (c) {
      cliente = c
      resueltos.push(`cliente: ${cliente.razon_social ?? cliente.nombre_comercial}`)
    }
  }

  // ANADIR LINEA
  if (/^(anade|añade|agrega|agregar|otra linea|otra pieza|mete tambien|mete una|añadir|anadir)/.test(textoNorm)) {
    const linea = extraerLinea(textoBruto, textoNorm, dic, cliente?.id, warnings, resueltos)
    return { tipo: 'anadir_linea', texto_original: original, lineas: [linea], warnings, resueltos }
  }

  // Detectores secundarios para inferir presupuesto cuando no hay palabra clave
  const dims = extraerDimensiones(textoBruto)
  const tieneDims = !!(dims.ancho_mm || dims.longitud_ml)
  const procesosDetectados = detectarProcesos(textoNorm)
  const tieneProcesos = procesosDetectados.length > 0
  const tieneCategoria = !!buscarCategoria(textoNorm, dic)
  const tieneRAL = /ral\s*\d{4}/i.test(textoNorm)
  const tieneRef = !!buscarReferencia(textoNorm, dic, cliente?.id)
  const tieneMaterial = !!buscarMaterial(textoNorm, dic)

  const esPresupuesto = /(presupuesto|presupuestar|cotizacion|cotización|cotizar|hazme un presupuesto|quiero un presupuesto|nuevo presupuesto|hazme un|quiero|nueva\s*pieza)/.test(textoNorm)

  // Si hay CUALQUIER pista (cliente, dims, RAL, referencia, categoria, material o procesos),
  // intentamos crear presupuesto. Solo caemos a "desconocido" cuando literalmente
  // no hemos detectado nada util.
  const tieneAlgunaSenal = !!cliente || tieneDims || tieneRAL || tieneRef
    || tieneCategoria || tieneMaterial || tieneProcesos

  if (esPresupuesto || tieneAlgunaSenal) {
    const linea = extraerLinea(textoBruto, textoNorm, dic, cliente?.id, warnings, resueltos)
    if (!cliente) {
      warnings.push('no detecte cliente — di "para CLIENTE_X" o "cliente varios"')
    }
    return {
      tipo: 'crear_presupuesto', texto_original: original,
      cliente, cliente_varios,
      lineas: [linea],
      warnings, resueltos,
    }
  }

  // De verdad no hay nada — explica que palabras detecto y cuales no
  const debug: string[] = []
  if (!cliente) debug.push('cliente: ✗')
  if (!tieneCategoria) debug.push('categoria: ✗')
  if (!tieneDims) debug.push('dimensiones: ✗')
  if (!tieneRAL) debug.push('color RAL: ✗')
  if (!tieneRef) debug.push('referencia recurrente: ✗')

  return {
    tipo: 'desconocido', texto_original: original,
    warnings: [
      ...warnings,
      `no entendi el comando "${textoBruto.slice(0, 80)}"`,
      `pistas que no encontre: ${debug.join(', ')}`,
      'di al menos un cliente, una categoria (puerta, zocalo, panel...) o unas dimensiones (200x50)',
    ],
    resueltos,
  }
}
