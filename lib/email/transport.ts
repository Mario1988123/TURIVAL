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
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  })
  return transporterCache
}

export async function enviarEmail(payload: EmailPayload): Promise<EmailEnviado> {
  if (!tieneConfig()) {
    console.warn('[email] SMTP no configurado. Stub:', payload.to, '·', payload.subject)
    return { ok: true, stub: true }
  }
  try {
    const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!
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
    console.error('[email] Error envío:', msg)
    return { ok: false, error: msg }
  }
}

export function smtpDisponible(): boolean {
  return tieneConfig()
}
