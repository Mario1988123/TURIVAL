import { createClient } from '../supabase/client'

export interface CategoriaProducto {
  id: string
  nombre: string
  descripcion: string | null
  color: string
  orden: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface CategoriaProductoForm {
  nombre: string
  descripcion: string | null
  color: string
  orden: number
  activo: boolean
}

export async function listarCategoriasProducto(
  soloActivas = false
): Promise<CategoriaProducto[]> {
  const supabase = createClient()
  let q = supabase.from('categorias_producto').select('*').order('orden').order('nombre')
  if (soloActivas) q = q.eq('activo', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CategoriaProducto[]
}

export async function crearCategoriaProducto(
  datos: CategoriaProductoForm
): Promise<CategoriaProducto> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categorias_producto')
    .insert(datos)
    .select('*')
    .single()
  if (error) throw error
  return data as CategoriaProducto
}

export async function actualizarCategoriaProducto(
  id: string,
  cambios: Partial<CategoriaProductoForm>
): Promise<CategoriaProducto> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categorias_producto')
    .update(cambios)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as CategoriaProducto
}

export async function eliminarCategoriaProducto(id: string): Promise<void> {
  const supabase = createClient()
  // El ON DELETE SET NULL ya se encarga de los productos vinculados
  const { error } = await supabase
    .from('categorias_producto')
    .delete()
    .eq('id', id)
  if (error) throw error
}
