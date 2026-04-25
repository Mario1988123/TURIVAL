import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Calendar, FileText, Package } from 'lucide-react'
import { TuriavalLogo } from '@/components/branding/turiaval-logo'

export const dynamic = 'force-dynamic'

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Pendiente', color: 'bg-slate-100 text-slate-700' },
  en_produccion: { label: 'En produccion', color: 'bg-blue-100 text-blue-800' },
  completado: { label: 'Listo', color: 'bg-emerald-100 text-emerald-800' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
}

/**
 * /c/[token] — portal publico de cliente sin login.
 *
 * El token es el `share_token` de un presupuesto. Permite al cliente
 * ver TODOS los pedidos y presupuestos de su empresa en una sola
 * pantalla, partiendo del presupuesto que se le envio.
 *
 * No requiere autenticacion: el token es el secreto. Si lo comparte,
 * el receptor ve la lista — Mario y el cliente saben que es asi.
 */
export default async function PortalClienteToken({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  // Resolver cliente desde el presupuesto con ese token
  const { data: presupuesto } = await supabase
    .from('presupuestos')
    .select('id, cliente_id, cliente:clientes(id, razon_social, nombre_comercial)')
    .eq('share_token', token)
    .maybeSingle()

  if (!presupuesto || !presupuesto.cliente_id) notFound()
  const cliente = (presupuesto as any).cliente

  const [pres, peds] = await Promise.all([
    supabase
      .from('presupuestos')
      .select('id, numero, fecha, estado, total, share_token')
      .eq('cliente_id', presupuesto.cliente_id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('pedidos')
      .select('id, numero, fecha, estado, total, fecha_entrega_estimada')
      .eq('cliente_id', presupuesto.cliente_id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <TuriavalLogo size={40} className="rounded-lg" />
          <div>
            <div className="font-bold text-slate-900 tracking-tight">Turiaval</div>
            <div className="text-[10px] text-slate-500">Portal cliente · acceso seguro por enlace</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Hola, {cliente?.nombre_comercial ?? cliente?.razon_social}
          </h1>
          <p className="text-sm text-slate-600">
            Resumen de tus pedidos y presupuestos. Pulsa en cualquiera para ver detalle.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Tus pedidos ({peds.data?.length ?? 0})
            </CardTitle>
            <CardDescription>Trabajos en curso o entregados</CardDescription>
          </CardHeader>
          <CardContent>
            {(peds.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No tienes pedidos.</p>
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
              <FileText className="h-4 w-4" />
              Tus presupuestos ({pres.data?.length ?? 0})
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

        <p className="text-center text-[10px] text-slate-400 pt-4">
          Acceso seguro por enlace privado · Turiaval Lacados Industriales
        </p>
      </main>
    </div>
  )
}
