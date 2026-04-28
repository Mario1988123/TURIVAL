import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/push/subscribe
 * body: { endpoint, keys: { p256dh, auth }, recibe_email? }
 *
 * Guarda la subscription del navegador del usuario actual y la
 * vincula al operario (si tiene operario.user_id = user_id).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'no auth' }, { status: 401 })

  const body = await req.json().catch(() => null) as any
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ ok: false, error: 'subscription invalida' }, { status: 400 })
  }

  // Buscar operario asociado a este user
  const { data: op } = await supabase
    .from('operarios')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const ua = req.headers.get('user-agent') ?? null
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      operario_id: (op as any)?.id ?? null,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_agent: ua,
      recibe_email: body.recibe_email !== false,
    }, { onConflict: 'endpoint' })
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'no auth' }, { status: 401 })

  const body = await req.json().catch(() => null) as any
  if (!body?.endpoint) return NextResponse.json({ ok: false, error: 'falta endpoint' }, { status: 400 })

  await supabase.from('push_subscriptions').delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
