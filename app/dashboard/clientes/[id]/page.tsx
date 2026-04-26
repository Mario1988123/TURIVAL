'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { obtenerCliente, obtenerEstadisticasCliente } from '@/lib/services'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft, Edit, Mail, Phone, MapPin, Building, FileText, ShoppingCart,
  Truck, History, Calendar, Euro, ArrowRight, AlertCircle, CheckCircle2, Package,
} from 'lucide-react'
import type { Cliente } from '@/lib/types/erp'
import PiezasRecurrentesSeccion from '@/components/clientes/piezas-recurrentes-seccion'

interface PresupuestoLite {
  id: string; numero: string; fecha: string; estado: string; total: number; share_token: string | null
}
interface PedidoLite {
  id: string; numero: string; fecha_creacion: string; estado: string; total: number; fecha_entrega_estimada: string | null
}
interface AlbaranLite {
  id: string; numero: string; fecha_entrega: string; estado: string; tipo: string; pedido_id: string | null; observaciones: string | null
}

const ESTADO_PRES_BADGE: Record<string, { color: string; label: string }> = {
  borrador:   { color: 'bg-slate-100 text-slate-700', label: 'Borrador' },
  enviado:    { color: 'bg-blue-100 text-blue-800', label: 'Enviado' },
  aceptado:   { color: 'bg-emerald-100 text-emerald-800', label: 'Aceptado' },
  rechazado:  { color: 'bg-red-100 text-red-800', label: 'Rechazado' },
  caducado:   { color: 'bg-amber-100 text-amber-800', label: 'Caducado' },
}
const ESTADO_PED_BADGE: Record<string, { color: string; label: string }> = {
  borrador:      { color: 'bg-slate-100 text-slate-700', label: 'Borrador' },
  confirmado:    { color: 'bg-blue-100 text-blue-800', label: 'Confirmado' },
  en_produccion: { color: 'bg-amber-100 text-amber-800', label: 'En producción' },
  pausado:       { color: 'bg-orange-100 text-orange-800', label: 'Pausado' },
  completado:    { color: 'bg-teal-100 text-teal-800', label: 'Completado' },
  entregado:     { color: 'bg-emerald-100 text-emerald-800', label: 'Entregado' },
  facturado:     { color: 'bg-green-200 text-green-900', label: 'Facturado' },
  cancelado:     { color: 'bg-rose-100 text-rose-800', label: 'Cancelado' },
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '—' }
}
function fmtEur(n: number): string {
  return Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default function ClienteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [presupuestos, setPresupuestos] = useState<PresupuestoLite[]>([])
  const [pedidos, setPedidos] = useState<PedidoLite[]>([])
  const [albaranes, setAlbaranes] = useState<AlbaranLite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAll() {
      const supabase = createClient()
      try {
        const [clienteData, statsData] = await Promise.all([
          obtenerCliente(clienteId),
          obtenerEstadisticasCliente(clienteId),
        ])
        setCliente(clienteData)
        setStats(statsData)

        // Cargar presupuestos, pedidos y albaranes en paralelo
        const [presRes, pedRes, albRes] = await Promise.all([
          supabase.from('presupuestos')
            .select('id, numero, fecha, estado, total, share_token')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase.from('pedidos')
            .select('id, numero, fecha_creacion, estado, total, fecha_entrega_estimada')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase.from('albaranes')
            .select('id, numero, fecha_entrega, estado, tipo, pedido_id, observaciones')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false })
            .limit(50),
        ])
        setPresupuestos((presRes.data ?? []) as PresupuestoLite[])
        setPedidos((pedRes.data ?? []) as PedidoLite[])
        setAlbaranes((albRes.data ?? []) as AlbaranLite[])
      } catch (error) {
        console.error('Error loading cliente:', error)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [clienteId])

  function getTipoLabel(tipo: string) {
    const labels: Record<string, string> = {
      precliente: 'Pre-cliente',
      cliente: 'Cliente',
      cliente_activo: 'Cliente activo',
      cliente_recurrente: 'Cliente recurrente',
    }
    return labels[tipo] || tipo
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-64 bg-muted animate-pulse rounded" />
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button variant="link" onClick={() => router.push('/dashboard/clientes')}>
          Volver a clientes
        </Button>
      </div>
    )
  }

  // === Construir timeline (orden inverso) ===
  type EventoTimeline = {
    fecha: string
    tipo: 'presupuesto' | 'pedido' | 'albaran_entrega' | 'albaran_recepcion'
    titulo: string
    detalle: string
    href: string
    estado: string
    total?: number
    icon: any
    color: string
  }
  const eventos: EventoTimeline[] = []
  for (const p of presupuestos) {
    eventos.push({
      fecha: p.fecha,
      tipo: 'presupuesto',
      titulo: `Presupuesto ${p.numero}`,
      detalle: `Estado: ${ESTADO_PRES_BADGE[p.estado]?.label ?? p.estado}`,
      href: `/presupuestos/${p.id}`,
      estado: p.estado,
      total: Number(p.total),
      icon: FileText,
      color: 'bg-blue-100 text-blue-700',
    })
  }
  for (const p of pedidos) {
    eventos.push({
      fecha: p.fecha_creacion,
      tipo: 'pedido',
      titulo: `Pedido ${p.numero}`,
      detalle: p.fecha_entrega_estimada ? `Entrega prevista: ${fmtFecha(p.fecha_entrega_estimada)}` : 'Sin fecha entrega',
      href: `/pedidos/${p.id}`,
      estado: p.estado,
      total: Number(p.total),
      icon: ShoppingCart,
      color: 'bg-amber-100 text-amber-700',
    })
  }
  for (const a of albaranes) {
    const esRecepcion = a.tipo === 'recepcion'
    eventos.push({
      fecha: a.fecha_entrega,
      tipo: esRecepcion ? 'albaran_recepcion' : 'albaran_entrega',
      titulo: esRecepcion ? `Recepción ${a.numero}` : `Albarán entrega ${a.numero}`,
      detalle: a.observaciones ?? (esRecepcion ? 'Cliente trajo piezas al taller' : 'Entrega de piezas al cliente'),
      href: `/albaranes/${a.id}`,
      estado: a.estado,
      icon: esRecepcion ? Package : Truck,
      color: esRecepcion ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700',
    })
  }
  // Orden cronológico inverso (más reciente arriba)
  eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{cliente.nombre_comercial}</h1>
              <Badge variant="outline">{getTipoLabel(cliente.tipo)}</Badge>
            </div>
            {cliente.razon_social && (
              <p className="text-muted-foreground">{cliente.razon_social}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/presupuestos/nuevo?cliente=${clienteId}`)}>
            <FileText className="h-4 w-4 mr-2" /> Nuevo presupuesto
          </Button>
          <Button onClick={() => router.push(`/dashboard/clientes/${clienteId}/editar`)}>
            <Edit className="h-4 w-4 mr-2" /> Editar
          </Button>
        </div>
      </div>

      {/* Stats — usamos los conteos REALES, no los del service viejo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{presupuestos.length}</div>
            <p className="text-sm text-muted-foreground">Presupuestos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pedidos.length}</div>
            <p className="text-sm text-muted-foreground">Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{albaranes.length}</div>
            <p className="text-sm text-muted-foreground">Albaranes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{fmtEur(stats?.facturacion_total || 0)}</div>
            <p className="text-sm text-muted-foreground">Facturación total</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="timeline">
            <History className="h-3.5 w-3.5 mr-1" /> Timeline ({eventos.length})
          </TabsTrigger>
          <TabsTrigger value="presupuestos">Presupuestos ({presupuestos.length})</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos ({pedidos.length})</TabsTrigger>
          <TabsTrigger value="albaranes">Albaranes ({albaranes.length})</TabsTrigger>
          <TabsTrigger value="referencias">Referencias</TabsTrigger>
        </TabsList>

        {/* === TIMELINE === */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Histórico del cliente</CardTitle>
              <CardDescription>
                Todos los presupuestos, pedidos y albaranes ordenados por fecha. Más reciente arriba.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventos.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Sin actividad. Crea el primer presupuesto.
                </p>
              ) : (
                <ol className="relative border-l-2 border-slate-200 ml-3 space-y-4">
                  {eventos.map((e, i) => {
                    const Icon = e.icon
                    return (
                      <li key={i} className="ml-6">
                        <span className={`absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${e.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <Link href={e.href} className="block group">
                          <div className="rounded-md border bg-white px-3 py-2 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="font-semibold text-sm text-slate-900">{e.titulo}</div>
                              <div className="text-xs text-slate-500">{fmtFecha(e.fecha)}</div>
                            </div>
                            <div className="text-xs text-slate-600">{e.detalle}</div>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              {e.tipo === 'presupuesto' && ESTADO_PRES_BADGE[e.estado] && (
                                <Badge className={`${ESTADO_PRES_BADGE[e.estado].color} text-[10px]`}>
                                  {ESTADO_PRES_BADGE[e.estado].label}
                                </Badge>
                              )}
                              {e.tipo === 'pedido' && ESTADO_PED_BADGE[e.estado] && (
                                <Badge className={`${ESTADO_PED_BADGE[e.estado].color} text-[10px]`}>
                                  {ESTADO_PED_BADGE[e.estado].label}
                                </Badge>
                              )}
                              {(e.tipo === 'albaran_entrega' || e.tipo === 'albaran_recepcion') && (
                                <Badge variant="outline" className="text-[10px]">{e.estado}</Badge>
                              )}
                              {e.total != null && (
                                <span className="text-xs font-mono text-slate-700">{fmtEur(e.total)}</span>
                              )}
                              <ArrowRight className="h-3 w-3 text-slate-400 ml-auto" />
                            </div>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === INFORMACIÓN === */}
        <TabsContent value="info" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Datos de contacto</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/dashboard/clientes/${clienteId}/editar`)}
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CampoContacto
                  icon={Building}
                  label="Persona de contacto"
                  valor={cliente.persona_contacto}
                />
                <CampoContacto
                  icon={Mail}
                  label="Email"
                  valor={cliente.email}
                  href={cliente.email ? `mailto:${cliente.email}` : undefined}
                />
                <CampoContacto
                  icon={Phone}
                  label="Teléfono"
                  valor={cliente.telefono}
                  href={cliente.telefono ? `tel:${cliente.telefono}` : undefined}
                />
                <CampoContacto
                  icon={MapPin}
                  label="Dirección"
                  valor={cliente.direccion}
                  extra={
                    cliente.codigo_postal || cliente.ciudad || cliente.provincia
                      ? `${cliente.codigo_postal ?? ''} ${cliente.ciudad ?? ''}${cliente.provincia ? ', ' + cliente.provincia : ''}`.trim()
                      : null
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Datos comerciales</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {cliente.cif_nif && (
                  <div><p className="text-sm text-muted-foreground">CIF/NIF</p><p className="font-medium">{cliente.cif_nif}</p></div>
                )}
                <div><p className="text-sm text-muted-foreground">Condiciones de pago</p><p className="font-medium">{cliente.condiciones_pago || '30 días'}</p></div>
                <div><p className="text-sm text-muted-foreground">Descuento general</p><p className="font-medium">{cliente.descuento_general || 0}%</p></div>
                {cliente.notas && (
                  <div><p className="text-sm text-muted-foreground">Notas</p><p className="text-sm">{cliente.notas}</p></div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === PRESUPUESTOS === */}
        <TabsContent value="presupuestos">
          <Card>
            <CardHeader><CardTitle>Presupuestos del cliente</CardTitle><CardDescription>Historial completo</CardDescription></CardHeader>
            <CardContent>
              {presupuestos.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Sin presupuestos.</p>
              ) : (
                <ul className="divide-y">
                  {presupuestos.map((p) => (
                    <li key={p.id}>
                      <Link href={`/presupuestos/${p.id}`} className="flex items-center gap-3 px-2 py-3 hover:bg-blue-50 rounded">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-semibold text-sm">{p.numero}</div>
                          <div className="text-xs text-slate-500">{fmtFecha(p.fecha)}</div>
                        </div>
                        {ESTADO_PRES_BADGE[p.estado] && (
                          <Badge className={`${ESTADO_PRES_BADGE[p.estado].color} text-xs`}>
                            {ESTADO_PRES_BADGE[p.estado].label}
                          </Badge>
                        )}
                        <span className="font-mono text-sm">{fmtEur(p.total)}</span>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === PEDIDOS === */}
        <TabsContent value="pedidos">
          <Card>
            <CardHeader><CardTitle>Pedidos del cliente</CardTitle><CardDescription>Historial completo</CardDescription></CardHeader>
            <CardContent>
              {pedidos.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Sin pedidos.</p>
              ) : (
                <ul className="divide-y">
                  {pedidos.map((p) => (
                    <li key={p.id}>
                      <Link href={`/pedidos/${p.id}`} className="flex items-center gap-3 px-2 py-3 hover:bg-amber-50 rounded">
                        <ShoppingCart className="h-4 w-4 text-slate-400" />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-semibold text-sm">{p.numero}</div>
                          <div className="text-xs text-slate-500">
                            <Calendar className="h-3 w-3 inline mr-0.5" />
                            {fmtFecha(p.fecha_creacion)}
                            {p.fecha_entrega_estimada && (<> · entrega {fmtFecha(p.fecha_entrega_estimada)}</>)}
                          </div>
                        </div>
                        {ESTADO_PED_BADGE[p.estado] && (
                          <Badge className={`${ESTADO_PED_BADGE[p.estado].color} text-xs`}>
                            {ESTADO_PED_BADGE[p.estado].label}
                          </Badge>
                        )}
                        <span className="font-mono text-sm">{fmtEur(p.total)}</span>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ALBARANES === */}
        <TabsContent value="albaranes">
          <Card>
            <CardHeader><CardTitle>Albaranes del cliente</CardTitle><CardDescription>Entregas y recepciones</CardDescription></CardHeader>
            <CardContent>
              {albaranes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Sin albaranes.</p>
              ) : (
                <ul className="divide-y">
                  {albaranes.map((a) => {
                    const recep = a.tipo === 'recepcion'
                    return (
                      <li key={a.id}>
                        <Link href={`/albaranes/${a.id}`} className={`flex items-center gap-3 px-2 py-3 hover:${recep ? 'bg-purple-50' : 'bg-emerald-50'} rounded`}>
                          {recep ? <Package className="h-4 w-4 text-purple-500" /> : <Truck className="h-4 w-4 text-emerald-500" />}
                          <div className="flex-1 min-w-0">
                            <div className="font-mono font-semibold text-sm">{a.numero}</div>
                            <div className="text-xs text-slate-500">
                              {recep ? 'Recepción · cliente trajo piezas' : 'Entrega'} · {fmtFecha(a.fecha_entrega)}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">{a.estado}</Badge>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === REFERENCIAS === */}
        <TabsContent value="referencias">
          <PiezasRecurrentesSeccion clienteId={clienteId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Campo de contacto: muestra label + icono SIEMPRE, valor o "—"
// ============================================================

function CampoContacto({
  icon: Icon,
  label,
  valor,
  href,
  extra,
}: {
  icon: any
  label: string
  valor: string | null | undefined
  href?: string
  extra?: string | null
}) {
  const tieneValor = valor && String(valor).trim().length > 0
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        {tieneValor ? (
          href ? (
            <a href={href} className="text-blue-600 hover:underline break-all">{valor}</a>
          ) : (
            <div className="text-slate-900 break-words">{valor}</div>
          )
        ) : (
          <div className="text-slate-400 italic text-sm">— sin definir</div>
        )}
        {extra && tieneValor && <div className="text-xs text-slate-600">{extra}</div>}
      </div>
    </div>
  )
}
