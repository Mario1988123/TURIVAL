import { redirect } from 'next/navigation'

/**
 * /presupuestos/nuevo — UNIFICADO con /presupuestos/nuevo-v2 el 25-abr-2026.
 *
 * El flujo clásico se retira porque generaba pedidos zombie al no persistir
 * `procesos_codigos`. Todo presupuesto nuevo pasa ahora por el flujo ERP v2.
 *
 * Los searchParams (ej. ?cliente=XXX) se propagan al destino.
 */
export default async function PresupuestosNuevoLegacy({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = Object.entries(params)
    .filter(([, v]) => typeof v === 'string' && v.length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&')
  redirect(`/presupuestos/nuevo-v2${qs ? `?${qs}` : ''}`)
}
