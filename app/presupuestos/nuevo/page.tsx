import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NuevoPresupuestoCliente from '@/components/presupuestos/nuevo-presupuesto-cliente'

export const dynamic = 'force-dynamic'

export default async function NuevoPresupuestoPage() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Cargar catálogos
  const [
    clientesRes,
    productosRes,
    coloresRes,
    tratamientosRes,
    tarifasRes,
    nivelesRes,
  ] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nombre_comercial, razon_social, cif, email, telefono, direccion, ciudad')
      .order('nombre_comercial')
      .range(0, 4999),
    supabase
      .from('productos')
      .select('*')
      .order('nombre'),
    supabase
      .from('colores')
      .select('id, codigo, nombre, tipo, hex_aproximado, sobrecoste, activo')
      .eq('activo', true)
      .order('codigo')
      .range(0, 4999),
    supabase
      .from('tratamientos')
      .select('*')
      .order('nombre'),
    supabase
      .from('tarifas')
      .select('*')
      .range(0, 999),
    supabase
      .from('niveles_complejidad')
      .select('*')
      .eq('activo', true)
      .order('orden'),
  ])

  return (
    <NuevoPresupuestoCliente
      clientes={clientesRes.data ?? []}
      productos={productosRes.data ?? []}
      colores={coloresRes.data ?? []}
      tratamientos={tratamientosRes.data ?? []}
      tarifas={tarifasRes.data ?? []}
      niveles={nivelesRes.data ?? []}
    />
  )
}
