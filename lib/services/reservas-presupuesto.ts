/**
 * Reservas de horas desde presupuesto SIN confirmar.
 *
 * Cuando Mario quiere "bloquear" tiempo en el taller para un presupuesto
 * que aun no es pedido, este servicio crea piezas + tareas en estado
 * tentativa=true. Aparecen en el Gantt difuminadas y NO impactan stock
 * ni reservas de material — solo ocupan tiempo.
 *
 * Al convertir el presupuesto en pedido, las tentativas se promueven
 * a tareas firmes (tentativa=false) y se asocian al pedido real.
 *
 * Si el presupuesto no se confirma, basta llamar a liberarReservasPresupuesto
 * para borrarlas y dejar el Gantt limpio.
 */

import { createClient } from '@/lib/supabase/server'
import { getProcesoDefault } from '@/lib/motor/procesos-defaults'

export interface ResultadoReservar {
  ok: boolean
  tareas_creadas: number
  pedido_borrador_id?: string
  error?: string
}

/**
 * Crea un pedido_borrador "fantasma" + piezas + tareas tentativas para
 * cada linea del presupuesto. Usamos un pedido oculto porque el modelo
 * actual de tareas_produccion exige pieza -> linea_pedido -> pedido.
 *
 * Convencion: el pedido borrador asociado tiene observaciones_internas
 * que empieza por "[RESERVA-TENTATIVA presupuesto_id]" para no confundirlo
 * con un pedido real.
 */
export async function reservarHorasDesdePresupuesto(
  presupuestoId: string,
): Promise<ResultadoReservar> {
  const supabase = await createClient()

  // 1) Cargar presupuesto + lineas
  const { data: presupuesto, error: errPre } = await supabase
    .from('presupuestos')
    .select(`
      id, numero, cliente_id,
      lineas:lineas_presupuesto(
        id, cantidad, descripcion, modo_precio,
        ancho, alto, grosor, longitud_ml,
        material_lacado_id, material_fondo_id,
        categoria_pieza_id, procesos_codigos
      )
    `)
    .eq('id', presupuestoId)
    .single()
  if (errPre || !presupuesto) {
    return { ok: false, tareas_creadas: 0, error: errPre?.message ?? 'Presupuesto no encontrado' }
  }

  // Si ya hay reserva, no duplicar.
  const { data: existente } = await supabase
    .from('pedidos')
    .select('id')
    .ilike('observaciones_internas', `[RESERVA-TENTATIVA ${presupuestoId}]%`)
    .maybeSingle()
  if (existente) {
    return { ok: false, tareas_creadas: 0, pedido_borrador_id: (existente as any).id, error: 'Este presupuesto ya tiene reserva. Liberala antes de crearla otra vez.' }
  }

  // 2) Crear pedido_borrador fantasma (numero generado pero observaciones marcadas)
  const { data: numData, error: numErr } = await supabase
    .rpc('generar_numero_secuencial', { p_tipo: 'pedido' })
  if (numErr) return { ok: false, tareas_creadas: 0, error: numErr.message }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, tareas_creadas: 0, error: 'No autenticado' }

  const { data: pedido, error: errPed } = await supabase
    .from('pedidos')
    .insert({
      numero: numData,
      fecha_creacion: new Date().toISOString().slice(0, 10),
      cliente_id: presupuesto.cliente_id,
      estado: 'borrador',
      presupuesto_origen_id: presupuesto.id,
      subtotal: 0, descuento_porcentaje: 0, descuento_importe: 0,
      base_imponible: 0, iva_porcentaje: 21, iva_importe: 0, total: 0,
      observaciones_internas: `[RESERVA-TENTATIVA ${presupuestoId}] No confundir con pedido real. Generado por el flujo "reservar horas desde presupuesto".`,
      user_id: user.id,
    })
    .select('id')
    .single()
  if (errPed || !pedido) return { ok: false, tareas_creadas: 0, error: errPed?.message }

  let tareasCreadas = 0

  // 3) Por cada linea, crear linea_pedido + UNA pieza representante + tareas
  for (let idx = 0; idx < ((presupuesto.lineas ?? []) as any[]).length; idx++) {
    const l = (presupuesto.lineas as any[])[idx]
    const cantidad = Math.max(1, Number(l.cantidad ?? 1))

    const { data: linPed, error: errLin } = await supabase
      .from('lineas_pedido')
      .insert({
        pedido_id: pedido.id,
        orden: idx + 1,
        cantidad,
        descripcion: l.descripcion,
        modo_precio: l.modo_precio,
        ancho: l.ancho, alto: l.alto, grosor: l.grosor,
        longitud_ml: l.longitud_ml,
        material_lacado_id: l.material_lacado_id,
        material_fondo_id: l.material_fondo_id,
        categoria_pieza_id: l.categoria_pieza_id,
        procesos_codigos: l.procesos_codigos,
        precio_unitario: 0,
        total_linea: 0,
      })
      .select('id')
      .single()
    if (errLin || !linPed) continue

    // UNA pieza representante por linea (regla "una tarea por linea")
    const { data: numPie } = await supabase.rpc('generar_numero_secuencial', { p_tipo: 'pieza' })
    const { data: pieza, error: errPie } = await supabase
      .from('piezas')
      .insert({
        numero: numPie,
        linea_pedido_id: linPed.id,
        ancho: l.ancho, alto: l.alto, grosor: l.grosor,
        longitud_ml: l.longitud_ml,
        material_lacado_id: l.material_lacado_id,
        material_fondo_id: l.material_fondo_id,
        categoria_pieza_id: l.categoria_pieza_id,
        estado: 'sin_producir',
      })
      .select('id')
      .single()
    if (errPie || !pieza) continue

    // Tareas tentativas a partir de procesos_codigos
    const codigos: string[] = Array.isArray(l.procesos_codigos) ? l.procesos_codigos : []
    if (codigos.length === 0) continue

    // Resolver IDs de procesos
    const { data: procesos } = await supabase
      .from('procesos_catalogo')
      .select('id, codigo')
      .in('codigo', codigos)
    const idPorCodigo = new Map<string, string>()
    for (const p of (procesos ?? []) as any[]) idPorCodigo.set(p.codigo, p.id)

    let secuencia = 1
    for (const codigo of codigos) {
      const procesoId = idPorCodigo.get(codigo)
      if (!procesoId) continue
      const def = getProcesoDefault(codigo)
      const sup = (l.modo_precio === 'm2' && l.ancho && l.alto)
        ? (Number(l.ancho) * Number(l.alto)) / 1_000_000
        : (l.modo_precio === 'ml' && l.longitud_ml ? Number(l.longitud_ml) / 100 : 1)
      const tiempo = Math.round(((def?.tiempo_base_min ?? 5) + (def?.tiempo_por_m2_min ?? 0) * sup))
      await supabase.from('tareas_produccion').insert({
        pieza_id: pieza.id,
        proceso_id: procesoId,
        secuencia,
        estado: 'pendiente',
        tiempo_estimado_minutos: tiempo,
        tentativa: true,
      })
      tareasCreadas++
      secuencia++
    }
  }

  // Mario punto: las tareas tentativas deben caer SOLAS en huecos, no
  // quedar como aviso "X tareas sin asignar". Disparamos autogenerar
  // restringido al pedido fantasma para que el motor las coloque.
  if (tareasCreadas > 0) {
    try {
      const { autogenerar } = await import('./planificador')
      await autogenerar({ pedido_id: pedido.id, dry_run: false })
    } catch (e) {
      console.warn('[reservar tentativas] autogenerar falló:', e)
    }
  }

  return { ok: true, tareas_creadas: tareasCreadas, pedido_borrador_id: pedido.id }
}

/**
 * Valida las reservas tentativas de un presupuesto: pone tentativa=false
 * a todas las tareas del pedido fantasma para que pasen a "firmes" en
 * el Gantt sin esperar a convertir el presupuesto en pedido real.
 *
 * Mario: "si le damos a validar, que se queden".
 */
export async function validarReservasTentativas(
  presupuestoId: string,
): Promise<{ ok: boolean; validadas: number; error?: string }> {
  const supabase = await createClient()
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id')
    .ilike('observaciones_internas', `[RESERVA-TENTATIVA ${presupuestoId}]%`)
    .maybeSingle()
  if (!pedido) return { ok: true, validadas: 0 }

  // Buscar tareas del pedido fantasma vía piezas
  const { data: lineasPed } = await supabase
    .from('lineas_pedido')
    .select('id, piezas:piezas(id)')
    .eq('pedido_id', (pedido as any).id)
  const piezasIds: string[] = []
  for (const lp of (lineasPed ?? []) as any[]) {
    for (const p of lp.piezas ?? []) piezasIds.push(p.id)
  }
  if (piezasIds.length === 0) return { ok: true, validadas: 0 }

  const { data: actualizadas, error } = await supabase
    .from('tareas_produccion')
    .update({ tentativa: false, updated_at: new Date().toISOString() })
    .in('pieza_id', piezasIds)
    .eq('tentativa', true)
    .select('id')
  if (error) return { ok: false, validadas: 0, error: error.message }
  return { ok: true, validadas: (actualizadas ?? []).length }
}

/**
 * Borra todas las tareas / piezas / lineas / pedido fantasma asociados
 * a la reserva del presupuesto. El presupuesto NO se toca.
 */
export async function liberarReservasPresupuesto(
  presupuestoId: string,
): Promise<{ ok: boolean; pedido_borrador_id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id')
    .ilike('observaciones_internas', `[RESERVA-TENTATIVA ${presupuestoId}]%`)
    .maybeSingle()
  if (!pedido) return { ok: true }

  const { error } = await supabase.from('pedidos').delete().eq('id', (pedido as any).id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, pedido_borrador_id: (pedido as any).id }
}

/**
 * Promueve las tareas tentativas a firmes (tentativa=false) cuando el
 * presupuesto se confirma como pedido real. Llamar dentro de
 * convertirPresupuestoAPedido despues de crear el pedido real.
 */
export async function promoverReservasAFirmes(
  presupuestoId: string,
  pedidoRealId: string,
): Promise<{ ok: boolean; promovidas: number; error?: string }> {
  const supabase = await createClient()
  // Marcar el pedido fantasma como "convertido" o borrarlo y mover sus tareas:
  // simplificacion v1 — borramos el pedido fantasma; las tareas firmes ya las
  // crea convertirPresupuestoAPedido por separado. Aqui solo limpiamos.
  const lib = await liberarReservasPresupuesto(presupuestoId)
  if (!lib.ok) return { ok: false, promovidas: 0, error: lib.error }
  return { ok: true, promovidas: 0 }
}
