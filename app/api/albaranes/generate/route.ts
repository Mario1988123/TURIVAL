import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { piezaIds } = await request.json()

    if (!piezaIds || piezaIds.length === 0) {
      return NextResponse.json(
        { error: 'No piece IDs provided' },
        { status: 400 }
      )
    }

    // Get pieces data
    const { data: piezas } = await supabase
      .from('piezas')
      .select('*, lotes(pedidos(cliente_id))')
      .in('id', piezaIds)
      .eq('estado', 'completada')

    if (!piezas || piezas.length === 0) {
      return NextResponse.json(
        { error: 'No completed pieces found' },
        { status: 400 }
      )
    }

    // Group piezas by pedido for albaranes
    const albaranesPorPedido = new Map()

    for (const pieza of piezas) {
      // For each piece, check if it belongs to a pedido
      const { data: pedidoLine } = await supabase
        .from('lineas_pedido')
        .select('pedido_id')
        .eq('id', pieza.linea_pedido_id)
        .single()

      if (pedidoLine) {
        if (!albaranesPorPedido.has(pedidoLine.pedido_id)) {
          albaranesPorPedido.set(pedidoLine.pedido_id, [])
        }
        albaranesPorPedido.get(pedidoLine.pedido_id).push(pieza)
      }
    }

    // Create albaranes
    const albaranes = []
    for (const [pedidoId, piezasDelPedido] of albaranesPorPedido) {
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('numero, cliente_id, total')
        .eq('id', pedidoId)
        .single()

      if (pedido) {
        const { data: albaran, error: albaranError } = await supabase
          .from('albaranes')
          .insert({
            numero: `ALB-${Date.now()}`,
            pedido_id: pedidoId,
            cliente_id: pedido.cliente_id,
            estado: 'pendiente',
            total: pedido.total,
          })
          .select()
          .single()

        if (albaranError) {
          console.error('Error creating albaran:', albaranError)
          continue
        }

        if (albaran) {
          // Add piezas to albaran lines
          for (const pieza of piezasDelPedido) {
            await supabase.from('lineas_albaran').insert({
              albaran_id: albaran.id,
              pieza_id: pieza.id,
              cantidad: 1,
            })
          }

          albaranes.push(albaran)
        }
      }
    }

    return NextResponse.json({
      success: true,
      albaranes: albaranes.length,
      message: `${albaranes.length} albaranes created successfully`,
    })
  } catch (error) {
    console.error('Error in albaranes API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
