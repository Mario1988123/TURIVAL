import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { EMPRESA } from "@/lib/config/empresa"
import { renderToBuffer } from "@react-pdf/renderer"
import PresupuestoPDF from "@/components/presupuestos/presupuesto-pdf"
import React from "react"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: presupuesto, error } = await supabase
    .from("presupuestos")
    .select(
      `
      id, numero, fecha, fecha_validez, fecha_entrega_estimada,
      estado, subtotal, iva, iva_pct, total, observaciones,
      clientes ( id, nombre, cif, email, telefono, direccion )
    `
    )
    .eq("id", id)
    .single()

  if (error || !presupuesto) {
    return NextResponse.json(
      { error: "Presupuesto no encontrado" },
      { status: 404 }
    )
  }

  const { data: lineas } = await supabase
    .from("lineas_presupuesto")
    .select(
      `
      id, orden, descripcion,
      ancho, alto, grosor, caras, cantidad,
      superficie_m2, precio_unitario, descuento_pct, subtotal,
      productos ( nombre ),
      colores ( nombre, ral ),
      tratamientos ( nombre )
    `
    )
    .eq("presupuesto_id", id)
    .order("orden")

  const pdfBuffer = await renderToBuffer(
    React.createElement(PresupuestoPDF, {
      presupuesto: presupuesto as any,
      lineas: (lineas as any) ?? [],
      empresa: EMPRESA,
    })
  )

  const filename = `${presupuesto.numero}.pdf`

  return new NextResponse(pdfBuffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
