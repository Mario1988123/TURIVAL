import { redirect } from 'next/navigation'
import { obtenerSesion, esAdmin } from '@/lib/auth/permisos'
import { listarPerfiles } from '@/lib/services/auth-roles'
import UsuariosCliente from './usuarios-cliente'

export const dynamic = 'force-dynamic'

/**
 * /configuracion/usuarios — Gestion de roles y permisos por modulo.
 *
 * Solo admin. Antes la pagina llamaba `obtenerPerfilActual()` directamente
 * sobre la tabla `usuario_perfiles`. Si no habia fila para el user (caso de
 * Mario antes de que se ejecute el script 035 / INSERT manual), retornaba
 * null → redirect('/auth/login') → "se sale del CRM".
 *
 * Ahora usamos `obtenerSesion()` del helper de permisos, que tiene fallback
 * admin para mono-empresa: si estas logueado y no hay perfil ni operario,
 * te trata como admin (es Mario o gente de confianza). Asi entras al panel
 * sin necesidad del INSERT manual.
 */
export default async function UsuariosPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/auth/login')
  if (!esAdmin(sesion)) redirect('/dashboard')

  let perfiles: any[] = []
  try {
    perfiles = await listarPerfiles()
  } catch (e: any) {
    // Si la tabla no existe aun (script 035 no ejecutado), mostrar mensaje
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <h2 className="text-lg font-semibold">Modulo de roles no disponible aun</h2>
          <p className="mt-2 text-sm">
            Ejecuta primero el script <code className="font-mono bg-white px-1 rounded">scripts/035_auth_roles_y_permisos.sql</code>
            {' '}en Supabase SQL Editor. Despues crea tu usuario admin desde Supabase Auth y registralo en la tabla
            {' '}<code className="font-mono bg-white px-1 rounded">usuario_perfiles</code> con rol &apos;admin&apos;.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Detalle tecnico: {e?.message ?? 'sin detalles'}
          </p>
        </div>
      </div>
    )
  }

  return <UsuariosCliente perfilesIniciales={perfiles} />
}
