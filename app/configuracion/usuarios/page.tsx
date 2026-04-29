import { redirect } from 'next/navigation'
import { obtenerSesion, esAdmin } from '@/lib/auth/permisos'
import { bootstrapAdminPropio, listarPerfiles } from '@/lib/services/auth-roles'
import { createClient } from '@/lib/supabase/server'
import UsuariosCliente from './usuarios-cliente'

export const dynamic = 'force-dynamic'

/**
 * /configuracion/usuarios — Gestión de roles y permisos por módulo.
 *
 * Flujo:
 *  1) `obtenerSesion()` con fallback admin (mono-empresa) para el guard.
 *  2) `bootstrapAdminPropio()` intenta auto-formalizar al user como admin
 *     si la tabla está vacía. Falla silenciosamente si las RLS lo bloquean.
 *  3) `listarPerfiles()` llama a la RPC `listar_perfiles_admin` (SECURITY
 *     DEFINER, exige admin). Si falla con "Solo admin puede listar perfiles",
 *     significa que el bootstrap no pasó la RLS y el user todavía no tiene
 *     fila admin en `usuario_perfiles`. En ese caso mostramos SQL exacto
 *     listo para copiar/pegar en Supabase SQL Editor.
 */
export default async function UsuariosPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/auth/login')
  if (!esAdmin(sesion)) redirect('/dashboard')

  await bootstrapAdminPropio()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? sesion.user_id
  const userEmail = user?.email ?? ''
  const nombreSugerido = (() => {
    const local = userEmail.split('@')[0] || 'Admin'
    const seg = local.split(/[._-]/)[0]
    return seg.charAt(0).toUpperCase() + seg.slice(1)
  })()

  let perfiles: any[] = []
  try {
    perfiles = await listarPerfiles()
  } catch (e: any) {
    const msg = (e?.message ?? '').toLowerCase()
    const esBloqueoAdmin = msg.includes('solo admin') || msg.includes('only admin') || msg.includes('permission')

    if (esBloqueoAdmin) {
      const sql = `INSERT INTO usuario_perfiles (user_id, rol, nombre, email, modulos_permitidos, activo)
VALUES (
  '${userId}',
  'admin',
  '${nombreSugerido}',
  '${userEmail}',
  ARRAY['*'],
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  rol = 'admin',
  modulos_permitidos = ARRAY['*'],
  activo = true,
  nombre = '${nombreSugerido}',
  email = '${userEmail}';`

      return (
        <div className="mx-auto max-w-3xl p-6 space-y-4">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900 space-y-3">
            <h2 className="text-lg font-semibold">Falta formalizarte como admin en la BD</h2>
            <p className="text-sm">
              Tu cuenta existe en Supabase Auth ({userEmail}) pero todavía no tiene fila en
              {' '}<code className="font-mono bg-white px-1 rounded">usuario_perfiles</code> con rol{' '}
              <strong>admin</strong>. La RPC <code className="font-mono bg-white px-1 rounded">listar_perfiles_admin</code>
              {' '}exige ser admin formal para listar el resto. El auto-bootstrap falló (probablemente porque las
              políticas RLS de la tabla bloquean al usuario insertar su propia fila).
            </p>
            <div>
              <p className="text-sm font-medium mb-2">Pega esto en Supabase SQL Editor (una sola vez):</p>
              <pre className="rounded bg-slate-900 text-slate-100 text-xs p-3 overflow-auto whitespace-pre">
{sql}
              </pre>
            </div>
            <p className="text-xs text-slate-700">
              Después refresca esta página y verás tu perfil admin en la lista. A partir de ahí ya
              puedes crear y asignar roles a los demás usuarios desde el botón <em>Asignar rol a usuario</em>.
            </p>
          </div>
        </div>
      )
    }

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
