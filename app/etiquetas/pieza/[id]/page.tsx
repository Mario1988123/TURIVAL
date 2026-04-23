import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EtiquetasCliente, { type EtiquetaPieza } from '../../pedido/[id]/etiquetas-cliente'

export const dynamic = 'force-dynamic'

/**
 * Página para imprimir la etiqueta de UNA sola pieza. Usada desde el
 * kanban de /produccion al pulsar el botón de impresora de una tarjeta.
 *
 * Reutiliza el mismo componente cliente que la ruta de "todas las piezas
 * de un pedido", pasándole un array con 1 elemento y X/N = 1/1.
 */
export default async function EtiquetaPiezaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('piezas')
    .select(`
      id, numero,
      linea_pedido:lineas_pedido(
        id, descripcion, procesos_codigos,
        modo_precio, ancho, alto, grosor, longitud_ml,
        tratamiento:tratamientos(id, nombre),
        pedido:pedidos(
          id, numero,
          cliente:clientes(id, nombre_comercial, razon_social)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const pieza: any = data
  const lineaArr: any = pieza?.linea_pedido
  const linea: any = Array.isArray(lineaArr) ? lineaArr[0] : lineaArr
  const pedidoArr: any = linea?.pedido
  const pedido: any = Array.isArray(pedidoArr) ? pedidoArr[0] : pedidoArr
  const clienteArr: any = pedido?.cliente
  const cliente: any = Array.isArray(clienteArr) ? clienteArr[0] : clienteArr
  const tratArr: any = linea?.tratamiento
  const tratamiento: any = Array.isArray(tratArr) ? tratArr[0] : tratArr

  const clienteNombre: string =
    cliente?.nombre_comercial ?? cliente?.razon_social ?? '—'

  const etiqueta: EtiquetaPieza = {
    pieza_numero: pieza.numero ?? '',
    pedido_numero: pedido?.numero ?? null,
    cliente_nombre_comercial: clienteNombre,
    descripcion: linea?.descripcion ?? null,
    procesos_codigos:
      Array.isArray(linea?.procesos_codigos) && linea.procesos_codigos.length > 0
        ? linea.procesos_codigos
        : null,
    tratamiento_nombre: tratamiento?.nombre ?? null,
    modo_precio: (linea?.modo_precio ?? null) as EtiquetaPieza['modo_precio'],
    ancho: linea?.ancho ?? null,
    alto: linea?.alto ?? null,
    grosor: linea?.grosor ?? null,
    longitud_ml: linea?.longitud_ml ?? null,
    indice_global: 1,
    total_piezas: 1,
  }

  return (
    <EtiquetasCliente
      pedidoNumero={pedido?.numero ?? ''}
      clienteNombre={clienteNombre}
      piezas={[etiqueta]}
    />
  )
}
