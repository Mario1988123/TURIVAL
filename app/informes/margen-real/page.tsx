import { accionListarMargenPedidos } from '@/lib/actions/informe-margen'
import MargenRealCliente from './margen-real-cliente'

export const dynamic = 'force-dynamic'

/**
 * Ruta /informes/margen-real — Capa 8.
 *
 * Tabla de pedidos con márgen REAL calculado desde consumos y tiempos reales.
 * Comparativa con el margen objetivo (configuracion_empresa.margen_objetivo_porcentaje).
 */
export default async function MargenRealPage() {
  const res = await accionListarMargenPedidos()
  if (!res.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
        <div className="font-medium">No se pudo cargar el informe</div>
        <div className="mt-1 text-sm">{res.error}</div>
      </div>
    )
  }
  return <MargenRealCliente items={res.items} />
}
