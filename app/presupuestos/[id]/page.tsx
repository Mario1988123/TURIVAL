'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, FileText, Send, Check, X, ShoppingCart, Printer } from 'lucide-react'
import Link from 'next/link'

interface Presupuesto {
  id: string
  numero: string
  estado: string
  subtotal: number
  impuestos: number
  total: number
  validez_dias: number
  observaciones: string
  created_at: string
  clientes: {
    nombre_comercial: string
    email: string
    telefono: string
    direccion: string
  }
}

interface LineaPresupuesto {
  id: string
  numero_linea: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  unidad: string
  productos: {
    nombre: string
    categoria: string
  }
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-gray-500' },
  enviado: { label: 'Enviado', color: 'bg-blue-500' },
  aceptado: { label: 'Aceptado', color: 'bg-green-500' },
  rechazado: { label: 'Rechazado', color: 'bg-red-500' },
  convertido: { label: 'Convertido', color: 'bg-purple-500' },
}

export default function PresupuestoDetalle() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params.id as string

  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null)
  const [lineas, setLineas] = useState<LineaPresupuesto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadPresupuesto()
  }, [id])

  async function loadPresupuesto() {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const { data: presupuestoData, error: presErr } = await supabase
        .from('presupuestos')
        .select(`
          *,
          clientes (
            nombre_comercial,
            email,
            telefono,
            direccion
          )
        `)
        .eq('id', id)
        .single()

      if (presErr) throw presErr
      setPresupuesto(presupuestoData)

      const { data: lineasData } = await supabase
        .from('lineas_presupuesto')
        .select(`
          *,
          productos (
            nombre,
            categoria
          )
        `)
        .eq('presupuesto_id', id)
        .order('numero_linea')

      setLineas(lineasData || [])
    } catch (err) {
      console.error('Error cargando presupuesto:', err)
      setError('Error al cargar el presupuesto')
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstado(nuevoEstado: string) {
    try {
      const { error } = await supabase
        .from('presupuestos')
        .update({ estado: nuevoEstado })
        .eq('id', id)

      if (error) throw error
      loadPresupuesto()
    } catch (err) {
      console.error('Error cambiando estado:', err)
      setError('Error al cambiar estado')
    }
  }

  async function convertirAPedido() {
    if (!presupuesto || !userId) return

    try {
      // Obtener siguiente número de pedido
      const { data: nuevoNumero, error: seqError } = await supabase
        .rpc('get_next_sequence', { seq_id: 'pedido' })

      if (seqError || !nuevoNumero) {
        setError('Error generando número de pedido')
        return
      }

      const numeroPedido = `PED-2026-${String(nuevoNumero).padStart(5, '0')}`

      // Crear pedido
      const { data: pedido, error: pedidoErr } = await supabase
        .from('pedidos')
        .insert({
          numero: numeroPedido,
          cliente_id: presupuesto.clientes ? (presupuesto as any).cliente_id : null,
          user_id: userId,
          presupuesto_id: presupuesto.id,
          estado: 'pendiente',
          prioridad: 'normal',
          subtotal: presupuesto.subtotal,
          impuestos: presupuesto.impuestos,
          total: presupuesto.total,
          observaciones: presupuesto.observaciones,
        })
        .select()
        .single()

      if (pedidoErr) throw pedidoErr

      // Copiar líneas al pedido
      for (const linea of lineas) {
        await supabase
          .from('lineas_pedido')
          .insert({
            pedido_id: pedido.id,
            producto_id: linea.productos ? (linea as any).producto_id : null,
            numero_linea: linea.numero_linea,
            cantidad: linea.cantidad,
            precio_unitario: linea.precio_unitario,
            subtotal: linea.subtotal,
            unidad: linea.unidad,
          })
      }

      // Marcar presupuesto como convertido
      await supabase
        .from('presupuestos')
        .update({ estado: 'convertido' })
        .eq('id', id)

      router.push(`/pedidos/${pedido.id}`)
    } catch (err) {
      console.error('Error convirtiendo a pedido:', err)
      setError('Error al convertir a pedido')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  if (!presupuesto) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Presupuesto no encontrado</AlertDescription>
        </Alert>
        <Link href="/presupuestos" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>
    )
  }

  const estadoInfo = ESTADOS[presupuesto.estado] || ESTADOS.borrador

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/presupuestos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{presupuesto.numero}</h1>
              <Badge className={`${estadoInfo.color} text-white`}>
                {estadoInfo.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Creado el {new Date(presupuesto.created_at).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          
          {presupuesto.estado === 'borrador' && (
            <Button onClick={() => cambiarEstado('enviado')}>
              <Send className="w-4 h-4 mr-2" />
              Enviar
            </Button>
          )}
          
          {presupuesto.estado === 'enviado' && (
            <>
              <Button variant="outline" onClick={() => cambiarEstado('rechazado')}>
                <X className="w-4 h-4 mr-2" />
                Rechazar
              </Button>
              <Button onClick={() => cambiarEstado('aceptado')}>
                <Check className="w-4 h-4 mr-2" />
                Aceptar
              </Button>
            </>
          )}
          
          {presupuesto.estado === 'aceptado' && (
            <Button onClick={convertirAPedido}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Convertir a Pedido
            </Button>
          )}
        </div>
      </div>

      {/* Cliente y Detalles */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Datos del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{presupuesto.clientes?.nombre_comercial || 'Sin cliente'}</p>
            {presupuesto.clientes?.email && (
              <p className="text-sm text-muted-foreground">{presupuesto.clientes.email}</p>
            )}
            {presupuesto.clientes?.telefono && (
              <p className="text-sm text-muted-foreground">{presupuesto.clientes.telefono}</p>
            )}
            {presupuesto.clientes?.direccion && (
              <p className="text-sm text-muted-foreground">{presupuesto.clientes.direccion}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalles del Presupuesto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Validez:</span>
              <span>{presupuesto.validez_dias} días</span>
            </div>
            {presupuesto.observaciones && (
              <div>
                <span className="text-muted-foreground">Observaciones:</span>
                <p className="mt-1 text-sm">{presupuesto.observaciones}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Líneas del Presupuesto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Líneas del Presupuesto</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio Unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay líneas en este presupuesto
                  </TableCell>
                </TableRow>
              ) : (
                lineas.map((linea) => (
                  <TableRow key={linea.id}>
                    <TableCell>{linea.numero_linea}</TableCell>
                    <TableCell className="font-medium">{linea.productos?.nombre || 'Producto'}</TableCell>
                    <TableCell>{linea.productos?.categoria || '-'}</TableCell>
                    <TableCell className="text-right">{linea.cantidad} {linea.unidad}</TableCell>
                    <TableCell className="text-right">{linea.precio_unitario.toFixed(2)}€</TableCell>
                    <TableCell className="text-right font-medium">{linea.subtotal.toFixed(2)}€</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totales */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span>{presupuesto.subtotal.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA (21%):</span>
                <span>{presupuesto.impuestos.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span>Total:</span>
                <span className="text-primary">{presupuesto.total.toFixed(2)}€</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
