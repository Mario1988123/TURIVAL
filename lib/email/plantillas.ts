// lib/email/plantillas.ts
/**
 * Plantillas HTML de emails en español. Diseño sobrio:
 *   - Cabecera con nombre/razón social del emisor.
 *   - Cuerpo personalizable.
 *   - Pie con datos de contacto.
 *
 * Inline CSS (muchos clientes de correo ignoran <style>). Sin imágenes
 * externas (el logo se pasa por URL directa si lo hay).
 */

export interface EmisorEmail {
  nombre: string
  cif: string | null
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  email: string | null
  web: string | null
  logo_url: string | null
}

export interface PlantillaPresupuestoParams {
  emisor: EmisorEmail
  cliente_nombre: string
  presupuesto_numero: string
  presupuesto_total: number
  validez_dias: number
  url_publica?: string   // /p/[token] si aplica
  mensaje_personal?: string
}

function escapar(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderPresupuestoHTML(p: PlantillaPresupuestoParams): { html: string; text: string; subject: string } {
  const total = p.presupuesto_total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
  const subject = `Presupuesto ${p.presupuesto_numero} · ${p.emisor.nombre}`

  const mensajePersonal = p.mensaje_personal
    ? `<p style="margin:16px 0;color:#1f2937;line-height:1.5">${escapar(p.mensaje_personal)}</p>`
    : ''

  const enlacePublico = p.url_publica
    ? `<p style="margin:16px 0"><a href="${escapar(p.url_publica)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Ver presupuesto online</a></p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escapar(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background:#f1f5f9">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" cellspacing="0" cellpadding="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e5e7eb">
          ${p.emisor.logo_url ? `<img src="${escapar(p.emisor.logo_url)}" alt="${escapar(p.emisor.nombre)}" style="max-height:48px;width:auto;display:block;margin-bottom:8px">` : ''}
          <div style="font-size:18px;font-weight:bold;color:#111827">${escapar(p.emisor.nombre)}</div>
          ${p.emisor.cif ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">CIF ${escapar(p.emisor.cif)}</div>` : ''}
        </td></tr>
        <tr><td style="padding:24px 28px">
          <h1 style="margin:0 0 8px 0;font-size:22px;color:#111827">Presupuesto ${escapar(p.presupuesto_numero)}</h1>
          <p style="margin:0 0 16px 0;color:#4b5563">Hola ${escapar(p.cliente_nombre)},</p>
          <p style="margin:0 0 16px 0;color:#374151;line-height:1.5">Te adjuntamos el presupuesto solicitado por un importe total de <strong>${total}</strong> con validez de ${p.validez_dias} días.</p>
          ${mensajePersonal}
          ${enlacePublico}
          <p style="margin:24px 0 0 0;color:#6b7280;font-size:13px">Cualquier duda o consulta, responde a este correo o llámanos al ${escapar(p.emisor.telefono ?? '')}.</p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
          <div style="font-weight:600;color:#374151">${escapar(p.emisor.nombre)}</div>
          ${p.emisor.direccion ? `<div>${escapar(p.emisor.direccion)}</div>` : ''}
          ${p.emisor.ciudad ? `<div>${escapar(p.emisor.ciudad)}</div>` : ''}
          ${p.emisor.telefono ? `<div>Tel. ${escapar(p.emisor.telefono)}</div>` : ''}
          ${p.emisor.email ? `<div>${escapar(p.emisor.email)}</div>` : ''}
          ${p.emisor.web ? `<div>${escapar(p.emisor.web)}</div>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = [
    `Presupuesto ${p.presupuesto_numero} · ${p.emisor.nombre}`,
    '',
    `Hola ${p.cliente_nombre},`,
    '',
    `Te adjuntamos el presupuesto solicitado por un importe total de ${total} con validez de ${p.validez_dias} días.`,
    '',
    p.mensaje_personal ?? '',
    p.url_publica ? `Ver online: ${p.url_publica}` : '',
    '',
    `${p.emisor.nombre}`,
    p.emisor.telefono ? `Tel. ${p.emisor.telefono}` : '',
    p.emisor.email ?? '',
  ].filter(Boolean).join('\n')

  return { html, text, subject }
}
