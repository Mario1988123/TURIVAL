import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * /api/backup — exporta TODA la BD operativa a JSON.
 *
 * Pensado para llamarse desde Vercel Cron (vercel.json) cada noche.
 * Devuelve un JSON con todas las tablas clave para que Mario pueda
 * descargarlo manualmente o un cron job externo lo guarde a S3/Drive.
 *
 * Auth: requiere header `x-backup-token` que coincida con
 * BACKUP_SECRET en variables de entorno. Si no está configurado,
 * acepta auth de Supabase (sesión admin).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TABLAS_BACKUP = [
  'configuracion_empresa',
  'clientes',
  'referencias_cliente',
  'productos',
  'categorias_pieza',
  'tarifas',
  'colores',
  'tratamientos',
  'materiales',
  'proveedores',
  'operarios',
  'ubicaciones',
  'procesos_catalogo',
  'config_tiempos_proceso',
  'presupuestos',
  'lineas_presupuesto',
  'pedidos',
  'lineas_pedido',
  'piezas',
  'tareas_produccion',
  'reservas_stock',
  'movimientos_stock',
  'movimientos_pieza',
  'albaranes',
  'lineas_albaran',
  'fichajes',
  'usuario_perfiles',
  'gantt_movimientos',
] as const

export async function GET(req: Request) {
  // Auth: token en header o sesión admin
  const tokenHeader = req.headers.get('x-backup-token')
  const tokenEnv = process.env.BACKUP_SECRET
  const conToken = !!tokenEnv && tokenHeader === tokenEnv

  if (!conToken) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    // Solo admin puede descargar backup completo
    const { data: perfil } = await supabase
      .from('usuario_perfiles').select('rol').eq('user_id', user.id).maybeSingle()
    if ((perfil as any)?.rol !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo admin' }, { status: 403 })
    }
  }

  const supabase = await createClient()
  const backup: Record<string, any[]> = {}
  const errors: Record<string, string> = {}

  for (const tabla of TABLAS_BACKUP) {
    try {
      const { data, error } = await supabase.from(tabla).select('*')
      if (error) {
        errors[tabla] = error.message
      } else {
        backup[tabla] = data ?? []
      }
    } catch (e: any) {
      errors[tabla] = e?.message ?? 'Error'
    }
  }

  const fecha = new Date().toISOString()
  const filename = `turiaval-backup-${fecha.slice(0, 10)}.json`

  return new NextResponse(
    JSON.stringify({
      version: 1,
      generado_en: fecha,
      tablas_count: Object.keys(backup).length,
      tablas_con_error: Object.keys(errors).length,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      data: backup,
    }, null, 2),
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    },
  )
}
