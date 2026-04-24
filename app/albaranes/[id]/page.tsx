import { accionObtenerAlbaran } from '@/lib/actions/albaranes'
import { notFound } from 'next/navigation'
import AlbaranDetalleCliente from './albaran-detalle-cliente'

export const dynamic = 'force-dynamic'

/**
 * Ruta /albaranes/[id] — vista detalle imprimible.
 */
export default async function AlbaranDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await accionObtenerAlbaran(id)
  if (!res.ok) notFound()
  return <AlbaranDetalleCliente albaran={res.albaran} />
}
