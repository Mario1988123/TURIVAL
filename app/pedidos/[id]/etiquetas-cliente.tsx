'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, Settings2, ArrowLeft, Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

import {
  construirCodigoCompacto,
  urlPublicaPieza,
  type DatosEtiqueta,
} from '@/lib/motor/etiquetas'

export interface EtiquetaPieza extends DatosEtiqueta {}

type TipoCodigo = 'qr' | 'code128' | 'ninguno'

interface Config {
  ancho_mm: number
  alto_mm: number
  columnas: number
  filas: number
  margen_entre_mm: number
  margen_pagina_mm: number
  tipo_codigo: TipoCodigo
  preset: string
}

// =============================================================
// Presets de impresora
// =============================================================
// Añadir más aquí es añadir una entrada en este array. El preset
// "custom" deja que Mario ajuste los mm a mano.

interface Preset {
  id: string
  label: string
  ancho_mm: number
  alto_mm: number
  columnas: number
  filas: number
  margen_entre_mm: number
  margen_pagina_mm: number
}

const PRESETS: Preset[] = [
  // Rollo de pegatinas térmicas (Zebra, Godex, etc.)
  { id: 'zebra_100x50',  label: 'Zebra 100×50 (rollo)',   ancho_mm: 100, alto_mm: 50, columnas: 1, filas: 10, margen_entre_mm: 2, margen_pagina_mm: 2 },
  { id: 'zebra_80x60',   label: 'Zebra 80×60 (rollo)',    ancho_mm: 80,  alto_mm: 60, columnas: 1, filas: 10, margen_entre_mm: 2, margen_pagina_mm: 2 },
  { id: 'zebra_70x40',   label: 'Zebra 70×40 (rollo)',    ancho_mm: 70,  alto_mm: 40, columnas: 1, filas: 10, margen_entre_mm: 2, margen_pagina_mm: 2 },
  { id: 'zebra_50x30',   label: 'Zebra 50×30 (rollo)',    ancho_mm: 50,  alto_mm: 30, columnas: 1, filas: 10, margen_entre_mm: 2, margen_pagina_mm: 2 },
  // Dymo LabelWriter
  { id: 'dymo_89x36',    label: 'Dymo 89×36 (rollo)',     ancho_mm: 89,  alto_mm: 36, columnas: 1, filas: 10, margen_entre_mm: 1, margen_pagina_mm: 1 },
  { id: 'dymo_54x25',    label: 'Dymo 54×25 (rollo)',     ancho_mm: 54,  alto_mm: 25, columnas: 1, filas: 10, margen_entre_mm: 1, margen_pagina_mm: 1 },
  // Brother QL
  { id: 'brother_62x29', label: 'Brother QL 62×29',       ancho_mm: 62,  alto_mm: 29, columnas: 1, filas: 10, margen_entre_mm: 1, margen_pagina_mm: 1 },
  // Custom (ajuste manual)
  { id: 'custom',        label: 'Custom (ajustar a mano)', ancho_mm: 70, alto_mm: 40, columnas: 1, filas: 10, margen_entre_mm: 2, margen_pagina_mm: 2 },
]

const CONFIG_DEFAULT: Config = {
  ancho_mm: 100,
  alto_mm: 50,
  columnas: 1,
  filas: 10,
  margen_entre_mm: 2,
  margen_pagina_mm: 2,
  tipo_codigo: 'qr',
  preset: 'zebra_100x50',
}

const LS_KEY = 'turival:etiquetas:config_v2'

function leerConfig(): Config {
  if (typeof window === 'undefined') return CONFIG_DEFAULT
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return CONFIG_DEFAULT
    const parsed = JSON.parse(raw)
    return {
      ancho_mm: Number(parsed.ancho_mm) || CONFIG_DEFAULT.ancho_mm,
      alto_mm: Number(parsed.alto_mm) || CONFIG_DEFAULT.alto_mm,
      columnas: Number(parsed.columnas) || CONFIG_DEFAULT.columnas,
      filas: Number(parsed.filas) || CONFIG_DEFAULT.filas,
      margen_entre_mm: Number(parsed.margen_entre_mm) ?? CONFIG_DEFAULT.margen_entre_mm,
      margen_pagina_mm: Number(parsed.margen_pagina_mm) ?? CONFIG_DEFAULT.margen_pagina_mm,
      tipo_codigo: (parsed.tipo_codigo === 'code128' || parsed.tipo_codigo === 'ninguno'
        ? parsed.tipo_codigo
        : 'qr') as TipoCodigo,
      preset: typeof parsed.preset === 'string' ? parsed.preset : CONFIG_DEFAULT.preset,
    }
  } catch {
    return CONFIG_DEFAULT
  }
}

function guardarConfig(cfg: Config) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(cfg))
  } catch {
    /* silencio */
  }
}

export default function EtiquetasCliente({
  pedidoNumero,
  clienteNombre,
  piezas,
}: {
  pedidoNumero: string
  clienteNombre: string
  piezas: EtiquetaPieza[]
}) {
  const router = useRouter()
  const [cfg, setCfg] = useState<Config>(CONFIG_DEFAULT)
  const [cargada, setCargada] = useState(false)
  const [renderizando, setRenderizando] = useState(false)

  // Leer config de localStorage una vez en cliente
  useEffect(() => {
    setCfg(leerConfig())
    setCargada(true)
  }, [])

  useEffect(() => {
    if (!cargada) return
    guardarConfig(cfg)
  }, [cfg, cargada])

  // Al elegir un preset, rellenar los mm. Si es "custom" no tocamos
  // los valores actuales (el usuario está ajustando a mano).
  const aplicarPreset = (presetId: string) => {
    const p = PRESETS.find((x) => x.id === presetId)
    if (!p) return
    if (presetId === 'custom') {
      setCfg((c) => ({ ...c, preset: 'custom' }))
      return
    }
    setCfg((c) => ({
      ...c,
      preset: presetId,
      ancho_mm: p.ancho_mm,
      alto_mm: p.alto_mm,
      columnas: p.columnas,
      filas: p.filas,
      margen_entre_mm: p.margen_entre_mm,
      margen_pagina_mm: p.margen_pagina_mm,
    }))
  }

  // Si el usuario toca un input manualmente, cambiamos el preset a "custom"
  // para que sea coherente visualmente.
  const tocarManual = <K extends keyof Config>(campo: K, valor: Config[K]) => {
    setCfg((c) => ({ ...c, [campo]: valor, preset: 'custom' }))
  }

  // Render de códigos (QR/Code128) cliente-side tras cada render o
  // cambio de tipo_codigo.
  const zonaImprimir = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!cargada) return
    if (cfg.tipo_codigo === 'ninguno') return
    let cancelado = false

    async function renderCodigos() {
      setRenderizando(true)
      try {
        const [jsbarcodeMod, qrcodeMod] = await Promise.all([
          cfg.tipo_codigo === 'code128' ? import('jsbarcode') : Promise.resolve(null as any),
          cfg.tipo_codigo === 'qr' ? import('qrcode') : Promise.resolve(null as any),
        ])

        if (cancelado) return
        const root = zonaImprimir.current
        if (!root) return

        const elementos = root.querySelectorAll<HTMLElement>('[data-codigo-target]')
        for (const el of Array.from(elementos)) {
          const valor = el.getAttribute('data-valor') ?? ''
          const url = el.getAttribute('data-url') ?? valor
          if (!valor) continue
          el.innerHTML = ''

          if (cfg.tipo_codigo === 'code128' && jsbarcodeMod) {
            const svg = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'svg'
            )
            el.appendChild(svg)
            try {
              jsbarcodeMod.default(svg, valor, {
                format: 'CODE128',
                displayValue: false,
                margin: 0,
                height: 40,
                width: 1.5,
              })
            } catch {
              el.textContent = valor
            }
          } else if (cfg.tipo_codigo === 'qr' && qrcodeMod) {
            const canvas = document.createElement('canvas')
            el.appendChild(canvas)
            try {
              await qrcodeMod.toCanvas(canvas, url, {
                errorCorrectionLevel: 'M',
                margin: 0,
                width: 120,
              })
            } catch {
              el.textContent = valor
            }
          }
        }
      } finally {
        if (!cancelado) setRenderizando(false)
      }
    }

    renderCodigos()
    return () => {
      cancelado = true
    }
  }, [cfg.tipo_codigo, cargada, piezas])

  const imprimir = () => {
    if (typeof window !== 'undefined') window.print()
  }

  // CSS dinámico de impresión, cambia con la config.
  const cssImpresion = useMemo(() => {
    const {
      ancho_mm, alto_mm, columnas, filas,
      margen_entre_mm, margen_pagina_mm,
    } = cfg
    const anchoPagina = margen_pagina_mm * 2 + columnas * ancho_mm + (columnas - 1) * margen_entre_mm
    const altoPagina  = margen_pagina_mm * 2 + filas * alto_mm + (filas - 1) * margen_entre_mm
    return `
      @page {
        size: ${anchoPagina}mm ${altoPagina}mm;
        margin: 0;
      }
      @media print {
        html, body {
          margin: 0;
          padding: 0;
          background: #fff;
        }
        body > :not(.zona-imprimir) {
          display: none !important;
        }
        .zona-imprimir {
          display: grid !important;
          grid-template-columns: repeat(${columnas}, ${ancho_mm}mm);
          grid-auto-rows: ${alto_mm}mm;
          column-gap: ${margen_entre_mm}mm;
          row-gap: ${margen_entre_mm}mm;
          padding: ${margen_pagina_mm}mm;
          width: ${anchoPagina}mm;
          box-sizing: border-box;
        }
        .etiqueta {
          width: ${ancho_mm}mm;
          height: ${alto_mm}mm;
          page-break-inside: avoid;
          break-inside: avoid;
          border: 0 !important;
        }
        .no-print {
          display: none !important;
        }
      }
    `
  }, [cfg])

  if (!cargada) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando configuración…
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <style dangerouslySetInnerHTML={{ __html: cssImpresion }} />

      <div className="no-print flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Printer className="w-6 h-6" />
            Etiquetas — Pedido {pedidoNumero}
          </h1>
          <p className="text-muted-foreground text-sm">
            Cliente: <strong>{clienteNombre}</strong> · {piezas.length}{' '}
            {piezas.length === 1 ? 'pieza' : 'piezas'}. Elige un preset de
            impresora o ajusta a mano, pulsa <em>Imprimir</em> y el navegador
            abrirá el diálogo con el tamaño exacto.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </Button>
          <Button
            onClick={imprimir}
            disabled={piezas.length === 0 || renderizando}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {renderizando ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Preparando…
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-1" />
                Imprimir
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Configuración de impresión
          </CardTitle>
          <CardDescription>
            Elige un preset o ajusta a mano. La configuración se guarda en
            este navegador para la próxima vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {/* Fila de preset */}
          <div>
            <Label className="text-xs">Preset de impresora</Label>
            <Select value={cfg.preset} onValueChange={aplicarPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Ancho etiqueta (mm)</Label>
              <Input
                type="number" min="10" max="300" step="1"
                value={cfg.ancho_mm}
                onChange={(e) => tocarManual('ancho_mm', Math.max(10, parseFloat(e.target.value) || 10))}
              />
            </div>
            <div>
              <Label className="text-xs">Alto etiqueta (mm)</Label>
              <Input
                type="number" min="10" max="300" step="1"
                value={cfg.alto_mm}
                onChange={(e) => tocarManual('alto_mm', Math.max(10, parseFloat(e.target.value) || 10))}
              />
            </div>
            <div>
              <Label className="text-xs">Columnas</Label>
              <Input
                type="number" min="1" max="12" step="1"
                value={cfg.columnas}
                onChange={(e) => tocarManual('columnas', Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <Label className="text-xs">Filas por hoja/tira</Label>
              <Input
                type="number" min="1" max="50" step="1"
                value={cfg.filas}
                onChange={(e) => tocarManual('filas', Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <Label className="text-xs">Separación (mm)</Label>
              <Input
                type="number" min="0" max="20" step="0.5"
                value={cfg.margen_entre_mm}
                onChange={(e) => tocarManual('margen_entre_mm', Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label className="text-xs">Margen de página (mm)</Label>
              <Input
                type="number" min="0" max="20" step="0.5"
                value={cfg.margen_pagina_mm}
                onChange={(e) => tocarManual('margen_pagina_mm', Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Tipo de código visual</Label>
              <Select
                value={cfg.tipo_codigo}
                onValueChange={(v: TipoCodigo) => setCfg(c => ({ ...c, tipo_codigo: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qr">QR (para móviles y clientes)</SelectItem>
                  <SelectItem value="code128">Code128 (para ordenador central)</SelectItem>
                  <SelectItem value="ninguno">Ninguno (solo texto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {piezas.length === 0 ? (
        <Alert className="no-print">
          <AlertDescription>
            Este pedido no tiene piezas. Confírmalo primero para que se
            generen los números de pieza (PIE-YY-NNNN).
          </AlertDescription>
        </Alert>
      ) : null}

      {/* ZONA DE IMPRESIÓN */}
      <div
        ref={zonaImprimir}
        className="zona-imprimir"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cfg.columnas}, ${cfg.ancho_mm}mm)`,
          gridAutoRows: `${cfg.alto_mm}mm`,
          columnGap: `${cfg.margen_entre_mm}mm`,
          rowGap: `${cfg.margen_entre_mm}mm`,
          padding: `${cfg.margen_pagina_mm}mm`,
        }}
      >
        {piezas.map((p, idx) => (
          <EtiquetaUnica
            key={`${p.pieza_numero}-${idx}`}
            pieza={p}
            tipoCodigo={cfg.tipo_codigo}
            anchoMm={cfg.ancho_mm}
            altoMm={cfg.alto_mm}
          />
        ))}
      </div>
    </div>
  )
}

// =============================================================
// Etiqueta individual
// =============================================================

function EtiquetaUnica({
  pieza,
  tipoCodigo,
  anchoMm,
  altoMm,
}: {
  pieza: EtiquetaPieza
  tipoCodigo: TipoCodigo
  anchoMm: number
  altoMm: number
}) {
  const codigoCompacto = construirCodigoCompacto(pieza)
  const [baseUrl, setBaseUrl] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') setBaseUrl(window.location.origin)
  }, [])
  const urlQr = baseUrl ? urlPublicaPieza(pieza.pieza_numero, baseUrl) : pieza.pieza_numero

  // Tamaño de fuente del nombre del cliente con auto-fit "tonto"
  // en función del largo y del alto disponible.
  const fontClienteMm = useMemo(() => {
    const nombre = pieza.cliente_nombre_comercial || ''
    const anchoChar = anchoMm / Math.max(4, nombre.length)
    const base = Math.min(altoMm * 0.2, anchoChar * 1.6)
    return Math.max(2.5, Math.min(6, base))
  }, [pieza.cliente_nombre_comercial, anchoMm, altoMm])

  // Indicador X/N en la esquina superior derecha
  const indicador =
    pieza.indice_global && pieza.total_piezas && pieza.total_piezas > 0
      ? `${pieza.indice_global}/${pieza.total_piezas}`
      : ''

  return (
    <div
      className="etiqueta"
      style={{
        width: `${anchoMm}mm`,
        height: `${altoMm}mm`,
        border: '1px dashed #cbd5e1',
        boxSizing: 'border-box',
        padding: '1.5mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        background: '#fff',
        color: '#000',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
      }}
    >
      {/* X/N en la esquina superior derecha */}
      {indicador && (
        <div
          style={{
            position: 'absolute',
            top: '1mm',
            right: '1.5mm',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: `${Math.max(2.2, altoMm * 0.08)}mm`,
            fontWeight: 600,
            color: '#555',
          }}
        >
          {indicador}
        </div>
      )}

      {/* Bloque superior: cliente */}
      <div
        style={{
          fontWeight: 700,
          fontSize: `${fontClienteMm}mm`,
          lineHeight: 1.1,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingRight: indicador ? '7mm' : 0,
          paddingLeft: indicador ? '7mm' : 0,
        }}
      >
        {pieza.cliente_nombre_comercial || '—'}
      </div>

      {/* Bloque medio: código compacto */}
      <div
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontWeight: 700,
          fontSize: `${Math.min(altoMm * 0.14, anchoMm * 0.09)}mm`,
          textAlign: 'center',
          letterSpacing: '0.03em',
        }}
      >
        {codigoCompacto}
      </div>

      {/* Bloque código visual (QR o Code128) */}
      {tipoCodigo !== 'ninguno' && (
        <div
          data-codigo-target="1"
          data-valor={pieza.pieza_numero}
          data-url={urlQr}
          style={{
            alignSelf: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '1 1 auto',
            width: '100%',
            maxHeight: `${altoMm * 0.55}mm`,
            minHeight: 0,
          }}
        />
      )}

      {/* Pie: número de pieza */}
      <div
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: `${Math.max(2, altoMm * 0.08)}mm`,
          textAlign: 'center',
          color: '#111',
        }}
      >
        {pieza.pieza_numero}
      </div>
    </div>
  )
}
