import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight } from 'lucide-react'
import { TuriavalLogo } from '@/components/branding/turiaval-logo'

export const dynamic = 'force-dynamic'

/**
 * /m — selector de operario para vista movil del taller.
 * Lista todos los operarios activos. Al pulsar, va a /m/operario/[id]
 * con su jornada y botones grandes de fichar/pausar.
 */
export default async function MobileSelectorOperario() {
  const supabase = await createClient()
  const { data: operarios } = await supabase
    .from('operarios')
    .select('id, nombre, rol, color')
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <header className="text-center py-6">
        <div className="inline-flex mb-3">
          <TuriavalLogo size={56} className="rounded-2xl" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Turiaval Taller</h1>
        <p className="text-sm text-slate-500">Selecciona tu nombre</p>
      </header>

      <div className="space-y-2">
        {(operarios ?? []).length === 0 && (
          <Card>
            <CardContent className="p-4 text-center text-sm text-slate-500">
              No hay operarios dados de alta. Pide al admin que los cree.
            </CardContent>
          </Card>
        )}
        {(operarios ?? []).map((op: any) => (
          <Link
            key={op.id}
            href={`/m/operario/${op.id}`}
            className="block"
          >
            <Card className="active:scale-95 transition-transform">
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow"
                  style={{ background: op.color ?? '#64748b' }}
                >
                  {op.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{op.nombre}</div>
                  <div className="text-xs text-slate-500">{op.rol}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-center text-[11px] text-slate-400 mt-8">
        Modo móvil para taller · sin sidebar · sin distracciones
      </p>
    </div>
  )
}
