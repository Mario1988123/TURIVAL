import {
  accionEstadoOperariosHoy,
  accionDescansoGlobalActivo,
} from '@/lib/actions/fichajes'
import { createClient } from '@/lib/supabase/server'
import FichajesShell from './fichajes-shell'

export const dynamic = 'force-dynamic'

/**
 * /fichajes — Modulo completo Sesame-like.
 * Tabs: Hoy | Histórico | Calendario | Ausencias | Horarios | Documentos | Admin
 */
export default async function FichajesPage() {
  const supabase = await createClient()
  const [estadoRes, descansoRes, operariosData] = await Promise.all([
    accionEstadoOperariosHoy(),
    accionDescansoGlobalActivo(),
    supabase.from('operarios').select('id, nombre, rol, color, activo').eq('activo', true).order('nombre'),
  ])

  const necesita031 = estadoRes.hint === 'instalar_031' || descansoRes.hint === 'instalar_031'
  if (necesita031) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
        <div className="font-semibold">Falta ejecutar scripts/031_tabla_fichajes.sql</div>
        <div className="mt-1 text-sm">
          La tabla <code>fichajes</code> aún no existe en Supabase. Ejecuta el script y recarga.
        </div>
      </div>
    )
  }

  return (
    <FichajesShell
      operarios={(operariosData.data ?? []) as any[]}
      operariosEstado={estadoRes.ok ? (estadoRes.data ?? []) : []}
      descansoInicial={descansoRes.ok ? (descansoRes.data ?? { activo: false, inicio: null, minutos_transcurridos: 0 }) : { activo: false, inicio: null, minutos_transcurridos: 0 }}
    />
  )
}
