import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { pedidoId } = await request.json()

    if (!pedidoId) {
      return NextResponse.json(
        { error: 'Pedido ID is required' },
        { status: 400 }
      )
    }

    // Get pedido data
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('*, lineas_pedido(*)')
      .eq('id', pedidoId)
      .single()

    if (!pedido) {
      return NextResponse.json(
        { error: 'Pedido not found' },
        { status: 404 }
      )
    }

    if (pedido.estado !== 'en_produccion') {
      return NextResponse.json(
        { error: 'Pedido debe estar en producción' },
        { status: 400 }
      )
    }

    // Create lote
    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .insert({
        numero: `LOT-${Date.now()}`,
        pedido_id: pedidoId,
        estado: 'en_produccion',
        cantidad_total: pedido.lineas_pedido.reduce(
          (sum: number, l: any) => sum + l.cantidad,
          0
        ),
      })
      .select()
      .single()

    if (loteError) {
      return NextResponse.json(
        { error: 'Error creating lote: ' + loteError.message },
        { status: 400 }
      )
    }

    // Create piezas for each line
    let piezasCreadas = 0
    for (const linea of pedido.lineas_pedido) {
      for (let i = 0; i < linea.cantidad; i++) {
        const { error: piezaError } = await supabase
          .from('piezas')
          .insert({
            lote_id: lote.id,
            linea_pedido_id: linea.id,
            codigo_unico: `${lote.numero}-${linea.producto_id}-${i + 1}`,
            codigo_qr: `QR-${Date.now()}-${i}`,
            estado: 'pendiente',
          })

        if (!piezaError) {
          piezasCreadas++
        }
      }
    }

    return NextResponse.json({
      success: true,
      lote: lote,
      piezasCreadas,
      message: `Lote created with ${piezasCreadas} pieces`,
    })
  } catch (error) {
    console.error('Error in lotes API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
