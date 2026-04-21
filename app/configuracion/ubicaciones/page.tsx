import { accionListarUbicaciones } from '@/lib/actions/ubicaciones'
import { createClient } from '@/lib/supabase/server'
import UbicacionesCliente from './ubicaciones-cliente'

export const dynamic = 'force-dynamic'

/**
 * Trae todas las piezas NO canceladas con los datos mínimos útiles
 * para mostrar en la fila expandible de cada ubicación.
 * Se omiten las piezas en estado 'cancelada' porque son ruido.
 */
async function cargarPiezasPorUbicacion(): Promise<Record<string, any[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('piezas')
    .select(
      `
      id, numero, estado, ubicacion_id, qr_codigo,
      linea_pedido:lineas_pedido(
        id, descripcion, producto_id,
        producto:productos(id, nombre),
        pedido:pedidos(
          id, numero,
          cliente:clientes(id, nombre_comercial)
        )
      )
    `
    )
    .neq('estado', 'cancelada')
    .not('ubicacion_id', 'is', null)
    .order('numero', { ascending: true })

  if (error) {
    console.error('[ubicaciones] cargarPiezasPorUbicacion error:', error.message)
    return {}
  }

  const map: Record<string, any[]> = {}
  for (const p of (data ?? []) as any[]) {
    const ubId = p.ubicacion_id
    if (!ubId) continue
    if (!map[ubId]) map[ubId] = []
    map[ubId].push(p)
  }
  return map
}

export default async function UbicacionesPage() {
  const [resUbic, piezasPorUbic] = await Promise.all([
    accionListarUbicaciones(),
    cargarPiezasPorUbicacion(),
  ])

  if (!resUbic.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="font-medium">
          No se pudieron cargar las ubicaciones
        </div>
        <div className="mt-1 text-sm">{resUbic.error}</div>
      </div>
    )
  }

  return (
    <UbicacionesCliente
      ubicacionesIniciales={resUbic.ubicaciones}
      piezasPorUbicacion={piezasPorUbic}
    />
  )
}
