import { accionListarTiemposGlobales } from '@/lib/actions/config-tiempos'
import TiemposCliente from './tiempos-cliente'

export const dynamic = 'force-dynamic'

export default async function TiemposPage() {
  const res = await accionListarTiemposGlobales()

  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="font-medium">No se pudieron cargar los tiempos</div>
          <div className="mt-1 text-sm">{res.error}</div>
        </div>
      </div>
    )
  }

  return <TiemposCliente tiemposIniciales={res.tiempos} />
}
