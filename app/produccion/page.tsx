import { accionListarTareasParaPanel } from '@/lib/actions/produccion'
import { accionListarOperarios } from '@/lib/actions/operarios'
import ProduccionCliente from './produccion-cliente'

export const dynamic = 'force-dynamic'

export default async function ProduccionPage() {
  const [resTareas, resOperarios] = await Promise.all([
    accionListarTareasParaPanel({}),
    accionListarOperarios(false), // solo activos
  ])

  if (!resTareas.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="font-medium">No se pudieron cargar las tareas</div>
        <div className="mt-1 text-sm">{resTareas.error}</div>
      </div>
    )
  }

  return (
    <ProduccionCliente
      tareasIniciales={resTareas.tareas}
      operarios={resOperarios.ok ? resOperarios.operarios : []}
    />
  )
}
