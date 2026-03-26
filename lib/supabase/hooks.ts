import { createClient as createBrowserClient } from '@supabase/ssr'
import { createClient as createServerClient } from '@supabase/ssr'
import type { Database } from './schema'

export function useSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createSupabaseServerClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return undefined
        },
        set(name: string, value: string, options: any) {},
        remove(name: string, options: any) {},
      },
    }
  )
}
