'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  FileText,
  Printer,
  Mail,
  MessageCircle,
  ArrowLeft,
  Pencil,
  Trash2,
  Square,
  Minus,
  Shapes,
  RectangleHorizontal,
  Link as LinkIcon,
  Copy,
} from 'lucide-react'
import VisualizacionPiezaSVG from './visualizacion-pieza-svg'

type Cliente = {
  id: string
  nombre_comercial: string
  razon_social: string | null
  cif_nif: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  codigo_postal: string | null
  ciudad: string | null
  provincia: string | null
  persona_contacto: string | null
}

type Presupuesto = {
  id: string
  numero: string
  fecha: string
  estado: 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'caducado'
  cliente_id: string
  validez_dias: number
  fecha_entrega_estimada: string | null
  observaciones_comerciales: string | null
  observaciones_internas: string | null
  subtotal: number
  descuento_porcentaje: number
  descuento_importe: number
  base_imponible: number
  iva_porcentaje: number
  iva_importe: number
  total: number
  share_token: string | null
  created_at: string
  cliente: Cliente | null
}

type Linea = {
  id: string
  orden: number
  descripcion: string
  cantidad: number
  tipo_pieza: 'tablero' | 'frente' | 'moldura' | 'irregular' | null
  modo_precio: 'm2' | 'pieza' | 'metro_lineal'
  ancho: number | null
  alto: number | null
  grosor: number | null
  longitud_ml: number | null
  cara_frontal: boolean
  cara_trasera: boolean
  canto_superior: boolean
  canto_inferior: boolean
  canto_izquierdo: boolean
  canto_derecho: boolean
  superficie_m2: number | null
  precio_unitario: number | null
  total_linea: number
  suplemento_manual: number
  color_id: string | null
  tratamiento_id: string | null
}

const ESTADOS: Record<Presupuesto['estado'], { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  aceptado: { label: 'Aceptado', color: 'bg-green-100 text-green-800 border-green-300' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800 border-red-300' },
  caducado: { label: 'Caducado', color: 'bg-amber-100 text-amber-800 border-amber-300' },
}

const TIPO_PIEZA_ICONS = {
  tablero: Square,
  frente: RectangleHorizontal,
  moldura: Minus,
  irregular: Shapes,
}

const euro = (n: number) =>
  Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

function fechaES(isoDate: string) {
  try {
    return new Date(isoDate).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return isoDate
  }
}

function fechaValidez(fecha: string, dias: number): string {
  try {
    const d = new Date(fecha)
    d.setDate(d.getDate() + dias)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export default function VistaPresupuestoCliente({
  presupuestoInicial,
  lineasIniciales,
}: {
  presupuestoInicial: Presupuesto
  lineasIniciales: Linea[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [presupuesto, setPresupuesto] = useState<Presupuesto>(presupuestoInicial)
  const [lineas] = useState<Linea[]>(lineasIniciales)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(
    null
  )

  const cliente = presupuesto.cliente

  // URL pública para el cliente (con share_token)
  const urlPublica =
    typeof window !== 'undefined' && presupuesto.share_token
      ? `${window.location.origin}/p/${presupuesto.share_token}`
      : null

  async function cambiarEstado(nuevoEstado: Presupuesto['estado']) {
    setCambiandoEstado(true)
    setMensaje(null)
    try {
      const { error } = await supabase
        .from('presupuestos')
        .update({ estado: nuevoEstado })
        .eq('id', presupuesto.id)
      if (error) throw error
      setPresupuesto({ ...presupuesto, estado: nuevoEstado })
      setMensaje({ tipo: 'ok', texto: `Estado cambiado a "${ESTADOS[nuevoEstado].label}"` })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setCambiandoEstado(false)
      setTimeout(() => setMensaje(null), 4000)
    }
  }

  async function eliminarPresupuesto() {
    if (
      !confirm(
        `¿Seguro que quieres eliminar el presupuesto ${presupuesto.numero}? Esta acción no se puede deshacer.`
      )
    ) {
      return
    }
    setEliminando(true)
    try {
      await supabase
        .from('lineas_presupuesto')
        .delete()
        .eq('presupuesto_id', presupuesto.id)
      const { error } = await supabase
        .from('presupuestos')
        .delete()
        .eq('id', presupuesto.id)
      if (error) throw error
      router.push('/presupuestos')
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message })
      setEliminando(false)
    }
  }

  function abrirImprimible() {
    // Versión interna (auth) para Mario
    window.open(`/presupuestos/${presupuesto.id}/imprimir`, '_blank')
  }

  function copiarLinkPublico() {
    if (!urlPublica) return
    navigator.clipboard.writeText(urlPublica)
    setMensaje({ tipo: 'ok', texto: 'Enlace copiado al portapapeles.' })
  }

  function enviarWhatsApp() {
    if (!cliente?.telefono) {
      setMensaje({ tipo: 'error', texto: 'El cliente no tiene teléfono registrado.' })
      return
    }
    if (!urlPublica) {
      setMensaje({
        tipo: 'error',
        texto: 'Este presupuesto no tiene enlace público. Refresca la página.',
      })
      return
    }
    const tel = cliente.telefono.replace(/[^0-9]/g, '')
    const mensaje = encodeURIComponent(
      `Hola ${cliente.nombre_comercial},\n\nTe envío el presupuesto ${presupuesto.numero} por un importe de ${euro(presupuesto.total)}.\n\nPuedes consultarlo aquí:\n${urlPublica}\n\nGracias,`
    )
    window.open(`https://wa.me/${tel}?text=${mensaje}`, '_blank')
  }

  function enviarEmail() {
    if (!cliente?.email) {
      setMensaje({ tipo: 'error', texto: 'El cliente no tiene email registrado.' })
      return
    }
    if (!urlPublica) {
      setMensaje({
        tipo: 'error',
        texto: 'Este presupuesto no tiene enlace público. Refresca la página.',
      })
      return
    }
    const asunto = encodeURIComponent(`Presupuesto ${presupuesto.numero}`)
    const cuerpo = encodeURIComponent(
      `Hola ${cliente.nombre_comercial},

Te envío el presupuesto ${presupuesto.numero} por un importe de ${euro(presupuesto.total)}.

Puedes consultarlo aquí:
${urlPublica}

Tiene una validez de ${presupuesto.validez_dias} días desde la fecha de emisión.

Quedamos a tu disposición para cualquier aclaración.

Un saludo,`
    )
    window.location.href = `mailto:${cliente.email}?subject=${asunto}&body=${cuerpo}`
  }

  const estadoInfo = ESTADOS[presupuesto.estado]

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/presupuestos')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
              <FileText className="w-8 h-8" />
              {presupuesto.numero}
              <Badge className={`text-xs border ${estadoInfo.color}`}>
                {estadoInfo.label}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">
              {fechaES(presupuesto.fecha)} · Válido hasta{' '}
              {fechaValidez(presupuesto.fecha, presupuesto.validez_dias)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={abrirImprimible}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / PDF
          </Button>
          <Button variant="outline" onClick={enviarWhatsApp}>
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>
          <Button variant="outline" onClick={enviarEmail}>
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
        </div>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      {/* LINK PÚBLICO PARA COMPARTIR */}
      {urlPublica && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="flex items-center gap-3 py-4 flex-wrap">
            <LinkIcon className="w-4 h-4 text-blue-700 shrink-0" />
            <div className="flex-1 min-w-60">
              <div className="text-xs font-semibold text-blue-900 mb-0.5">
                Enlace público para el cliente (sin login)
              </div>
              <div className="text-xs text-blue-800 font-mono truncate">
                {urlPublica}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={copiarLinkPublico}
              className="bg-white"
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              Copiar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ACCIONES DE ESTADO */}
      <Card>
        <CardContent className="flex items-center gap-3 flex-wrap py-4">
          <div className="flex-1 min-w-40">
            <div className="text-xs font-medium text-slate-700 mb-1">
              Estado del presupuesto
            </div>
            <Select
              value={presupuesto.estado}
              onValueChange={(v: Presupuesto['estado']) => cambiarEstado(v)}
              disabled={cambiandoEstado}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADOS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={eliminarPresupuesto}
              disabled={eliminando}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Eliminar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CLIENTE */}
      {cliente && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-semibold text-lg">{cliente.nombre_comercial}</div>
                {cliente.razon_social && (
                  <div className="text-sm text-muted-foreground">
                    {cliente.razon_social}
                  </div>
                )}
                {cliente.cif_nif && (
                  <div className="text-sm text-muted-foreground">
                    CIF/NIF: {cliente.cif_nif}
                  </div>
                )}
              </div>
              <div className="text-sm space-y-0.5">
                {cliente.persona_contacto && (
                  <div>
                    <span className="text-muted-foreground">Contacto:</span>{' '}
                    {cliente.persona_contacto}
                  </div>
                )}
                {cliente.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span> {cliente.email}
                  </div>
                )}
                {cliente.telefono && (
                  <div>
                    <span className="text-muted-foreground">Teléfono:</span>{' '}
                    {cliente.telefono}
                  </div>
                )}
                {(cliente.direccion || cliente.ciudad) && (
                  <div>
                    <span className="text-muted-foreground">Dirección:</span>{' '}
                    {[
                      cliente.direccion,
                      cliente.codigo_postal,
                      cliente.ciudad,
                      cliente.provincia,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LÍNEAS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Líneas{' '}
            <span className="text-muted-foreground font-normal">
              ({lineas.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineas.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Este presupuesto no tiene líneas.
            </div>
          ) : (
            <div className="space-y-4">
              {lineas.map((l) => {
                const tipo = l.tipo_pieza ?? 'tablero'
                const IconTipo = TIPO_PIEZA_ICONS[tipo]
                return (
                  <div key={l.id} className="border rounded-lg p-4 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <div className="flex items-start gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className="bg-white flex items-center gap-1"
                          >
                            <IconTipo className="w-3 h-3" />
                            {tipo}
                          </Badge>
                          <div className="font-medium flex-1 min-w-40">
                            {l.descripcion}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1">
                          {tipo === 'moldura' ? (
                            <>
                              <div>
                                Longitud:{' '}
                                <strong>
                                  {Number(l.longitud_ml ?? 0).toFixed(2)} m
                                </strong>
                              </div>
                              <div>
                                Perfil:{' '}
                                <strong>
                                  {l.ancho ?? '?'} × {l.grosor ?? '?'} mm
                                </strong>
                              </div>
                            </>
                          ) : tipo === 'irregular' ? (
                            <div className="col-span-full">
                              Pieza irregular — precio pactado
                            </div>
                          ) : (
                            <>
                              <div>
                                Dimensiones:{' '}
                                <strong>
                                  {l.ancho ?? 0} × {l.alto ?? 0} × {l.grosor ?? 0} mm
                                </strong>
                              </div>
                              <div>
                                Superficie:{' '}
                                <strong>
                                  {Number(l.superficie_m2 ?? 0).toFixed(3)} m²
                                </strong>
                              </div>
                              <div className="col-span-2">
                                Caras lacadas:{' '}
                                <strong>
                                  {[
                                    l.cara_frontal && 'Frontal',
                                    l.cara_trasera && 'Trasera',
                                    l.canto_superior && 'Canto sup.',
                                    l.canto_inferior && 'Canto inf.',
                                    l.canto_izquierdo && 'Canto izq.',
                                    l.canto_derecho && 'Canto der.',
                                  ]
                                    .filter(Boolean)
                                    .join(', ') || 'ninguna'}
                                </strong>
                              </div>
                            </>
                          )}
                          <div>
                            Modo:{' '}
                            <strong>
                              {l.modo_precio === 'm2'
                                ? 'por m²'
                                : l.modo_precio === 'pieza'
                                ? 'por pieza'
                                : 'por m.l.'}
                            </strong>
                          </div>
                          <div>
                            Cantidad: <strong>{l.cantidad}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pt-1 text-sm">
                          <span className="text-muted-foreground">Precio/ud:</span>
                          <span className="font-medium">
                            {euro(Number(l.precio_unitario ?? 0))}
                          </span>
                          {Number(l.suplemento_manual) > 0 && (
                            <>
                              <span className="text-muted-foreground">+ Suplemento:</span>
                              <span className="font-medium">
                                {euro(Number(l.suplemento_manual))}
                              </span>
                            </>
                          )}
                          <span className="ml-auto text-lg font-bold text-blue-700">
                            {euro(Number(l.total_linea))}
                          </span>
                        </div>
                      </div>

                      <div className="md:col-span-1">
                        <VisualizacionPiezaSVG
                          datos={{
                            tipo_pieza: tipo,
                            ancho: Number(l.ancho ?? 0),
                            alto: Number(l.alto ?? 0),
                            grosor: Number(l.grosor ?? 0),
                            longitud_ml: Number(l.longitud_ml ?? 0),
                            cara_frontal: l.cara_frontal,
                            cara_trasera: l.cara_trasera,
                            canto_superior: l.canto_superior,
                            canto_inferior: l.canto_inferior,
                            canto_izquierdo: l.canto_izquierdo,
                            canto_derecho: l.canto_derecho,
                            color_hex: null,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* TOTALES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md ml-auto space-y-1 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">
                {euro(Number(presupuesto.subtotal))}
              </span>
            </div>
            {Number(presupuesto.descuento_porcentaje) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">
                  Descuento ({presupuesto.descuento_porcentaje}%)
                </span>
                <span className="font-medium text-red-600">
                  −{euro(Number(presupuesto.descuento_importe))}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Base imponible</span>
              <span className="font-medium">
                {euro(Number(presupuesto.base_imponible))}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">
                IVA ({presupuesto.iva_porcentaje}%)
              </span>
              <span className="font-medium">
                {euro(Number(presupuesto.iva_importe))}
              </span>
            </div>
            <div className="flex justify-between py-2 border-t mt-2 text-lg">
              <span className="font-bold">TOTAL</span>
              <span className="font-bold text-blue-700">
                {euro(Number(presupuesto.total))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OBSERVACIONES */}
      {(presupuesto.observaciones_comerciales ||
        presupuesto.observaciones_internas) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {presupuesto.observaciones_comerciales && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Para el cliente
                </div>
                <div className="bg-slate-50 rounded p-3 whitespace-pre-wrap">
                  {presupuesto.observaciones_comerciales}
                </div>
              </div>
            )}
            {presupuesto.observaciones_internas && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Internas (no se imprimen)
                </div>
                <div className="bg-amber-50 rounded p-3 whitespace-pre-wrap">
                  {presupuesto.observaciones_internas}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
