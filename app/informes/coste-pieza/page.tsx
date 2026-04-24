import { accionListarCostesPieza } from '@/lib/actions/informe-coste-pieza'
import CostePiezaCliente from './coste-pieza-cliente'

export const dynamic = 'force-dynamic'

/**
 * Ruta /informes/coste-pieza — R6b-3c
 *
 * Lista de piezas con al menos una tarea con consumo real registrado,
 * comparando consumo estimado vs real por material y merma %.
 */
export default async function CostePiezaPage() {
  const res = await accionListarCostesPieza()

  if (!res.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="font-medium">No se pudo cargar el informe</div>
        <div className="mt-1 text-sm">{res.error}</div>
      </div>
    )
  }

  return <CostePiezaCliente items={res.items} />
}
