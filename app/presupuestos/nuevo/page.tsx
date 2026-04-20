import { createClient } from "@/lib/supabase/server"
import NuevoPresupuestoCliente from "@/components/presupuestos/nuevo-presupuesto-cliente"

export const dynamic = "force-dynamic"

export default async function NuevoPresupuestoPage() {
  const supabase = await createClient()

  const [
    { data: clientes },
    { data: productos },
    { data: colores },
    { data: tratamientos },
    { data: tarifas },
  ] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nombre, cif, email, telefono, direccion")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("productos")
      .select("id, nombre, descripcion, activo")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("colores")
      .select("id, codigo, nombre, familia, ral, activo")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("tratamientos")
      .select("id, nombre, descripcion, activo")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("tarifas")
      .select(
        "id, nombre, producto_id, color_id, tratamiento_id, precio_base, precio_m2, precio_minimo, suplemento, activo"
      )
      .eq("activo", true),
  ])

  return (
    <NuevoPresupuestoCliente
      clientes={clientes ?? []}
      productos={productos ?? []}
      colores={colores ?? []}
      tratamientos={tratamientos ?? []}
      tarifas={tarifas ?? []}
    />
  )
}
