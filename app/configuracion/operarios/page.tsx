import { accionListarOperarios } from '@/lib/actions/operarios'
import OperariosCliente from './operarios-cliente'

export const dynamic = 'force-dynamic'

export default async function OperariosPage() {
  // En configuración mostramos TODOS (activos e inactivos)
  const res = await accionListarOperarios(true)

  if (!res.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="font-medium">No se pudieron cargar los operarios</div>
        <div className="mt-1 text-sm">{res.error}</div>
      </div>
    )
  }

  return <OperariosCliente operariosIniciales={res.operarios} />
}
