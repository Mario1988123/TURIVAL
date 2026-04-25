'use client'

/**
 * Asistente por voz TURIVAL — Capa 9 (sin LLM, gratis).
 *
 * Web Speech API del navegador transcribe la voz a texto. El parser
 * propio de lib/motor/asistente-voz/parser.ts mapea palabras a
 * tablas/acciones y este componente las ejecuta llamando a los
 * services existentes.
 *
 * Sin memoria, sin servidor IA, sin coste. Solo funciona en navegadores
 * con SpeechRecognition (Chrome/Edge sobre todo).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, Bot, X, Send, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { parsearComandoVoz, type IntencionDetectada, type LineaDictada } from '@/lib/motor/asistente-voz/parser'
import { crearPresupuestoV2 } from '@/lib/services/presupuestos-v2'
import { listarClientes } from '@/lib/services/clientes'
import { listarCategoriasPieza } from '@/lib/services/categorias-pieza'

// =============================================================
// Web Speech API typing
// =============================================================

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  results: { length: number; [i: number]: SpeechRecognitionResultLike }
  resultIndex: number
}
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

function obtenerSR(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null
  return new Ctor() as SpeechRecognitionLike
}

// =============================================================
// LOG en pantalla
// =============================================================

interface MensajeLog {
  id: number
  tipo: 'usuario' | 'asistente' | 'error' | 'ok'
  texto: string
  detalle?: string
  href?: string
}

// =============================================================
// COMPONENTE
// =============================================================

export default function AsistenteVoz() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [transcripcion, setTranscripcion] = useState('')
  const [historial, setHistorial] = useState<MensajeLog[]>([])
  const [procesando, setProcesando] = useState(false)
  const [textoManual, setTextoManual] = useState('')
  const idRef = useRef(0)
  const srRef = useRef<SpeechRecognitionLike | null>(null)

  function pushLog(m: Omit<MensajeLog, 'id'>) {
    setHistorial((prev) => [...prev, { ...m, id: ++idRef.current }])
  }

  // Inicializar SR una vez
  useEffect(() => {
    const sr = obtenerSR()
    if (!sr) return
    sr.continuous = false
    sr.interimResults = true
    sr.lang = 'es-ES'
    srRef.current = sr
  }, [])

  const arrancar = useCallback(() => {
    const sr = srRef.current
    if (!sr) {
      pushLog({ tipo: 'error', texto: 'Tu navegador no soporta voz. Escribe el comando abajo o usa Chrome/Edge.' })
      return
    }
    setTranscripcion('')
    setEscuchando(true)
    sr.onresult = (e) => {
      let t = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript
      }
      setTranscripcion(t)
    }
    sr.onerror = (e) => {
      pushLog({ tipo: 'error', texto: `Error de voz: ${e.error}` })
      setEscuchando(false)
    }
    sr.onend = () => {
      setEscuchando(false)
    }
    sr.start()
  }, [])

  const parar = useCallback(() => {
    srRef.current?.stop()
    setEscuchando(false)
  }, [])

  async function ejecutar(textoComando: string) {
    if (!textoComando.trim()) return
    setProcesando(true)
    pushLog({ tipo: 'usuario', texto: textoComando })
    try {
      const intencion = parsearComandoVoz(textoComando)
      for (const w of intencion.warnings) pushLog({ tipo: 'asistente', texto: `⚠ ${w}` })

      switch (intencion.tipo) {
        case 'crear_presupuesto':
          await ejecutarCrearPresupuesto(intencion, pushLog, router)
          break
        case 'anadir_linea':
          pushLog({ tipo: 'asistente', texto: 'Para añadir lineas, abre el presupuesto en /presupuestos y usa el boton "Añadir linea". Hago esa accion en proxima version.' })
          break
        case 'simular_fecha':
          await ejecutarSimularFecha(intencion, pushLog)
          break
        case 'listar_urgentes':
          await ejecutarListarUrgentes(pushLog)
          break
        case 'proponer_reorganizacion':
          pushLog({ tipo: 'asistente', texto: 'Reorganizar pedidos: vete al planificador y arrastra las tareas. La reorganizacion automatica llega en proxima iteracion.' })
          break
        case 'cancelar':
          pushLog({ tipo: 'ok', texto: 'Cancelado.' })
          break
        case 'desconocido':
          // Los warnings ya se mostraron
          break
      }
    } catch (e: any) {
      pushLog({ tipo: 'error', texto: e?.message ?? 'Error desconocido' })
    } finally {
      setProcesando(false)
      setTranscripcion('')
      setTextoManual('')
    }
  }

  function enviar() {
    const t = textoManual || transcripcion
    if (!t.trim()) return
    ejecutar(t)
  }

  return (
    <>
      {/* FAB flotante */}
      <button
        type="button"
        aria-label="Abrir asistente por voz"
        onClick={() => setAbierto((v) => !v)}
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 ${
          abierto
            ? 'bg-blue-600 text-white'
            : 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-blue-500/30'
        }`}
      >
        {abierto ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {abierto && (
        <div className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)] rounded-xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="font-semibold text-slate-900 flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600" />
                Asistente TURIVAL
              </div>
              <div className="text-[11px] text-slate-500">
                voz local · sin IA · 100% gratis
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm">
            {historial.length === 0 && (
              <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold mb-1">Ejemplos que entiendo:</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li><em>"Presupuesto para TURMALINA, tablon 200 por 50, RAL 9003, doble fondeado"</em></li>
                  <li><em>"Anade linea zocalo 30 metros lineales lacado RAL 9010"</em></li>
                  <li><em>"Para cuando estaria si lo empiezo hoy"</em></li>
                  <li><em>"Muestrame pedidos urgentes"</em></li>
                </ul>
              </div>
            )}
            {historial.map((m) => (
              <div
                key={m.id}
                className={`rounded-md px-3 py-2 ${
                  m.tipo === 'usuario'   ? 'bg-blue-50 border border-blue-100 text-blue-900' :
                  m.tipo === 'error'     ? 'bg-red-50 border border-red-200 text-red-900' :
                  m.tipo === 'ok'        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' :
                  'bg-slate-50 border border-slate-200 text-slate-700'
                }`}
              >
                {m.tipo === 'error' && <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />}
                {m.tipo === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />}
                <span className="whitespace-pre-wrap">{m.texto}</span>
                {m.detalle && <div className="mt-1 text-xs opacity-80 whitespace-pre-wrap">{m.detalle}</div>}
                {m.href && (
                  <button
                    type="button"
                    onClick={() => router.push(m.href!)}
                    className="mt-1 text-xs text-blue-700 underline"
                  >
                    Abrir →
                  </button>
                )}
              </div>
            ))}
            {procesando && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Procesando…
              </div>
            )}
          </div>

          <div className="border-t p-3 space-y-2">
            {transcripcion && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-xs text-amber-900">
                <em>{transcripcion}</em>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={escuchando ? parar : arrancar}
                className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                  escuchando ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={escuchando ? 'Parar' : 'Hablar'}
              >
                {escuchando ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <input
                type="text"
                value={textoManual}
                onChange={(e) => setTextoManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') enviar() }}
                placeholder="Escribe el comando o pulsa el micro…"
                className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={enviar}
                disabled={procesando || (!textoManual && !transcripcion)}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// =============================================================
// EJECUTORES DE INTENCION
// =============================================================

async function ejecutarCrearPresupuesto(
  intencion: IntencionDetectada,
  pushLog: (m: Omit<MensajeLog, 'id'>) => void,
  router: ReturnType<typeof useRouter>,
) {
  const lineas = intencion.lineas ?? []
  if (lineas.length === 0) {
    pushLog({ tipo: 'error', texto: 'No detecte ninguna pieza en el comando.' })
    return
  }

  // 1) Resolver cliente (listarClientes devuelve { clientes, total, ... })
  const { clientes } = await listarClientes({ limite: 5000, pagina: 0 })
  let cliente: (typeof clientes)[number] | null = null
  if (intencion.cliente_varios) {
    cliente = clientes.find((c: any) =>
      /vario/i.test(c.razon_social ?? '') || /vario/i.test(c.nombre_comercial ?? ''),
    ) ?? null
    if (!cliente) {
      pushLog({ tipo: 'error', texto: 'No tienes ningun cliente "varios" creado. Crealo primero en /dashboard/clientes con razon social "VARIOS".' })
      return
    }
  } else if (intencion.cliente_nombre) {
    const buscar = intencion.cliente_nombre.toUpperCase()
    cliente = clientes.find((c: any) => {
      const nombres = [c.razon_social, c.nombre_comercial].filter(Boolean) as string[]
      return nombres.some((n) => n.toUpperCase().includes(buscar))
    }) ?? null
    if (!cliente) {
      pushLog({ tipo: 'error', texto: `No encuentro cliente "${intencion.cliente_nombre}". ¿Esta dado de alta?` })
      return
    }
  } else {
    pushLog({ tipo: 'error', texto: 'No detecte cliente. Di "para CLIENTE_X" o "cliente varios".' })
    return
  }

  // 2) Resolver categoria_pieza_id (opcional)
  const categorias = await listarCategoriasPieza(true)

  // 3) Mapear lineas a LineaPresupuestoInput
  const lineasInput = lineas.map((l, i) => construirLineaPersonalizada(l, i, categorias))

  // 4) Crear
  const res = await crearPresupuestoV2({
    cliente_id: cliente.id,
    lineas: lineasInput,
  })

  pushLog({
    tipo: 'ok',
    texto: `Presupuesto ${res.numero} creado para ${cliente.razon_social ?? cliente.nombre_comercial}.`,
    detalle: `${res.lineas_creadas} linea(s) · ${res.total.toFixed(2)} € (sin descuento)`,
    href: `/presupuestos/${res.presupuesto_id}`,
  })
  router.refresh()
}

function construirLineaPersonalizada(
  l: LineaDictada,
  i: number,
  categorias: { id: string; nombre: string }[],
): any /* LineaPresupuestoInput */ {
  const cat = l.categoria
    ? categorias.find((c) => c.nombre.toLowerCase().includes(l.categoria!.toLowerCase()))
    : null

  const procesos = l.procesos.map((codigo, idx) => ({
    proceso_codigo: codigo,
    orden: idx,
    tiempo_base_min: 0,
    tiempo_por_m2_min: 0,
  }))

  return {
    tipo: 'personalizada',
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    orden: i,
    datos_personalizada: {
      categoria_pieza_id: cat?.id ?? null,
      modo_precio: l.modo_precio ?? 'm2',
      ancho: l.ancho_mm ?? null,
      alto: l.alto_mm ?? null,
      grosor: l.grosor_mm ?? null,
      longitud_ml: l.longitud_ml ?? null,
      cara_frontal: true,
      cara_trasera: false,
      canto_superior: false,
      canto_inferior: false,
      canto_izquierdo: false,
      canto_derecho: false,
      contabilizar_grosor: false,
      material_lacado_id: null,
      material_fondo_id: null,
      factor_complejidad: 'media' as const,
      descuento_porcentaje: 0,
      precio_aproximado: false,
      procesos,
    },
  }
}

async function ejecutarSimularFecha(
  intencion: IntencionDetectada,
  pushLog: (m: Omit<MensajeLog, 'id'>) => void,
) {
  pushLog({
    tipo: 'asistente',
    texto: 'Para simular fecha de entrega ya tienes el boton "Recomendar fecha" en /presupuestos/[id] y /pedidos/[id]. Lo conecto al asistente en proxima version.',
  })
  if (intencion.fecha_iso) {
    pushLog({ tipo: 'ok', texto: `Fecha detectada: ${new Date(intencion.fecha_iso).toLocaleDateString('es-ES')}` })
  }
}

async function ejecutarListarUrgentes(pushLog: (m: Omit<MensajeLog, 'id'>) => void) {
  const { accionPedidosFechaSinReservar } = await import('@/lib/actions/simulador-entrega')
  const res = await accionPedidosFechaSinReservar()
  if (!res.ok) {
    pushLog({ tipo: 'error', texto: `No pude consultar pedidos: ${res.error}` })
    return
  }
  if (res.items.length === 0) {
    pushLog({ tipo: 'ok', texto: 'No hay pedidos con fecha acordada sin reservar hueco. Todo bajo control.' })
    return
  }
  pushLog({
    tipo: 'asistente',
    texto: `Hay ${res.items.length} pedido(s) con fecha sin reservar:`,
    detalle: res.items
      .slice(0, 6)
      .map((p) => `${p.numero} · ${p.cliente_nombre} · ${new Date(p.fecha_entrega_estimada).toLocaleDateString('es-ES')}`)
      .join('\n'),
    href: '/planificador',
  })
}
