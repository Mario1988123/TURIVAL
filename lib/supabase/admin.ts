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
 *  - INSERT/UPDATE/DELETE saltando RLS (bootstrap admin propio).
 *
 * Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY (ya en .env.example).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) {
    throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL en variables de entorno.')
  }
  if (!key) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY en variables de entorno de Vercel. ' +
      'Añadirla en Supabase Dashboard > Settings > API > service_role (secret) y pegarla en Vercel > Settings > Environment Variables. Después haz Redeploy.',
    )
  }
  // Validación rápida: la key debe ser una JWT de aspecto razonable.
  if (!key.startsWith('eyJ') || key.length < 100) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY parece inválida (no es una JWT). Comprueba que has copiado la "service_role" y no la "anon", sin espacios ni saltos.',
    )
  }
  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
