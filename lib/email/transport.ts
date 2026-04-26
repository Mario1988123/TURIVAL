// lib/email/transport.ts
/**
 * Transporte SMTP centralizado.
 *
 * Configuración por variables de entorno:
 *   SMTP_HOST       (ej. smtp.ionos.es)
 *   SMTP_PORT       (587 para STARTTLS, 465 para SSL)
 *   SMTP_USER       (ej. presupuestos@turival.es)
 *   SMTP_PASS       (contraseña o app password)
 *   SMTP_FROM       (opcional, si diferente de SMTP_USER: "Turiaval <presupuestos@turival.es>")
 *   SMTP_SECURE     ('true' para puerto 465; default false con STARTTLS en 587)
 *
 * Si falta alguna variable crítica el módulo funciona en MODO STUB: no
 * envía nada, solo loguea el email en consola y devuelve { ok: true, stub: true }.
 * Esto permite desarrollar la UI antes de que Mario configure IONOS.
 */

import nodemailer from 'nodemailer'

export interface EmailEnviado {
  ok: boolean
  stub?: boolean
  messageId?: string
  error?: string
}

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
  /** Adjuntos opcionales (ej. PDF del presupuesto). */
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>
  replyTo?: string
}

function tieneConfig(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

let transporterCache: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (transporterCache) return transporterCache
  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = process.env.SMTP_SECURE === 'true' || port === 465
  transporterCache = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    secure,
    pool: true,            // mantener conexión abierta para envíos seguidos
    maxConnections: 3,
    maxMessages: 50,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  })
  return transporterCache
}

/**
 * Envia un email con reintentos automáticos en caso de error transitorio
 * (ECONNRESET, EAI_AGAIN, ETIMEDOUT). Hasta 3 intentos con backoff 2s/4s.
 */
export async function enviarEmail(payload: EmailPayload): Promise<EmailEnviado> {
  if (!tieneConfig()) {
    console.warn('[email] SMTP no configurado. Stub:', payload.to, '·', payload.subject)
    return { ok: true, stub: true }
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!
  let ultimoError = ''
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const info = await getTransporter().sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        attachments: payload.attachments,
        replyTo: payload.replyTo,
      })
      return { ok: true, messageId: info.messageId }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido SMTP'
      ultimoError = msg
      const transient = /ECONNRESET|EAI_AGAIN|ETIMEDOUT|ENOTFOUND/.test(msg)
      console.warn(`[email] intento ${intento}/3 falló:`, msg)
      if (!transient || intento === 3) break
      await new Promise((r) => setTimeout(r, 2000 * intento))
    }
  }
  console.error('[email] Error envío tras 3 intentos:', ultimoError)
  return { ok: false, error: ultimoError }
}

/**
 * Verifica conectividad SMTP sin enviar email real. Útil para
 * diagnostico desde /configuracion.
 */
export async function verificarSmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!tieneConfig()) return { ok: false, error: 'Variables SMTP no configuradas' }
  try {
    await getTransporter().verify()
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export function smtpDisponible(): boolean {
  return tieneConfig()
}
