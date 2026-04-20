import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ESTADOS: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  aceptado: { label: 'Aceptado', color: 'bg-green-100 text-green-700 border-green-300' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700 border-red-300' },
  caducado: { label: 'Caducado', color: 'bg-amber-100 text-amber-700 border-amber-300' },
}

const euro = (n: number) =>
  Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

function fechaES(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function fechaValidez(fecha: string, dias: number) {
  try {
    const d = new Date(fecha)
    d.setDate(d.getDate() + (dias || 30))
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export default async function PresupuestosPage() {
  const supabase = await createClient()

  const { data: presupuestos, error } = await supabase
    .from('presupuestos')
    .select(
      `
      id,
      numero,
      fecha,
      validez_dias,
      estado,
      total,
      cliente:clientes(nombre_comercial)
    `
    )
    .order('fecha', { ascending: false })
    .order('numero', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[presupuestos] Error cargando lista:', error)
  }

  const lista = presupuestos ?? []

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Presupuestos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lista.length} {lista.length === 1 ? 'presupuesto' : 'presupuestos'}
          </p>
        </div>
        <Link
          href="/presupuestos/nuevo"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
        >
          + Nuevo presupuesto
        </Link>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Número</th>
              <th className="text-left px-4 py-3 font-semibold">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold">Válido hasta</th>
              <th className="text-left px-4 py-3 font-semibold">Estado</th>
              <th className="text-right px-4 py-3 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Aún no hay presupuestos. Pulsa "Nuevo presupuesto" para crear el primero.
                </td>
              </tr>
            ) : (
              lista.map((p: any) => {
                const estado = ESTADOS[p.estado] ?? ESTADOS.borrador
                const cliente = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
                return (
                  <tr
                    key={p.id}
                    className="border-b hover:bg-slate-50 transition"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/presupuestos/${p.id}`}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {p.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fechaES(p.fecha)}
                    </td>
                    <td className="px-4 py-3">
                      {cliente?.nombre_comercial ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fechaValidez(p.fecha, p.validez_dias)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${estado.color}`}
                      >
                        {estado.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {euro(Number(p.total ?? 0))}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
