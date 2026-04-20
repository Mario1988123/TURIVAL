import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ProductoDetalleCliente from '@/components/productos/producto-detalle-cliente'

export const dynamic = 'force-dynamic'

export default async function ProductoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Cargar producto
  const { data: producto, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !producto) notFound()

  return <ProductoDetalleCliente productoInicial={producto} />
}
