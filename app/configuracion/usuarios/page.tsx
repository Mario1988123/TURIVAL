import { redirect } from 'next/navigation'
import { obtenerSesion, esAdmin } from '@/lib/auth/permisos'
import { bootstrapAdminPropio, listarPerfiles } from '@/lib/services/auth-roles'
import UsuariosCliente from './usuarios-cliente'

export const dynamic = 'force-dynamic'

/**
 * /configuracion/usuarios — Gestión de roles y permisos por módulo.
 *
 * Solo admin. Antes la página llamaba `obtenerPerfilActual()` directamente
 * sobre la tabla `usuario_perfiles`. Si no había fila para el user (caso de
 * Mario antes de que se ejecute el script 035 / INSERT manual), retornaba
 * null → redirect('/auth/login') → "se sale del CRM".
 *
 * Ahora:
 *  1) usamos `obtenerSesion()` con fallback admin (mono-empresa) para el guard,
 *  2) llamamos a `bootstrapAdminPropio()` para que el primer login formalice
 *     automáticamente al user como admin si la tabla está vacía. Así el listado
 *     ya muestra a Mario sin necesidad de SQL manual.
 */
export default async function UsuariosPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/auth/login')
  if (!esAdmin(sesion)) redirect('/dashboard')

  // Auto-bootstrap: si la tabla está vacía y soy admin (por fallback),
  // me inserto a mí mismo como admin formal con todos los módulos.
  await bootstrapAdminPropio()

  let perfiles: any[] = []
  try {
    perfiles = await listarPerfiles()
  } catch (e: any) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <h2 className="text-lg font-semibold">Módulo de roles no disponible aún</h2>
          <p className="mt-2 text-sm">
            Ejecuta primero el script <code className="font-mono bg-white px-1 rounded">scripts/035_auth_roles_y_permisos.sql</code>
            {' '}en Supabase SQL Editor. Después crea tu usuario admin desde Supabase Auth y registralo en la tabla
            {' '}<code className="font-mono bg-white px-1 rounded">usuario_perfiles</code> con rol &apos;admin&apos;.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Detalle técnico: {e?.message ?? 'sin detalles'}
          </p>
        </div>
      </div>
    )
  }

  return <UsuariosCliente perfilesIniciales={perfiles} />
}
