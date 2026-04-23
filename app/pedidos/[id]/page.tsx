import { notFound } from 'next/navigation'
import { obtenerPedido } from '@/lib/services/pedidos'
import EtiquetasCliente, { type EtiquetaPieza } from './etiquetas-cliente'

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

  // Aplanar las líneas del pedido → lista de piezas con los campos que
  // necesita la etiqueta. Una línea puede tener N piezas (una por unidad).
  // Todas las piezas de una línea comparten datos (snapshot al confirmar),
  // lo cual está bien: el operario identifica la pieza por el número único
  // y ve su contexto en la etiqueta.
  const clienteNombre: string =
    pedido?.cliente?.nombre_comercial ?? pedido?.cliente?.razon_social ?? '—'

  const piezasTemp: Omit<EtiquetaPieza, 'indice_global' | 'total_piezas'>[] = []
  const lineas: any[] = Array.isArray(pedido?.lineas) ? pedido.lineas : []
  for (const linea of lineas) {
    const piezasLinea: any[] = Array.isArray(linea?.piezas) ? linea.piezas : []
    // Orden estable dentro de la línea por número de pieza
    const ordenadas = [...piezasLinea].sort((a, b) =>
      String(a?.numero ?? '').localeCompare(String(b?.numero ?? ''))
    )
    for (const p of ordenadas) {
      if (!p?.numero) continue
      piezasTemp.push({
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

  // Añadir X/N global del pedido (1/7, 2/7, ...)
  const total = piezasTemp.length
  const piezas: EtiquetaPieza[] = piezasTemp.map((p, i) => ({
    ...p,
    indice_global: i + 1,
    total_piezas: total,
  }))

  return (
    <EtiquetasCliente
      pedidoNumero={pedido.numero ?? ''}
      clienteNombre={clienteNombre}
      piezas={piezas}
    />
  )
}
