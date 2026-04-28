'use client'

/**
 * MenuUsuario — avatar + dropdown reutilizable para todos los headers del CRM
 * y portal cliente. Antes vivía dentro de app-sidebar.tsx; lo extraje porque
 * /cliente y otras rutas con header propio también lo necesitan.
 *
 * - Si esAdmin=true muestra "Usuarios y roles", "Configuración", "Operarios".
 * - Para roles no-admin (operario o cliente externo) solo muestra "Cerrar sesión".
 */

import { useState } from 'react'
import Link from 'next/link'
import type { Profile } from '@/lib/types/erp'

interface Props {
  user: Profile | null
  onLogout: () => void
  esAdmin?: boolean
}

export default function MenuUsuario({ user, onLogout, esAdmin = false }: Props) {
  const [abierto, setAbierto] = useState(false)
  const inicial = (user?.nombre ?? 'U').charAt(0).toUpperCase()
  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(v => !v)}
        className="flex items-center gap-2 rounded-md hover:bg-slate-100 px-2 py-1"
        aria-label="Menú de usuario"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white flex items-center justify-center text-sm font-semibold">
          {inicial}
        </div>
        <div className="hidden md:flex flex-col items-start">
          <span className="text-xs font-medium text-slate-700 leading-tight max-w-[120px] truncate">
            {user?.nombre ?? 'Usuario'}
          </span>
          {user?.rol && (
            <span className="text-[10px] uppercase tracking-wide text-slate-500">{user.rol}</span>
          )}
        </div>
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border bg-white shadow-lg py-1 text-sm">
            <div className="px-3 py-2 border-b">
              <div className="font-medium truncate">{user?.nombre ?? 'Usuario'}</div>
              <div className="text-xs text-slate-500 capitalize">{user?.rol ?? '—'}</div>
            </div>
            {esAdmin && (
              <>
                <Link href="/configuracion/usuarios" onClick={() => setAbierto(false)} className="block px-3 py-2 hover:bg-blue-50">
                  👥 Usuarios y roles
                </Link>
                <Link href="/configuracion" onClick={() => setAbierto(false)} className="block px-3 py-2 hover:bg-blue-50">
                  ⚙️ Configuración
                </Link>
                <Link href="/configuracion/operarios" onClick={() => setAbierto(false)} className="block px-3 py-2 hover:bg-blue-50">
                  🧑‍🏭 Operarios
                </Link>
              </>
            )}
            <button
              onClick={() => { setAbierto(false); onLogout() }}
              className={`w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 ${esAdmin ? 'border-t' : ''}`}
            >
              ⏏ Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}
