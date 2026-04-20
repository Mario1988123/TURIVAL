import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import VistaPresupuestoCliente from "@/components/presupuestos/vista-presupuesto-cliente"
import { EMPRESA } from "@/lib/config/empresa"

export const dynamic = "force-dynamic"

export default async function PresupuestoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: presupuesto, error } = await supabase
    .from("presupuestos")
    .select(
      `
      id,
      numero,
      fecha,
      fecha_validez,
      fecha_entrega_estimada,
      estado,
      subtotal,
      iva,
      iva_pct,
      total,
      observaciones,
      cliente_id,
      clientes (
        id, nombre, cif, email, telefono, direccion
      )
    `
    )
    .eq("id", id)
    .single()

  if (error || !presupuesto) {
    notFound()
  }

  const { data: lineas } = await supabase
    .from("lineas_presupuesto")
    .select(
      `
      id,
      orden,
      descripcion,
      ancho,
      alto,
      grosor,
      caras,
      cantidad,
      superficie_m2,
      precio_unitario,
      descuento_pct,
      subtotal,
      nivel_complejidad,
      productos ( nombre ),
      colores ( nombre, ral ),
      tratamientos ( nombre )
    `
    )
    .eq("presupuesto_id", id)
    .order("orden")

  return (
    <VistaPresupuestoCliente
      presupuesto={presupuesto as any}
      lineas={(lineas as any) ?? []}
      empresa={EMPRESA}
    />
  )
}
