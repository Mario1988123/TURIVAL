import { redirect } from 'next/navigation'

/**
 * /presupuestos/nuevo-v2 — consolidado dentro de /presupuestos/nuevo
 * el 25-abr-2026. Mantenemos este redirect solo para no romper enlaces
 * antiguos (bookmarks del navegador, emails enviados, etc.).
 */
export default async function NuevoV2Redirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = Object.entries(params)
    .filter(([, v]) => typeof v === 'string' && v.length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&')
  redirect(`/presupuestos/nuevo${qs ? `?${qs}` : ''}`)
}
