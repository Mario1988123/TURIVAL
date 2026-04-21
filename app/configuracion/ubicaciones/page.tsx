import { accionListarUbicaciones } from '@/lib/actions/ubicaciones'
import UbicacionesCliente from './ubicaciones-cliente'

export const dynamic = 'force-dynamic'

export default async function UbicacionesPage() {
  const res = await accionListarUbicaciones()

  if (!res.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="font-medium">
          No se pudieron cargar las ubicaciones
        </div>
        <div className="mt-1 text-sm">{res.error}</div>
      </div>
    )
  }

  return <UbicacionesCliente ubicacionesIniciales={res.ubicaciones} />
}
