'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export default function BotonActivarNotif() {
  const [estado, setEstado] = useState<'desconocido' | 'no_soportado' | 'denegado' | 'inactivo' | 'activo' | 'cargando'>('desconocido')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setEstado('no_soportado')
      return
    }
    if (Notification.permission === 'denied') {
      setEstado('denegado')
      return
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEstado(sub ? 'activo' : 'inactivo'))
      .catch(() => setEstado('inactivo'))
  }, [])

  async function activar() {
    if (!VAPID_PUBLIC) {
      alert('Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en variables de entorno.')
      return
    }
    setEstado('cargando')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado('denegado')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
      const json = sub.toJSON() as any
      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        alert('Error registrando: ' + (j.error ?? r.status))
        setEstado('inactivo')
        return
      }
      setEstado('activo')
    } catch (e: any) {
      alert('Error: ' + (e?.message ?? e))
      setEstado('inactivo')
    }
  }

  async function desactivar() {
    setEstado('cargando')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEstado('inactivo')
    } catch {
      setEstado('inactivo')
    }
  }

  if (estado === 'no_soportado') {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1">
        <BellOff className="h-3.5 w-3.5" /> Push no soportado
      </Button>
    )
  }
  if (estado === 'denegado') {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1 text-red-600">
        <BellOff className="h-3.5 w-3.5" /> Permisos denegados
      </Button>
    )
  }
  if (estado === 'activo') {
    return (
      <Button variant="outline" size="sm" onClick={desactivar} className="gap-1 text-emerald-700 border-emerald-300">
        <BellRing className="h-3.5 w-3.5" /> Avisos ON
      </Button>
    )
  }
  if (estado === 'cargando' || estado === 'desconocido') {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> …
      </Button>
    )
  }
  return (
    <Button variant="default" size="sm" onClick={activar} className="gap-1 bg-blue-600 hover:bg-blue-700">
      <Bell className="h-3.5 w-3.5" /> Activar avisos
    </Button>
  )
}
