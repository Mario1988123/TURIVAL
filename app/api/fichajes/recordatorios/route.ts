import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notificarEntrada, notificarSalida } from '@/lib/push/web-push'

/**
 * Cron de recordatorios de fichaje.
 *
 * Llamada esperada cada 5 minutos (cron-job.org, GitHub Action o
 * Vercel Pro cron). Auth: header x-backup-token === BACKUP_SECRET.
 *
 * Lógica:
 *   - Lee horarios_operario para hoy (dia_semana actual).
 *   - Para cada operario con horario:
 *       · Si AHORA está dentro de [hora_entrada - X, hora_entrada]
 *         con X ∈ {15, 5}, envía push/email "te quedan Xmin para fichar".
 *       · Idem con hora_salida.
 *   - Idempotente: evita duplicados con tabla recordatorios_fichaje_log.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VENTANAS_MIN = [15, 5]   // minutos antes
const TOLERANCIA_MIN = 4       // ±4 min de tolerancia para que el cron no falle si llega tarde

export async function GET(req: Request) {
  // Auth
  const tokenEnv = process.env.BACKUP_SECRET
  const tokenHeader = req.headers.get('x-backup-token')
  if (!tokenEnv || tokenHeader !== tokenEnv) {
    // En modo dev permitir sin token con ?dev=1
    const url = new URL(req.url)
    if (url.searchParams.get('dev') !== '1') {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  const supabase = await createClient()
  const ahora = new Date()
  const dow = ahora.getDay()
  const fechaIso = ahora.toISOString().slice(0, 10)
  const horaActualMin = ahora.getHours() * 60 + ahora.getMinutes()

  // Si es festivo, no avisar
  const { data: festivos } = await supabase
    .from('festivos')
    .select('id')
    .eq('fecha', fechaIso)
  if ((festivos ?? []).length > 0) {
    return NextResponse.json({ ok: true, mensaje: 'Festivo, sin recordatorios' })
  }

  // Horarios del día
  const { data: horarios } = await supabase
    .from('horarios_operario')
    .select('operario_id, hora_entrada, hora_salida, activo')
    .eq('dia_semana', dow)
    .eq('activo', true)

  const enviados: Array<{ operario_id: string; tipo: string; minutos_antes: number }> = []

  for (const h of (horarios ?? []) as any[]) {
    // Operario con ausencia ese día? saltar
    const { data: aus } = await supabase
      .from('ausencias')
      .select('id')
      .eq('operario_id', h.operario_id)
      .lte('fecha_inicio', fechaIso)
      .gte('fecha_fin', fechaIso)
      .limit(1)
    if ((aus ?? []).length > 0) continue

    const horaEntradaMin = horaToMin(h.hora_entrada)
    const horaSalidaMin = horaToMin(h.hora_salida)

    for (const min of VENTANAS_MIN) {
      // ENTRADA: NOW ∈ [hora_entrada - min - tol, hora_entrada - min + tol]
      const objEntrada = horaEntradaMin - min
      if (Math.abs(horaActualMin - objEntrada) <= TOLERANCIA_MIN) {
        if (await yaEnviado(supabase, h.operario_id, fechaIso, 'aviso_entrada', min)) continue
        // Si ya fichó entrada hoy, saltar
        if (await yaFicho(supabase, h.operario_id, fechaIso, 'entrada')) continue
        try {
          await notificarEntrada(h.operario_id, min)
          await registrarLog(supabase, h.operario_id, fechaIso, 'aviso_entrada', min, 'ambos')
          enviados.push({ operario_id: h.operario_id, tipo: 'entrada', minutos_antes: min })
        } catch (e: any) {
          await registrarLog(supabase, h.operario_id, fechaIso, 'aviso_entrada', min, 'ambos', false, e?.message)
        }
      }

      // SALIDA
      const objSalida = horaSalidaMin - min
      if (Math.abs(horaActualMin - objSalida) <= TOLERANCIA_MIN) {
        if (await yaEnviado(supabase, h.operario_id, fechaIso, 'aviso_salida', min)) continue
        if (await yaFicho(supabase, h.operario_id, fechaIso, 'salida')) continue
        try {
          await notificarSalida(h.operario_id, min)
          await registrarLog(supabase, h.operario_id, fechaIso, 'aviso_salida', min, 'ambos')
          enviados.push({ operario_id: h.operario_id, tipo: 'salida', minutos_antes: min })
        } catch (e: any) {
          await registrarLog(supabase, h.operario_id, fechaIso, 'aviso_salida', min, 'ambos', false, e?.message)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, enviados, total: enviados.length })
}

function horaToMin(h: string): number {
  const [hh, mm] = h.split(':').map(Number)
  return hh * 60 + (mm || 0)
}
async function yaEnviado(supabase: any, opId: string, fecha: string, tipo: string, min: number): Promise<boolean> {
  const { data } = await supabase
    .from('recordatorios_fichaje_log')
    .select('id')
    .eq('operario_id', opId)
    .eq('fecha', fecha)
    .eq('tipo', tipo)
    .eq('minutos_antes', min)
    .maybeSingle()
  return !!data
}
async function yaFicho(supabase: any, opId: string, fecha: string, tipo: 'entrada' | 'salida'): Promise<boolean> {
  const { data } = await supabase
    .from('fichajes')
    .select('id')
    .eq('operario_id', opId)
    .eq('tipo', tipo)
    .gte('ocurrido_en', `${fecha}T00:00:00Z`)
    .lte('ocurrido_en', `${fecha}T23:59:59Z`)
    .limit(1)
  return ((data ?? []) as any[]).length > 0
}
async function registrarLog(supabase: any, opId: string, fecha: string, tipo: string, min: number, canal: string, exito = true, detalle?: string) {
  await supabase.from('recordatorios_fichaje_log').insert({
    operario_id: opId, fecha, tipo, minutos_antes: min, canal, exito, detalle: detalle ?? null,
  })
}
