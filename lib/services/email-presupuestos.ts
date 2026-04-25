// lib/services/email-presupuestos.ts
/**
 * Envío de presupuesto por email al cliente.
 *
 * Flujo:
 *   1. Carga presupuesto + cliente + configuracion_empresa.
 *   2. Renderiza plantilla HTML/texto en español.
 *   3. Envía vía lib/email/transport.
 *   4. Si SMTP no está configurado, queda como STUB (no envía, no rompe).
 */

import { createClient } from '@/lib/supabase/server'
import { enviarEmail, smtpDisponible, type EmailEnviado } from '@/lib/email/transport'
import { renderPresupuestoHTML, type EmisorEmail } from '@/lib/email/plantillas'
import { obtenerConfiguracionEmpresa } from './configuracion'

export interface ResultadoEnvioPresupuesto {
  ok: boolean
  stub?: boolean
  email_destino?: string
  message_id?: string
  error?: string
  smtp_configurado: boolean
}

export async function enviarPresupuestoPorEmail(params: {
  presupuesto_id: string
  email_destino?: string           // override; si no, se usa clientes.email
  mensaje_personal?: string
}): Promise<ResultadoEnvioPresupuesto> {
  const supabase = await createClient()
  const conf = await obtenerConfiguracionEmpresa().catch(() => null)

  const { data: pres, error: errP } = await supabase
    .from('presupuestos')
    .select(`
      id, numero, total, validez_dias, share_token, cliente_id,
      cliente:clientes(nombre_comercial, email)
    `)
    .eq('id', params.presupuesto_id)
    .single()
  if (errP || !pres) return { ok: false, error: errP?.message ?? 'presupuesto no encontrado', smtp_configurado: smtpDisponible() }

  const cli: any = Array.isArray((pres as any).cliente) ? (pres as any).cliente[0] : (pres as any).cliente
  const emailDestino = params.email_destino ?? cli?.email
  if (!emailDestino) {
    return { ok: false, error: 'El cliente no tiene email. Añade un email o indica uno manualmente.', smtp_configurado: smtpDisponible() }
  }

  const emisor: EmisorEmail = {
    nombre: conf?.razon_social || conf?.nombre_comercial || 'Turiaval',
    cif: conf?.cif_nif ?? null,
    direccion: conf?.direccion ?? null,
    ciudad: [conf?.codigo_postal, conf?.ciudad, conf?.provincia].filter(Boolean).join(' · ') || null,
    telefono: conf?.telefono ?? null,
    email: conf?.email ?? null,
    web: conf?.web ?? null,
    logo_url: conf?.logo_url ?? null,
  }

  // URL pública si hay share_token
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const urlPublica = (pres as any).share_token && baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/p/${(pres as any).share_token}`
    : undefined

  const { html, text, subject } = renderPresupuestoHTML({
    emisor,
    cliente_nombre: cli?.nombre_comercial ?? 'cliente',
    presupuesto_numero: (pres as any).numero,
    presupuesto_total: Number((pres as any).total ?? 0),
    validez_dias: Number((pres as any).validez_dias ?? 30),
    url_publica: urlPublica,
    mensaje_personal: params.mensaje_personal,
  })

  const r: EmailEnviado = await enviarEmail({
    to: emailDestino,
    subject,
    html,
    text,
    replyTo: conf?.email ?? undefined,
  })

  if (!r.ok) {
    return { ok: false, error: r.error, email_destino: emailDestino, smtp_configurado: smtpDisponible() }
  }

  // Si se envió de verdad, marcar el presupuesto como 'enviado' (si estaba borrador)
  if (!r.stub) {
    await supabase
      .from('presupuestos')
      .update({ estado: 'enviado', updated_at: new Date().toISOString() })
      .eq('id', params.presupuesto_id)
      .eq('estado', 'borrador')
  }

  return {
    ok: true,
    stub: r.stub,
    message_id: r.messageId,
    email_destino: emailDestino,
    smtp_configurado: smtpDisponible(),
  }
}
