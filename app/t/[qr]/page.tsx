import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PiezaPublica from './pieza-publica'

export const dynamic = 'force-dynamic'

/**
 * Ruta pública: /t/[qr]
 * Accesible sin login (GRANT EXECUTE a anon en la RPC).
 * Se usa al escanear el QR físico de una pieza.
 */
export default async function PiezaPublicaPage({
  params,
}: {
  params: Promise<{ qr: string }>
}) {
  const { qr } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('obtener_pieza_publica', {
    p_qr: qr,
  })

  if (error) {
    console.error('[/t/[qr]] Error RPC:', error.message)
    notFound()
  }

  const payload = data as any
  if (!payload || !payload.pieza) notFound()

  return <PiezaPublica data={payload} />
}
