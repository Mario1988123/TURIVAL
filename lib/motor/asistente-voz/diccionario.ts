/**
 * Diccionario dinamico del asistente — se construye leyendo las tablas
 * reales de la BD. Sin LLM, sin coste.
 *
 * Cubre:
 *   - clientes (razon social + nombre comercial → cliente_id)
 *   - categorias_pieza (nombre + sinonimos hardcoded → id)
 *   - materiales lacados (nombre + RAL/NCS → material_id)
 *   - materiales fondos (nombre → material_id)
 *   - referencias_cliente (referencia_cliente, referencia_interna,
 *     nombre_pieza → referencia_id, cliente_id)
 *   - procesos_catalogo (codigo + nombre + sinonimos → proceso_codigo)
 *
 * Variantes:
 *   - normaliza tildes y mayusculas
 *   - genera variantes de plural/singular cuando aplica
 *   - matching contains + match exacto
 */

import { listarClientes } from '@/lib/services/clientes'
import { listarCategoriasPieza } from '@/lib/services/categorias-pieza'
import { listarLacados, listarFondos } from '@/lib/services/materiales'

// =============================================================
// TIPOS
// =============================================================

export interface DiccionarioMatch<T> {
  termino: string         // tal y como aparece en la frase
  candidato: T
  score: number           // 0..1, mas alto = mejor match
}

export interface ClienteDic {
  id: string
  razon_social: string | null
  nombre_comercial: string | null
  alias: string[]         // todas las formas normalizadas
}

export interface CategoriaPiezaDic {
  id: string
  nombre: string
  alias: string[]
}

export interface MaterialDic {
  id: string
  nombre: string
  tipo: 'lacado' | 'fondo'
  codigo_ral: string | null   // si lacado y nombre contiene RAL
  alias: string[]
}

export interface ReferenciaDic {
  id: string
  cliente_id: string
  referencia_cliente: string
  referencia_interna: string | null
  nombre_pieza: string | null
  alias: string[]
}

export interface DiccionarioAsistente {
  clientes: ClienteDic[]
  categorias: CategoriaPiezaDic[]
  materiales: MaterialDic[]
  referencias: ReferenciaDic[]
  // Versionado para invalidacion de cache
  built_at: number
}

// =============================================================
// SINONIMOS DE PROCESOS (hardcoded — son fijos en el catalogo)
// =============================================================

export const SINONIMOS_PROCESO: Record<string, string> = {
  // LIJADO
  'lijado': 'LIJADO', 'lija': 'LIJADO', 'lijar': 'LIJADO',
  'lijada': 'LIJADO', 'lijadas': 'LIJADO', 'lijados': 'LIJADO',
  'lijado fino': 'LIJADO',
  // FONDO / FONDEADO (mismo proceso)
  'fondo': 'FONDO', 'fondear': 'FONDO', 'fondeado': 'FONDO',
  'fondo blanco': 'FONDO', 'fondo negro': 'FONDO', 'fondo gris': 'FONDO',
  'fondeada': 'FONDO', 'fondeo': 'FONDO', 'imprimacion': 'FONDO',
  'imprimación': 'FONDO', 'sellador': 'FONDO',
  // LIJADO_2
  'doble lijado': 'LIJADO_2', 'segundo lijado': 'LIJADO_2',
  'lijado 2': 'LIJADO_2', 're-lijado': 'LIJADO_2', 'relijado': 'LIJADO_2',
  // FONDEADO_2
  'doble fondeado': 'FONDEADO_2', 'doble fondo': 'FONDEADO_2',
  'segundo fondo': 'FONDEADO_2', 'segundo fondeado': 'FONDEADO_2',
  'refondeado': 'FONDEADO_2', 'fondo doble': 'FONDEADO_2',
  // LACADO
  'lacado': 'LACADO', 'lacar': 'LACADO', 'lacada': 'LACADO',
  'pintado': 'LACADO', 'pintura': 'LACADO', 'pintar': 'LACADO',
  'esmaltado': 'LACADO', 'esmalte': 'LACADO',
  // TERMINACION
  'terminacion': 'TERMINACION', 'terminación': 'TERMINACION',
  'acabado': 'TERMINACION', 'acabados': 'TERMINACION',
  'pulido': 'TERMINACION', 'pulir': 'TERMINACION',
  'matizado': 'TERMINACION', 'mate': 'TERMINACION',
  'brillante': 'TERMINACION', 'satinado': 'TERMINACION',
  // RECEPCION
  'recepcion': 'RECEPCION', 'recepción': 'RECEPCION',
  'entrada': 'RECEPCION',
  // PICKING
  'picking': 'PICKING', 'preparacion': 'PICKING',
  'preparación': 'PICKING', 'embalaje': 'PICKING',
  'empaquetado': 'PICKING', 'empaquetar': 'PICKING',
  // COMPROB_MATERIAL
  'comprobacion': 'COMPROB_MATERIAL', 'comprobación': 'COMPROB_MATERIAL',
  'comprobar material': 'COMPROB_MATERIAL', 'verificar material': 'COMPROB_MATERIAL',
  'inspeccion': 'COMPROB_MATERIAL', 'inspección': 'COMPROB_MATERIAL',
}

// =============================================================
// SINONIMOS DE CATEGORIAS (extra a los nombres reales)
// =============================================================

const SINONIMOS_CATEGORIA_EXTRA: Record<string, string[]> = {
  'tablon':   ['tablon', 'tablón', 'tabla', 'tablones', 'tablones de madera', 'lista madera'],
  'zocalo':   ['zocalo', 'zócalo', 'zocalos', 'zócalos', 'rodapie', 'rodapié'],
  'puerta':   ['puerta', 'puertas', 'puerta cocina', 'puertas cocina', 'puerta armario', 'frente puerta'],
  'panel':    ['panel', 'paneles', 'tablero', 'tableros', 'panel cocina', 'panel pared'],
  'cajon':    ['cajon', 'cajón', 'cajones', 'frente cajon', 'frente cajón'],
  'frente':   ['frente', 'frentes', 'frente cocina', 'frente armario'],
  'moldura':  ['moldura', 'molduras', 'cornisa', 'cornisas', 'remate'],
  'irregular':['irregular', 'pieza irregular', 'manual', 'a medida'],
  'liston':   ['liston', 'listón', 'listones', 'listón madera'],
  'mueble':   ['mueble', 'muebles', 'cuerpo mueble', 'mueble cocina'],
}

// =============================================================
// HELPERS
// =============================================================

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function generarVariantes(s: string): string[] {
  const base = normalizar(s)
  const variantes = new Set<string>([base])
  // plural/singular naive
  if (base.endsWith('s')) variantes.add(base.slice(0, -1))
  else variantes.add(base + 's')
  // sin acentos ya esta cubierto por normalizar
  // separar palabras (cada token y la combinacion)
  const palabras = base.split(' ').filter((w) => w.length > 2)
  for (const p of palabras) variantes.add(p)
  return Array.from(variantes)
}

// =============================================================
// CONSTRUIR DICCIONARIO DESDE LA BD
// =============================================================

let cacheDic: DiccionarioAsistente | null = null
const TTL_MS = 5 * 60_000 // 5 minutos

export async function construirDiccionario(forzar = false): Promise<DiccionarioAsistente> {
  if (!forzar && cacheDic && Date.now() - cacheDic.built_at < TTL_MS) {
    return cacheDic
  }

  const [clientesPag, categorias, lacados, fondos] = await Promise.all([
    listarClientes({ limite: 5000, pagina: 0 }),
    listarCategoriasPieza(true),
    listarLacados(),
    listarFondos(),
  ])

  // Clientes
  const clientes: ClienteDic[] = clientesPag.clientes.map((c: any) => {
    const alias = new Set<string>()
    if (c.razon_social) generarVariantes(c.razon_social).forEach((a) => alias.add(a))
    if (c.nombre_comercial) generarVariantes(c.nombre_comercial).forEach((a) => alias.add(a))
    return {
      id: c.id,
      razon_social: c.razon_social ?? null,
      nombre_comercial: c.nombre_comercial ?? null,
      alias: Array.from(alias),
    }
  })

  // Categorias (con sinonimos extra por slug heuristico)
  const cats: CategoriaPiezaDic[] = categorias.map((c: any) => {
    const alias = new Set<string>()
    generarVariantes(c.nombre).forEach((a) => alias.add(a))
    const baseSlug = normalizar(c.nombre).replace(/s$/, '')
    for (const [slug, sins] of Object.entries(SINONIMOS_CATEGORIA_EXTRA)) {
      if (baseSlug.includes(slug) || slug.includes(baseSlug.slice(0, 5))) {
        for (const s of sins) generarVariantes(s).forEach((a) => alias.add(a))
      }
    }
    return { id: c.id, nombre: c.nombre, alias: Array.from(alias) }
  })

  // Materiales (lacado/fondo)
  const materiales: MaterialDic[] = []
  for (const m of lacados) {
    const alias = new Set<string>()
    generarVariantes(m.nombre).forEach((a) => alias.add(a))
    const ral = (m.nombre.match(/RAL\s*\d{4}/i) || [null])[0]
    if (ral) {
      alias.add(normalizar(ral))
      alias.add(normalizar(ral.replace(/\s+/g, '')))
    }
    materiales.push({
      id: m.id,
      nombre: m.nombre,
      tipo: 'lacado',
      codigo_ral: ral ? ral.toUpperCase().replace(/\s+/g, ' ') : null,
      alias: Array.from(alias),
    })
  }
  for (const m of fondos) {
    const alias = new Set<string>()
    generarVariantes(m.nombre).forEach((a) => alias.add(a))
    materiales.push({
      id: m.id,
      nombre: m.nombre,
      tipo: 'fondo',
      codigo_ral: null,
      alias: Array.from(alias),
    })
  }

  // Referencias_cliente: cargamos todas las activas (sin filtrar por cliente)
  // No usamos listarReferenciasPorCliente para no hacer N consultas;
  // hacemos una unica directa a la tabla.
  const supabase = (await import('@/lib/services/client')).createClient()
  const { data: refsRaw } = await supabase
    .from('referencias_cliente')
    .select('id, cliente_id, referencia_cliente, referencia_interna, nombre_pieza')
    .eq('activo', true)
    .limit(5000)
  const referencias: ReferenciaDic[] = ((refsRaw ?? []) as any[]).map((r) => {
    const alias = new Set<string>()
    if (r.referencia_cliente) generarVariantes(r.referencia_cliente).forEach((a) => alias.add(a))
    if (r.referencia_interna) generarVariantes(r.referencia_interna).forEach((a) => alias.add(a))
    if (r.nombre_pieza) generarVariantes(r.nombre_pieza).forEach((a) => alias.add(a))
    return {
      id: r.id,
      cliente_id: r.cliente_id,
      referencia_cliente: r.referencia_cliente,
      referencia_interna: r.referencia_interna ?? null,
      nombre_pieza: r.nombre_pieza ?? null,
      alias: Array.from(alias),
    }
  })

  cacheDic = {
    clientes, categorias: cats, materiales, referencias,
    built_at: Date.now(),
  }
  return cacheDic
}

export function invalidarDiccionario() {
  cacheDic = null
}

// =============================================================
// MATCHING
// =============================================================

function contiene(textoNorm: string, alias: string[]): boolean {
  for (const a of alias) {
    if (a.length < 3) continue
    if (textoNorm.includes(a)) return true
  }
  return false
}

function scoreMatch(textoNorm: string, alias: string[]): number {
  let mejor = 0
  for (const a of alias) {
    if (a.length < 3) continue
    if (textoNorm === a) mejor = Math.max(mejor, 1)
    else if (textoNorm.includes(a)) mejor = Math.max(mejor, a.length / textoNorm.length)
  }
  return mejor
}

export function buscarCliente(textoNorm: string, dic: DiccionarioAsistente): ClienteDic | null {
  let mejor: { c: ClienteDic; score: number } | null = null
  for (const c of dic.clientes) {
    const s = scoreMatch(textoNorm, c.alias)
    if (s > 0 && (!mejor || s > mejor.score)) mejor = { c, score: s }
  }
  return mejor?.c ?? null
}

export function buscarCategoria(textoNorm: string, dic: DiccionarioAsistente): CategoriaPiezaDic | null {
  let mejor: { c: CategoriaPiezaDic; score: number } | null = null
  for (const c of dic.categorias) {
    const s = scoreMatch(textoNorm, c.alias)
    if (s > 0 && (!mejor || s > mejor.score)) mejor = { c, score: s }
  }
  return mejor?.c ?? null
}

export function buscarMaterial(
  textoNorm: string,
  dic: DiccionarioAsistente,
  tipo?: 'lacado' | 'fondo',
): MaterialDic | null {
  let mejor: { m: MaterialDic; score: number } | null = null
  for (const m of dic.materiales) {
    if (tipo && m.tipo !== tipo) continue
    const s = scoreMatch(textoNorm, m.alias)
    if (s > 0 && (!mejor || s > mejor.score)) mejor = { m, score: s }
  }
  return mejor?.m ?? null
}

export function buscarReferencia(
  textoNorm: string,
  dic: DiccionarioAsistente,
  cliente_id?: string,
): ReferenciaDic | null {
  let mejor: { r: ReferenciaDic; score: number } | null = null
  for (const r of dic.referencias) {
    if (cliente_id && r.cliente_id !== cliente_id) continue
    const s = scoreMatch(textoNorm, r.alias)
    if (s > 0.3 && (!mejor || s > mejor.score)) mejor = { r, score: s }
  }
  return mejor?.r ?? null
}

export function detectarProcesos(textoNorm: string): string[] {
  const detectados = new Set<string>()
  // Ordenar sinonimos por longitud descendente: prioriza "doble fondeado"
  // sobre "fondeado" para no asignarlo a FONDO.
  const claves = Object.keys(SINONIMOS_PROCESO).sort((a, b) => b.length - a.length)
  const consumido = new Array(textoNorm.length).fill(false)
  for (const k of claves) {
    let idx = textoNorm.indexOf(k)
    while (idx !== -1) {
      // Si esta region ya fue consumida por un sinonimo mas largo, saltar
      let yaConsumido = false
      for (let i = idx; i < idx + k.length; i++) {
        if (consumido[i]) { yaConsumido = true; break }
      }
      if (!yaConsumido) {
        detectados.add(SINONIMOS_PROCESO[k])
        for (let i = idx; i < idx + k.length; i++) consumido[i] = true
      }
      idx = textoNorm.indexOf(k, idx + 1)
    }
  }
  return Array.from(detectados)
}
