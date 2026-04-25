import { redirect } from 'next/navigation'
import { obtenerPerfilActual, listarPerfiles } from '@/lib/services/auth-roles'
import UsuariosCliente from './usuarios-cliente'

export const dynamic = 'force-dynamic'

/**
 * /configuracion/usuarios — Gestion de roles y permisos por modulo.
 *
 * Solo admin. Si no es admin, redirige a /dashboard.
 */
export default async function UsuariosPage() {
  const perfil = await obtenerPerfilActual()
  if (!perfil) redirect('/auth/login')
  if (perfil.rol !== 'admin') redirect('/dashboard')

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
