import { notFound } from 'next/navigation'
import Link from 'next/link'
import { obtenerPedido } from '@/lib/services/pedidos'
import EtiquetasCliente, { type EtiquetaPieza } from './etiquetas-cliente'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EtiquetasPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let pedido: any = null
  try {
    pedido = await obtenerPedido(id)
  } catch (e) {
    notFound()
  }
  if (!pedido) notFound()

  // Si el pedido está en borrador, aún no tiene piezas. Mostrar aviso
  // claro antes de llegar a la pantalla vacía de etiquetas.
  if (pedido.estado === 'borrador') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Pedido sin confirmar</h2>
              <p className="mt-2 text-sm">
                El pedido <span className="font-mono font-semibold">{pedido.numero}</span> está en estado
                {' '}<span className="font-semibold">borrador</span>. Las piezas se generan al
                confirmarlo, por eso aquí no hay nada que etiquetar todavía.
              </p>
              <p className="mt-2 text-sm">
                Vuelve al detalle del pedido y pulsa <strong>&quot;Confirmar pedido&quot;</strong> para
                crear las piezas (una por cada unidad de cada línea). Después podrás imprimir etiquetas.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/pedidos/${pedido.id}`}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Ir al detalle del pedido
                </Link>
                <Link
                  href="/pedidos"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ver todos los pedidos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Aplanar las líneas del pedido → lista de piezas con los campos que
  // necesita la etiqueta. Una línea puede tener N piezas (una por unidad).
  const clienteNombre: string =
    pedido?.cliente?.nombre_comercial ?? pedido?.cliente?.razon_social ?? '—'

  const piezas: EtiquetaPieza[] = []
  const lineas: any[] = Array.isArray(pedido?.lineas) ? pedido.lineas : []
  for (const linea of lineas) {
    const piezasLinea: any[] = Array.isArray(linea?.piezas) ? linea.piezas : []
    for (const p of piezasLinea) {
      if (!p?.numero) continue
      piezas.push({
        pieza_numero: p.numero,
        pedido_numero: pedido.numero ?? null,
        cliente_nombre_comercial: clienteNombre,
        descripcion: linea.descripcion ?? null,
        procesos_codigos:
          Array.isArray(linea.procesos_codigos) && linea.procesos_codigos.length > 0
            ? linea.procesos_codigos
            : null,
        tratamiento_nombre: linea.tratamiento?.nombre ?? null,
        modo_precio: (linea.modo_precio ?? null) as EtiquetaPieza['modo_precio'],
        ancho: linea.ancho ?? null,
        alto: linea.alto ?? null,
        grosor: linea.grosor ?? null,
        longitud_ml: linea.longitud_ml ?? null,
      })
    }
  }

  return (
    <EtiquetasCliente
      pedidoNumero={pedido.numero ?? ''}
      clienteNombre={clienteNombre}
      piezas={piezas}
    />
  )
}
