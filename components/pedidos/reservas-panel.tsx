'use client'

/**
 * components/pedidos/reservas-panel.tsx
 * ================================================================
 * Panel de reservas de material de un pedido. Añadido en R6.
 *
 * Muestra kg reservados por material con coste estimado y flag
 * de stock físico suficiente. Si el pedido no tiene reservas,
 * ofrece botón para crearlas manualmente (útil si confirmarPedido
 * falló en reservar por un error transitorio).
 * ================================================================
 */

import { useEffect, useState } from 'react'
import {
  accionObtenerResumenReservas,
  accionReservarMaterialesPedido,
} from '@/lib/actions/reservas'
import type {
  ResultadoReservas,
  ResumenReservaPorMaterial,
} from '@/lib/services/reservas'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Beaker, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Plus,
} from 'lucide-react'

const EURO = (n: number) =>
  Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
const KG = (n: number) =>
  `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 3 })} kg`

const ETIQUETA_TIPO: Record<string, string> = {
  lacado: 'Lacado',
  fondo: 'Fondo',
  catalizador: 'Catalizador',
  disolvente: 'Disolvente',
}

export default function ReservasPanel({ pedidoId }: { pedidoId: string }) {
  const [data, setData] = useState<ResultadoReservas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [reservando, setReservando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const res = await accionObtenerResumenReservas(pedidoId)
      setData(res)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [pedidoId])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 3000)
    return () => clearTimeout(t)
  }, [mensaje])

  async function reservarAhora() {
    setReservando(true)
    try {
      const res = await accionReservarMaterialesPedido(pedidoId)
      setData(res)
      if (res.reservas_creadas > 0) {
        setMensaje({
          tipo: 'ok',
          texto: `Creadas ${res.reservas_creadas} reservas · ${KG(res.total_kg_reservado)} total.`,
        })
      } else {
        setMensaje({
          tipo: 'error',
          texto: 'No se pudieron crear reservas. Revisa que las líneas tengan material asignado.',
        })
      }
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e?.message || e}` })
    } finally {
      setReservando(false)
    }
  }

  if (cargando) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="w-5 h-5" />
            Reservas de material
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Cargando reservas…
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="w-5 h-5" />
            Reservas de material
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Error cargando reservas: {error}
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={cargar} className="mt-3">
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  const tieneReservas = data && data.reservas_creadas > 0
  const faltaStock = (data?.detalles ?? []).some(d => !d.suficiente)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="w-5 h-5" />
            Reservas de material
            {tieneReservas && (
              <Badge variant="outline" className="ml-2">
                {data!.materiales_afectados} materiales · {KG(data!.total_kg_reservado)}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Consumo teórico calculado al confirmar el pedido. Se ajustará al consumo real al completar cada tarea.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={cargar} title="Recargar">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {!tieneReservas && (
            <Button
              variant="default" size="sm"
              onClick={reservarAhora}
              disabled={reservando}
            >
              {reservando
                ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Reservando…</>
                : <><Plus className="w-3.5 h-3.5 mr-2" />Reservar ahora</>}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!tieneReservas ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Este pedido no tiene reservas activas.
            {' '}
            Las reservas se crean automáticamente al confirmar el pedido,
            pero si falló el proceso puedes crearlas ahora con el botón.
          </div>
        ) : (
          <>
            {faltaStock && (
              <Alert variant="destructive" className="mb-3">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  Hay materiales con stock físico insuficiente. Comprueba y regulariza antes de arrancar la producción.
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Reservado</TableHead>
                    <TableHead className="text-right">€/kg</TableHead>
                    <TableHead className="text-right">Coste est.</TableHead>
                    <TableHead className="text-right">Stock físico</TableHead>
                    <TableHead>OK</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.detalles.map((d: ResumenReservaPorMaterial) => (
                    <TableRow key={d.material_id} className={!d.suficiente ? 'bg-red-50' : ''}>
                      <TableCell>
                        <div>
                          {d.codigo && (
                            <span className="font-mono text-xs text-muted-foreground mr-2">
                              {d.codigo}
                            </span>
                          )}
                          {d.nombre}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ETIQUETA_TIPO[d.tipo] ?? d.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {KG(d.cantidad_reservada_kg)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {d.precio_kg > 0 ? EURO(d.precio_kg) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {d.coste_estimado_eur > 0 ? EURO(d.coste_estimado_eur) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {KG(d.stock_fisico_kg)}
                      </TableCell>
                      <TableCell>
                        {d.suficiente ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="text-xs text-muted-foreground mt-3 space-y-1">
              <p>
                <strong>Coste total estimado de materiales:</strong>{' '}
                {EURO(data!.detalles.reduce((s, d) => s + d.coste_estimado_eur, 0))}
              </p>
              <p className="italic">
                Valores teóricos. Al completar las tareas de lacado/fondo el operario
                registrará el consumo real y se generará automáticamente merma si hay diferencia.
              </p>
            </div>
          </>
        )}
      </CardContent>

      {mensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[280px] max-w-md">
          <Alert
            variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}
            className={mensaje.tipo === 'ok' ? 'bg-green-50 border-green-300 text-green-900' : ''}
          >
            <AlertDescription className="font-medium">{mensaje.texto}</AlertDescription>
          </Alert>
        </div>
      )}
    </Card>
  )
}
