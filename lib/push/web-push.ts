/**
 * Web Push helpers (server-only).
 *
 * Requiere variables de entorno:
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT  (mailto:tu@correo)
 *
 * Para generar las claves: npx web-push generate-vapid-keys
 */

import { createClient } from '@/lib/supabase/server'
import { enviarEmail } from '@/lib/email/transport'

// Import dinámico para no romper el build si la dep aún no está
// instalada en node_modules en tiempo de typecheck. En runtime, Vercel
// instala con pnpm install y el import funciona.
let webpushMod: any = null
async function getWebpush() {
  if (webpushMod) return webpushMod
  const m = await import('web-push')
  webpushMod = m.default ?? m
  return webpushMod
}

let configurado = false
async function asegurarConfig() {
  if (configurado) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@turival.es'
  if (!pub || !priv) {
    throw new Error('Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en variables de entorno')
  }
  const wp = await getWebpush()
  wp.setVapidDetails(subject, pub, priv)
  configurado = true
}

export interface PayloadPush {
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

export async function enviarPushAOperario(operarioId: string, payload: PayloadPush): Promise<{ enviadas: number; fallidas: number }> {
  try { await asegurarConfig() } catch (e) { console.warn('[push]', (e as Error).message); return { enviadas: 0, fallidas: 0 } }
  const wp = await getWebpush()
  const supabase = await createClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('operario_id', operarioId)
  let enviadas = 0
  let fallidas = 0
  for (const s of (subs ?? []) as any[]) {
    try {
      await wp.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      )
      enviadas++
      await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
    } catch (err: any) {
      fallidas++
      // Limpiar subscriptions caducadas
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
  }
  return { enviadas, fallidas }
}

export async function notificarEntrada(operarioId: string, minutosAntes: number): Promise<void> {
  const supabase = await createClient()
  const { data: op } = await supabase.from('operarios').select('nombre').eq('id', operarioId).maybeSingle()
  const nombre = (op as any)?.nombre ?? 'Operario'
  const payload: PayloadPush = {
    title: `Recordatorio entrada — ${nombre}`,
    body: `Te quedan ${minutosAntes} minutos para fichar tu entrada.`,
    url: '/m/operario',
    tag: `entrada-${operarioId}-${new Date().toISOString().slice(0, 10)}`,
    requireInteraction: true,
  }
  await enviarPushAOperario(operarioId, payload)
  await enviarEmailAOperarioSiCabe(operarioId, payload, supabase)
}

export async function notificarSalida(operarioId: string, minutosAntes: number): Promise<void> {
  const supabase = await createClient()
  const { data: op } = await supabase.from('operarios').select('nombre').eq('id', operarioId).maybeSingle()
  const nombre = (op as any)?.nombre ?? 'Operario'
  const payload: PayloadPush = {
    title: `Recordatorio salida — ${nombre}`,
    body: `Te quedan ${minutosAntes} minutos para tu hora de salida.`,
    url: '/m/operario',
    tag: `salida-${operarioId}-${new Date().toISOString().slice(0, 10)}`,
  }
  await enviarPushAOperario(operarioId, payload)
  await enviarEmailAOperarioSiCabe(operarioId, payload, supabase)
}

async function enviarEmailAOperarioSiCabe(operarioId: string, payload: PayloadPush, supabase: any) {
  // Si el operario tiene user_id y ese user tiene email, mandamos email también
  const { data: op } = await supabase
    .from('operarios')
    .select('user_id')
    .eq('id', operarioId)
    .maybeSingle()
  const userId = (op as any)?.user_id
  if (!userId) return
  const { data: { user } } = await supabase.auth.admin?.getUserById?.(userId) ?? { data: { user: null } }
  const email = user?.email
  if (!email) return
  // Comprobar si alguna subscription dice no-email (heurístico simple: si todas tienen recibe_email=false, no enviamos)
  const { data: subs } = await supabase.from('push_subscriptions').select('recibe_email').eq('operario_id', operarioId)
  const algunaConEmail = !subs || subs.length === 0 || (subs as any[]).some((s) => s.recibe_email !== false)
  if (!algunaConEmail) return
  await enviarEmail({
    to: email,
    subject: payload.title,
    html: `<p>${payload.body}</p><p>Abre <a href="${process.env.NEXT_PUBLIC_APP_URL ?? '#'}/m">la app</a> para fichar.</p>`,
    text: payload.body,
  }).catch(() => undefined)
}
