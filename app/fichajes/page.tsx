import {
  accionEstadoOperariosHoy,
  accionDescansoGlobalActivo,
} from '@/lib/actions/fichajes'
import FichajesCliente from './fichajes-cliente'

export const dynamic = 'force-dynamic'

/**
 * Ruta /fichajes — Panel de fichajes.
 *
 * Requiere la tabla `fichajes` (scripts/031_tabla_fichajes.sql).
 * Si la tabla no existe, la UI muestra un aviso con el hint.
 */
export default async function FichajesPage() {
  const [estadoRes, descansoRes] = await Promise.all([
    accionEstadoOperariosHoy(),
    accionDescansoGlobalActivo(),
  ])

  const necesita031 = estadoRes.hint === 'instalar_031' || descansoRes.hint === 'instalar_031'
  if (necesita031) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
        <div className="font-semibold">Falta ejecutar scripts/031_tabla_fichajes.sql</div>
        <div className="mt-1 text-sm">
          La tabla <code>fichajes</code> aún no existe en Supabase. Abre Supabase SQL Editor y ejecuta el contenido de <code>scripts/031_tabla_fichajes.sql</code>. Después recarga esta página.
        </div>
      </div>
    )
  }

  return (
    <FichajesCliente
      operariosIniciales={estadoRes.ok ? (estadoRes.data ?? []) : []}
      descansoInicial={descansoRes.ok ? (descansoRes.data ?? { activo: false, inicio: null, minutos_transcurridos: 0 }) : { activo: false, inicio: null, minutos_transcurridos: 0 }}
      errorInicial={estadoRes.ok ? null : (estadoRes.error ?? 'Error')}
    />
  )
}
