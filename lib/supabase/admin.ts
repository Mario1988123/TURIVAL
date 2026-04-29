import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service_role key.
 *
 * IMPORTANTE: este cliente SOLO debe usarse desde código server (Server
 * Actions, route handlers, RSC). Nunca importar desde Client Components
 * porque expondría la service_role al navegador.
 *
 * Usado para operaciones privilegiadas:
 *  - auth.admin.createUser / deleteUser / listUsers
 *  - auth.admin.updateUserById (cambiar password, etc.)
 *
 * Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY (ya presente
 * en .env.example).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en variables de entorno. ' +
      'Configurarlas en Vercel para poder crear usuarios desde el CRM.',
    )
  }
  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
