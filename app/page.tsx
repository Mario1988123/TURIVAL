'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAuth() {
      console.log('[v0] Checking auth session...')
      try {
        const {
          data: { session },
          error
        } = await supabase.auth.getSession()
        
        console.log('[v0] Session result:', session ? 'authenticated' : 'no session', error)

        if (session) {
          router.push('/dashboard')
        } else {
          router.push('/auth/login')
        }
      } catch (err) {
        console.error('[v0] Auth error:', err)
        router.push('/auth/login')
      }
    }

    checkAuth()
  }, [router, supabase])

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
    </div>
  )
}
