import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest } from 'next/server'

/**
 * Next.js 16 renombró `middleware` a `proxy`. Mantenemos la misma
 * lógica de delegación a Supabase Auth para refresh de sesión.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
