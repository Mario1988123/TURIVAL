import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { obtenerPerfilActual } from '@/lib/services/auth-roles'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Calendar, Euro, FileText, Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Pendiente', color: 'bg-slate-100 text-slate-700' },
  en_produccion: { label: 'En produccion', color: 'bg-blue-100 text-blue-800' },
  completado: { label: 'Listo', color: 'bg-emerald-100 text-emerald-800' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
}

/**
 * Portal de cliente: ve sus pedidos y presupuestos. Requiere usuario
 * con rol "cliente" en usuario_perfiles. El email del usuario debe
 * estar registrado en clientes (campo email).
 */
export default async function PortalClientePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const perfil = await obtenerPerfilActual()
  if (!perfil || (perfil.rol !== 'cliente' && perfil.rol !== 'admin')) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-lg font-semibold">Sin acceso de cliente</h2>
        <p className="text-sm mt-2">
          Tu usuario no esta marcado como cliente. Pide al administrador que asigne el rol "cliente" en /configuracion/usuarios.
        </p>
      </div>
    )
  }

  // Buscar cliente vinculado al email del usuario
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, razon_social, nombre_comercial')
    .eq('email', user.email ?? '')
    .maybeSingle()

  if (!cliente) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-lg font-semibold">Cliente no vinculado</h2>
        <p className="text-sm mt-2">
          Tu email <span className="font-mono">{user.email}</span> no esta registrado como cliente. Pide al taller que actualice tu ficha.
        </p>
      </div>
    )
  }

  // Cargar presupuestos y pedidos del cliente
  const [pres, peds] = await Promise.all([
    supabase
      .from('presupuestos')
      .select('id, numero, fecha, estado, total, share_token')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('pedidos')
      .select('id, numero, fecha, estado, total, fecha_entrega_estimada')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Hola, {cliente.nombre_comercial ?? cliente.razon_social}
        </h1>
        <p className="text-sm text-slate-600">
          Estos son tus pedidos y presupuestos en curso. Pulsa en cualquiera para ver el detalle.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Mis pedidos ({peds.data?.length ?? 0})
          </CardTitle>
          <CardDescription>Trabajos en curso o entregados</CardDescription>
        </CardHeader>
        <CardContent>
          {(peds.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No tienes pedidos todavia.</p>
          ) : (
            <ul className="divide-y">
              {(peds.data ?? []).map((p: any) => (
                <li key={p.id} className="py-2 flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-sm">{p.numero}</div>
                    <div className="text-xs text-slate-500">
                      <Calendar className="h-3 w-3 inline mr-0.5" />
                      {new Date(p.fecha).toLocaleDateString('es-ES')}
                      {p.fecha_entrega_estimada && (
                        <> · entrega {new Date(p.fecha_entrega_estimada).toLocaleDateString('es-ES')}</>
                      )}
                    </div>
                  </div>
                  <Badge className={ESTADO_BADGE[p.estado]?.color ?? 'bg-slate-100'}>
                    {ESTADO_BADGE[p.estado]?.label ?? p.estado}
                  </Badge>
                  <span className="text-sm font-mono">{Number(p.total).toFixed(2)} €</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Mis presupuestos ({pres.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(pres.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No tienes presupuestos.</p>
          ) : (
            <ul className="divide-y">
              {(pres.data ?? []).map((p: any) => (
                <li key={p.id} className="py-2 flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-sm">{p.numero}</div>
                    <div className="text-xs text-slate-500">{new Date(p.fecha).toLocaleDateString('es-ES')}</div>
                  </div>
                  <Badge variant="outline">{p.estado}</Badge>
                  <span className="text-sm font-mono">{Number(p.total).toFixed(2)} €</span>
                  {p.share_token && (
                    <Link
                      href={`/p/${p.share_token}`}
                      className="text-xs text-blue-700 hover:underline flex items-center gap-0.5"
                    >
                      ver <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
