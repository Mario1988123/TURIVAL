'use client'

/**
 * Asistente TURIVAL — Capa 9 sin LLM, gratis.
 *
 * Entradas: voz (Web Speech API), texto manual o foto (OCR via
 * tesseract.js). Pipeline:
 *   entrada -> texto -> parser con diccionario dinamico de la BD
 *   -> ejecutor que llama services existentes.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mic, MicOff, Bot, X, Send, Loader2, AlertTriangle, CheckCircle2,
  Camera, ImageIcon,
} from 'lucide-react'
import { parsearComandoVoz, type IntencionDetectada, type LineaDictada } from '@/lib/motor/asistente-voz/parser'
import { construirDiccionario, invalidarDiccionario, type DiccionarioAsistente } from '@/lib/motor/asistente-voz/diccionario'
import { crearPresupuestoV2 } from '@/lib/services/presupuestos-v2'
import { createClient } from '@/lib/supabase/client'

// =============================================================
// Web Speech API typing
// =============================================================

interface SpeechRecognitionResultLike { isFinal: boolean; 0: { transcript: string } }
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

interface MensajeLog {
  id: number
  tipo: 'usuario' | 'asistente' | 'error' | 'ok'
  texto: string
  detalle?: string
  href?: string
  /** Acciones contextuales (ej. crear cliente que falta, guardar como referencia) */
  acciones?: Array<{ label: string; onClick: () => void | Promise<void>; estilo?: 'primario' | 'secundario' }>
}

/**
 * Pre-procesa una imagen para mejorar resultado del OCR:
 *   - redimensiona si es enorme (max 2000px de lado largo)
 *   - aumenta contraste
 *   - convierte a escala de grises
 * Devuelve un Blob image/png. Si falla, devuelve el File original.
 */
async function preprocesarImagen(file: File): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    if (typeof window === 'undefined') return resolve(file)
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      try {
        const MAX = 2000
        const escala = Math.min(1, MAX / Math.max(img.width, img.height))
        const w = Math.round(img.width * escala)
        const h = Math.round(img.height * escala)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { URL.revokeObjectURL(url); resolve(file); return }
        ctx.drawImage(img, 0, 0, w, h)
        // Escala de grises + contraste +50%
        const data = ctx.getImageData(0, 0, w, h)
        const arr = data.data
        const factor = 1.5
        const intercept = 128 * (1 - factor)
        for (let i = 0; i < arr.length; i += 4) {
          const gray = 0.299 * arr[i] + 0.587 * arr[i + 1] + 0.114 * arr[i + 2]
          let v = gray * factor + intercept
          v = Math.max(0, Math.min(255, v))
          arr[i] = v; arr[i + 1] = v; arr[i + 2] = v
        }
        ctx.putImageData(data, 0, 0)
        canvas.toBlob((b) => {
          URL.revokeObjectURL(url)
          if (b) resolve(b)
          else resolve(file)
        }, 'image/png')
      } catch {
        URL.revokeObjectURL(url)
        resolve(file)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo cargar la imagen'))
    }
    img.src = url
  })
}

/**
 * Busca patrones tipo "CLIENTE: X" en las primeras 5 lineas del texto
 * OCR. Si lo encuentra, devuelve el nombre para usar como cabecera.
 */
function detectarClienteEnCabecera(texto: string): string | null {
  const lineas = texto.split(/\r?\n/).slice(0, 8)
  for (const l of lineas) {
    const m = l.match(/cliente\s*[:\-]?\s*([A-ZÑÁÉÍÓÚa-zñáéíóú0-9.\-\s]{3,50})/i)
    if (m) return m[1].trim().replace(/\s+/g, ' ')
  }
  return null
}

function leerEnVoz(texto: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'es-ES'
    u.rate = 1.05
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch { /* silencio */ }
}

// =============================================================
// COMPONENTE PRINCIPAL
// =============================================================

export interface AsistenteVozProps {
  /** Si se pasa, abre el panel inicialmente y pre-rellena el comando. */
  abrirCon?: string
  /** Si true, no muestra el FAB flotante (lo controla el padre). */
  ocultarFab?: boolean
  /** Estado controlado del panel desde el padre. */
  abierto?: boolean
  onAbrirChange?: (v: boolean) => void
}

export default function AsistenteVoz({
  abrirCon,
  ocultarFab,
  abierto: abiertoProp,
  onAbrirChange,
}: AsistenteVozProps = {}) {
  const router = useRouter()
  const [abiertoInterno, setAbiertoInterno] = useState(false)
  const abierto = abiertoProp ?? abiertoInterno
  const setAbierto = (v: boolean) => {
    setAbiertoInterno(v)
    onAbrirChange?.(v)
  }
  const [escuchando, setEscuchando] = useState(false)
  const [transcripcion, setTranscripcion] = useState('')
  const [historial, setHistorial] = useState<MensajeLog[]>([])
  const [procesando, setProcesando] = useState(false)
  const [textoManual, setTextoManual] = useState(abrirCon ?? '')
  const [diccionario, setDiccionario] = useState<DiccionarioAsistente | null>(null)
  const [cargandoDic, setCargandoDic] = useState(false)
  const [progresoOCR, setProgresoOCR] = useState<number | null>(null)
  const [presupuestoActivo, setPresupuestoActivo] = useState<{ id: string; numero: string; cliente_id: string } | null>(null)
  const [vozRespuesta, setVozRespuesta] = useState<boolean>(true)
  const idRef = useRef(0)
  const srRef = useRef<SpeechRecognitionLike | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function pushLog(m: Omit<MensajeLog, 'id'>) {
    setHistorial((prev) => [...prev, { ...m, id: ++idRef.current }])
  }

  // Inicializar SR
  useEffect(() => {
    const sr = obtenerSR()
    if (!sr) return
    sr.continuous = false
    sr.interimResults = true
    sr.lang = 'es-ES'
    srRef.current = sr
  }, [])

  // Cargar diccionario al abrir
  useEffect(() => {
    if (!abierto || diccionario || cargandoDic) return
    setCargandoDic(true)
    construirDiccionario()
      .then((d) => setDiccionario(d))
      .catch((e) => pushLog({ tipo: 'error', texto: `Error cargando diccionario: ${e?.message ?? e}` }))
      .finally(() => setCargandoDic(false))
  }, [abierto, diccionario, cargandoDic])

  // Auto-ejecutar si nos abrieron con un comando
  useEffect(() => {
    if (abrirCon && diccionario) {
      ejecutar(abrirCon)
      // limpia para no re-ejecutar
      setTextoManual('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirCon, diccionario])

  const arrancar = useCallback(() => {
    const sr = srRef.current
    if (!sr) {
      pushLog({ tipo: 'error', texto: 'Tu navegador no soporta voz. Escribe el comando o usa Chrome/Edge.' })
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
    sr.onend = () => setEscuchando(false)
    sr.start()
  }, [])

  const parar = useCallback(() => {
    srRef.current?.stop()
    setEscuchando(false)
  }, [])

  async function ejecutar(textoComando: string) {
    if (!textoComando.trim()) return
    if (!diccionario) {
      pushLog({ tipo: 'error', texto: 'Espera que cargue el diccionario…' })
      return
    }
    setProcesando(true)
    pushLog({ tipo: 'usuario', texto: textoComando })
    try {
      const intencion = parsearComandoVoz(textoComando, diccionario)
      for (const r of intencion.resueltos) pushLog({ tipo: 'asistente', texto: `✓ ${r}` })
      for (const w of intencion.warnings) pushLog({ tipo: 'asistente', texto: `⚠ ${w}` })

      switch (intencion.tipo) {
        case 'crear_presupuesto':
          await ejecutarCrearPresupuesto(intencion, pushLog, router, setPresupuestoActivo, vozRespuesta, setDiccionario)
          break
        case 'anadir_linea':
          await ejecutarAnadirLinea(intencion, pushLog, presupuestoActivo, vozRespuesta)
          break
        case 'simular_fecha':
          pushLog({ tipo: 'asistente', texto: 'Usa el boton "Recomendar fecha" en /presupuestos/[id] o /pedidos/[id]. Lo conecto al asistente proximamente.' })
          break
        case 'listar_urgentes':
          await ejecutarListarUrgentes(pushLog, vozRespuesta)
          break
        case 'proponer_reorganizacion':
          pushLog({ tipo: 'asistente', texto: 'Reorganizar pedidos: planificador + drag&drop. La reorganizacion automatica llega en proxima iteracion.' })
          break
        case 'cancelar':
          pushLog({ tipo: 'ok', texto: 'Cancelado.' })
          setPresupuestoActivo(null)
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

  // -------------------------------------------------------------
  // OCR de imagen — con pre-procesado y multi-linea
  // -------------------------------------------------------------
  async function procesarFoto(file: File) {
    setProgresoOCR(0)
    pushLog({ tipo: 'asistente', texto: `Leyendo foto "${file.name}" con OCR…` })
    try {
      // 1) Pre-procesar imagen: redimensionar a max 2000px y aumentar contraste
      const blobProcesado = await preprocesarImagen(file).catch(() => file)

      const Tesseract = await import('tesseract.js')
      const result = await Tesseract.recognize(blobProcesado as any, 'spa', {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setProgresoOCR(Math.round(m.progress * 100))
          }
        },
      })
      const textoExtraido = (result.data.text || '').trim()
      setProgresoOCR(null)
      if (!textoExtraido) {
        pushLog({ tipo: 'error', texto: 'No detecte texto en la foto.' })
        return
      }
      pushLog({ tipo: 'asistente', texto: 'Texto reconocido:', detalle: textoExtraido })

      // 2) Detectar cabecera con cliente y aplicar a todas las lineas
      const clienteCabecera = detectarClienteEnCabecera(textoExtraido)
      const prefijoCliente = clienteCabecera ? `Para ${clienteCabecera}, ` : ''

      // 3) Partir en lineas y procesar cada una como comando independiente
      const lineas = textoExtraido
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 4 && /[a-zñáéíóú0-9]/i.test(s))
        // Excluir lineas que son solo cabecera/footer ruido
        .filter((s) => !/^(cliente|fecha|telefono|teléfono|n\.?\s*pedido|total|pagado|firma)\s*:?\s*$/i.test(s))

      if (lineas.length === 0) {
        pushLog({ tipo: 'error', texto: 'OCR no encontro lineas utiles.' })
        return
      }

      let primeraLinea = true
      for (const linea of lineas) {
        // Saltar la linea de cabecera del cliente (ya la usamos como prefijo)
        if (clienteCabecera && linea.toUpperCase().includes(clienteCabecera.toUpperCase())) continue
        // Construir comando: primera linea crea presupuesto, resto añade
        const comando = primeraLinea
          ? `${prefijoCliente}${linea}`
          : `Anade ${linea}`
        await ejecutar(comando)
        primeraLinea = false
      }
    } catch (e: any) {
      setProgresoOCR(null)
      pushLog({ tipo: 'error', texto: `OCR fallo: ${e?.message ?? e}` })
    }
  }

  return (
    <>
      {!ocultarFab && (
        <button
          type="button"
          aria-label="Abrir asistente"
          onClick={() => setAbierto(!abierto)}
          className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 ${
            abierto ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-blue-500/30'
          }`}
        >
          {abierto ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        </button>
      )}

      {abierto && (
        <div className="fixed bottom-24 right-6 z-40 w-[26rem] max-w-[calc(100vw-3rem)] rounded-xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="font-semibold text-slate-900 flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600" />
                Asistente TURIVAL
              </div>
              <div className="text-[11px] text-slate-500">
                voz + texto + foto · sin IA · gratis
                {cargandoDic && <span className="ml-1 text-amber-600">(cargando diccionario…)</span>}
                {diccionario && !cargandoDic && (
                  <span className="ml-1 text-emerald-600">
                    ({diccionario.clientes.length}c · {diccionario.materiales.length}m · {diccionario.referencias.length}ref)
                  </span>
                )}
                {presupuestoActivo && (
                  <span className="ml-1 text-blue-700 font-semibold">· activo: {presupuestoActivo.numero}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setVozRespuesta((v) => !v)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${vozRespuesta ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                title={vozRespuesta ? 'Voz activada' : 'Voz desactivada'}
              >
                {vozRespuesta ? '🔊' : '🔇'}
              </button>
              <button type="button" onClick={() => setAbierto(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm">
            {historial.length === 0 && (
              <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold mb-1">Ejemplos:</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li><em>"Presupuesto para TURMALINA, puerta cocina 60×80, RAL 9003, doble fondeado"</em></li>
                  <li><em>"Para MAGAMA, puerta cocina"</em> (si tiene la pieza guardada como referencia)</li>
                  <li><em>"Anade tres zocalos 30 metros lineales lacado RAL 9010"</em></li>
                  <li><em>"Muestrame pedidos urgentes"</em></li>
                </ul>
                <p className="mt-2 text-[11px] text-slate-500">Sube una foto de hoja de pedido para que la lea con OCR.</p>
              </div>
            )}
            {historial.map((m) => (
              <div key={m.id} className={`rounded-md px-3 py-2 ${
                m.tipo === 'usuario'   ? 'bg-blue-50 border border-blue-100 text-blue-900' :
                m.tipo === 'error'     ? 'bg-red-50 border border-red-200 text-red-900' :
                m.tipo === 'ok'        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' :
                'bg-slate-50 border border-slate-200 text-slate-700'
              }`}>
                {m.tipo === 'error' && <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />}
                {m.tipo === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />}
                <span className="whitespace-pre-wrap">{m.texto}</span>
                {m.detalle && <div className="mt-1 text-xs opacity-80 whitespace-pre-wrap">{m.detalle}</div>}
                {m.href && (
                  <button type="button" onClick={() => router.push(m.href!)} className="mt-1 text-xs text-blue-700 underline">
                    Abrir →
                  </button>
                )}
                {m.acciones && m.acciones.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.acciones.map((a, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => a.onClick()}
                        className={`text-[11px] px-2 py-1 rounded border ${
                          a.estilo === 'primario'
                            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {procesando && !progresoOCR && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Procesando…
              </div>
            )}
            {progresoOCR !== null && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                OCR {progresoOCR}%
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
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                title="Subir foto de hoja de pedido (OCR)"
                disabled={procesando}
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) procesarFoto(f)
                  e.target.value = ''
                }}
              />
              <input
                type="text"
                value={textoManual}
                onChange={(e) => setTextoManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') enviar() }}
                placeholder="Escribe el comando o pulsa el micro/foto…"
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
// EJECUTORES
// =============================================================

async function ejecutarCrearPresupuesto(
  intencion: IntencionDetectada,
  pushLog: (m: Omit<MensajeLog, 'id'>) => void,
  router: ReturnType<typeof useRouter>,
  setPresupuestoActivo: (p: { id: string; numero: string; cliente_id: string } | null) => void,
  vozRespuesta: boolean,
  setDiccionario: (d: DiccionarioAsistente | null) => void,
) {
  const lineas = intencion.lineas ?? []
  if (lineas.length === 0) {
    pushLog({ tipo: 'error', texto: 'No detecte ninguna pieza.' })
    return
  }

  // Si no hay cliente, ofrecer crearlo al vuelo
  if (!intencion.cliente) {
    const nombreCandidato = intencion.texto_original.match(/para\s+([A-ZÑÁÉÍÓÚa-zñáéíóú0-9.\-\s]{3,40})(?:[,.]|$)/i)?.[1]?.trim()
    const accionesCrear: MensajeLog['acciones'] = []
    if (nombreCandidato) {
      accionesCrear.push({
        label: `Crear cliente "${nombreCandidato}"`,
        estilo: 'primario',
        onClick: async () => {
          const cliente_id = await crearClienteRapido(nombreCandidato, pushLog)
          if (cliente_id) {
            invalidarDiccionario()
            const dic = await construirDiccionario(true)
            setDiccionario(dic)
            // Re-ejecutar el comando original ahora que el cliente existe
            const nueva: IntencionDetectada = {
              ...intencion,
              cliente: {
                id: cliente_id,
                razon_social: nombreCandidato.toUpperCase(),
                nombre_comercial: nombreCandidato.toUpperCase(),
                alias: [],
              } as any,
            }
            await ejecutarCrearPresupuesto(nueva, pushLog, router, setPresupuestoActivo, vozRespuesta, setDiccionario)
          }
        },
      })
    }
    pushLog({
      tipo: 'error',
      texto: `No encuentro al cliente. ${nombreCandidato ? `¿Lo creo como "${nombreCandidato}"?` : 'Di "para CLIENTE_X" o "cliente varios".'}`,
      acciones: accionesCrear.length > 0 ? accionesCrear : undefined,
    })
    return
  }

  const lineasInput: any[] = lineas.map((l, i) => construirLineaPresupuesto(l, i))
  const lineasPendientes = lineas.filter((l) => l.pendiente).length

  const res = await crearPresupuestoV2({
    cliente_id: intencion.cliente.id,
    lineas: lineasInput,
    observaciones_internas: lineasPendientes > 0
      ? `[Asistente] ${lineasPendientes} linea(s) pendiente(s) de revisar. Origen: "${intencion.texto_original.slice(0, 200)}"`
      : `[Asistente] Origen: "${intencion.texto_original.slice(0, 200)}"`,
  })

  setPresupuestoActivo({ id: res.presupuesto_id, numero: res.numero, cliente_id: intencion.cliente.id })

  // Acciones contextuales: guardar como referencia recurrente
  const accionesPost: MensajeLog['acciones'] = []
  for (const linea of lineas) {
    if (!linea.pendiente && linea.categoria && (linea.ancho_mm || linea.longitud_ml) && !linea.referencia) {
      accionesPost.push({
        label: `Guardar "${linea.descripcion.slice(0, 30)}…" como referencia recurrente`,
        onClick: async () => guardarComoReferencia(intencion.cliente!.id, linea, pushLog),
      })
      break // máximo 1 sugerencia por commit
    }
  }

  const textoOk = `Presupuesto ${res.numero} creado para ${intencion.cliente.razon_social ?? intencion.cliente.nombre_comercial}, ${res.lineas_creadas} ${res.lineas_creadas === 1 ? 'linea' : 'lineas'}, total ${res.total.toFixed(2)} euros`
  pushLog({
    tipo: 'ok',
    texto: `Presupuesto ${res.numero} creado (${intencion.cliente.razon_social ?? intencion.cliente.nombre_comercial})`,
    detalle: `${res.lineas_creadas} linea(s) · ${res.total.toFixed(2)} €${lineasPendientes > 0 ? ` · ⚠ ${lineasPendientes} pendiente(s)` : ''}\nDi "anade …" para añadir mas lineas a este presupuesto.`,
    href: `/presupuestos/${res.presupuesto_id}`,
    acciones: accionesPost.length > 0 ? accionesPost : undefined,
  })
  if (vozRespuesta) leerEnVoz(textoOk)
  router.refresh()
}

async function ejecutarAnadirLinea(
  intencion: IntencionDetectada,
  pushLog: (m: Omit<MensajeLog, 'id'>) => void,
  presupuestoActivo: { id: string; numero: string; cliente_id: string } | null,
  vozRespuesta: boolean,
) {
  if (!presupuestoActivo) {
    pushLog({ tipo: 'error', texto: 'Primero crea un presupuesto. "Añade linea" anade al ultimo presupuesto creado en esta sesion.' })
    return
  }
  const lineas = intencion.lineas ?? []
  if (lineas.length === 0) {
    pushLog({ tipo: 'error', texto: 'No detecte la linea a anadir.' })
    return
  }

  // Insert directo a lineas_presupuesto y actualizar totales
  const supabase = createClient()
  // Obtener orden maximo actual
  const { data: existentes } = await supabase
    .from('lineas_presupuesto')
    .select('orden, total_linea')
    .eq('presupuesto_id', presupuestoActivo.id)
  const ordenMax = (existentes ?? []).reduce((m: number, l: any) => Math.max(m, Number(l.orden ?? 0)), 0)

  let totalAnadido = 0
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]
    const insert: any = {
      presupuesto_id: presupuestoActivo.id,
      orden: ordenMax + i + 1,
      cantidad: l.cantidad,
      descripcion: l.descripcion,
      modo_precio: l.modo_precio ?? 'm2',
      ancho: l.ancho_mm ?? null,
      alto: l.alto_mm ?? null,
      grosor: l.grosor_mm ?? null,
      longitud_ml: l.longitud_ml ?? null,
      categoria_pieza_id: l.categoria?.id ?? null,
      material_lacado_id: l.material_lacado?.id ?? null,
      material_fondo_id: l.material_fondo?.id ?? null,
      procesos_codigos: l.procesos,
      precio_unitario: 0,
      total_linea: 0,
      cara_frontal: true,
    }
    const { error } = await supabase.from('lineas_presupuesto').insert(insert)
    if (error) {
      pushLog({ tipo: 'error', texto: `Error anadiendo linea: ${error.message}` })
      return
    }
  }

  pushLog({
    tipo: 'ok',
    texto: `Anadidas ${lineas.length} linea(s) al presupuesto ${presupuestoActivo.numero}`,
    detalle: `Repasa precios en /presupuestos/${presupuestoActivo.id}`,
    href: `/presupuestos/${presupuestoActivo.id}`,
  })
  if (vozRespuesta) leerEnVoz(`Anadidas ${lineas.length} lineas al presupuesto ${presupuestoActivo.numero}`)
}

async function crearClienteRapido(
  nombre: string,
  pushLog: (m: Omit<MensajeLog, 'id'>) => void,
): Promise<string | null> {
  const supabase = createClient()
  const nombreUpper = nombre.toUpperCase().trim()
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      razon_social: nombreUpper,
      nombre_comercial: nombreUpper,
    })
    .select('id')
    .single()
  if (error || !data) {
    pushLog({ tipo: 'error', texto: `No pude crear el cliente: ${error?.message ?? 'error'}` })
    return null
  }
  pushLog({ tipo: 'ok', texto: `Cliente "${nombreUpper}" creado.` })
  return data.id
}

async function guardarComoReferencia(
  cliente_id: string,
  linea: LineaDictada,
  pushLog: (m: Omit<MensajeLog, 'id'>) => void,
) {
  const supabase = createClient()
  // Codigo derivado: {CATEGORIA}-{ANCHO}x{ALTO} o aleatorio
  const cat = (linea.categoria?.nombre ?? 'PIEZA').toUpperCase().replace(/\s+/g, '-').slice(0, 20)
  const dim = linea.ancho_mm && linea.alto_mm
    ? `${linea.ancho_mm}x${linea.alto_mm}`
    : linea.longitud_ml
      ? `${linea.longitud_ml}ML`
      : Math.floor(Math.random() * 9999).toString()
  const codigo = `${cat}-${dim}`

  const { error } = await supabase.from('referencias_cliente').insert({
    cliente_id,
    referencia_cliente: codigo,
    nombre_pieza: linea.descripcion,
    descripcion: `Auto-creada por asistente. ${linea.descripcion}`,
    modo_precio: linea.modo_precio ?? 'm2',
    ancho: linea.ancho_mm ?? null,
    alto: linea.alto_mm ?? null,
    grosor: linea.grosor_mm ?? null,
    longitud_ml: linea.longitud_ml ?? null,
    categoria_pieza_id: linea.categoria?.id ?? null,
    material_lacado_id: linea.material_lacado?.id ?? null,
    material_fondo_id: linea.material_fondo?.id ?? null,
    cara_frontal: true,
    procesos: linea.procesos.map((c, i) => ({ proceso_codigo: c, orden: i })),
    factor_complejidad: 'media',
    descuento_porcentaje: 0,
    activo: true,
  })
  if (error) {
    pushLog({ tipo: 'error', texto: `No pude guardar la referencia: ${error.message}` })
    return
  }
  invalidarDiccionario()
  pushLog({ tipo: 'ok', texto: `Referencia "${codigo}" guardada. La proxima vez que este cliente la pida, el OCR la detectara.` })
}

function construirLineaPresupuesto(l: LineaDictada, i: number): any {
  // Si la linea apunta a una referencia recurrente, usar tipo='referencia'.
  if (l.referencia) {
    return {
      tipo: 'referencia',
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      orden: i,
      referencia: { id: l.referencia.id, cliente_id: l.referencia.cliente_id } as any,
      // El service crea la referencia desde su id reload; no necesita el resto.
    }
  }

  // Si esta pendiente y no tiene categoria/dimensiones, creamos linea manual
  // de 0€ para que Mario la complete. Asi no se rompe el flujo.
  if (l.pendiente) {
    return {
      tipo: 'manual',
      descripcion: l.descripcion + ' · PENDIENTE REVISAR',
      cantidad: l.cantidad,
      orden: i,
      precio_unitario_manual: 0,
    }
  }

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
      categoria_pieza_id: l.categoria?.id ?? null,
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
      material_lacado_id: l.material_lacado?.id ?? null,
      material_fondo_id: l.material_fondo?.id ?? null,
      factor_complejidad: 'media' as const,
      descuento_porcentaje: 0,
      precio_aproximado: false,
      procesos,
    },
  }
}

async function ejecutarListarUrgentes(
  pushLog: (m: Omit<MensajeLog, 'id'>) => void,
  vozRespuesta: boolean,
) {
  const { accionPedidosFechaSinReservar } = await import('@/lib/actions/simulador-entrega')
  const res = await accionPedidosFechaSinReservar()
  if (!res.ok) { pushLog({ tipo: 'error', texto: `No pude consultar: ${res.error}` }); return }
  if (res.items.length === 0) {
    pushLog({ tipo: 'ok', texto: 'No hay pedidos con fecha sin reservar. Todo bajo control.' })
    if (vozRespuesta) leerEnVoz('No hay pedidos urgentes. Todo bajo control.')
    return
  }
  pushLog({
    tipo: 'asistente',
    texto: `Hay ${res.items.length} pedido(s) con fecha sin reservar:`,
    detalle: res.items.slice(0, 6).map((p) => `${p.numero} · ${p.cliente_nombre} · ${new Date(p.fecha_entrega_estimada).toLocaleDateString('es-ES')}`).join('\n'),
    href: '/planificador',
  })
  if (vozRespuesta) leerEnVoz(`Hay ${res.items.length} pedidos con fecha sin reservar`)
}
