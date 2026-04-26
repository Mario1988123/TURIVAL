import { NextResponse } from 'next/server'
import { verificarSmtp, enviarEmail, smtpDisponible } from '@/lib/email/transport'

/**
 * GET /api/email/test
 *   Verifica si SMTP responde (sin enviar email).
 *
 * POST /api/email/test  body { to: string }
 *   Envía un email de prueba a la direccion indicada.
 */
export async function GET() {
  const disponible = smtpDisponible()
  if (!disponible) {
    return NextResponse.json({ ok: false, configured: false, error: 'SMTP no configurado en variables de entorno' })
  }
  const v = await verificarSmtp()
  return NextResponse.json({ ok: v.ok, configured: true, error: v.error })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { to?: string } | null
  if (!body?.to) return NextResponse.json({ ok: false, error: 'Falta "to"' }, { status: 400 })
  const res = await enviarEmail({
    to: body.to,
    subject: 'Test SMTP Turiaval',
    html: `<p>Este es un email de prueba enviado desde el ERP Turiaval.</p>
           <p>Hora: ${new Date().toLocaleString('es-ES')}</p>`,
    text: 'Test SMTP Turiaval. Hora: ' + new Date().toLocaleString('es-ES'),
  })
  return NextResponse.json(res)
}
