'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, Download, Loader2 } from 'lucide-react'

export default function BotonBackup() {
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function descargar() {
    setDescargando(true)
    setError(null)
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`HTTP ${res.status}: ${txt}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `turiaval-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message ?? 'Error descargando backup')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" />
            Backup completo de la base de datos
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Descarga un JSON con todas las tablas operativas: clientes, presupuestos,
            pedidos, piezas, tareas, albaranes, fichajes, etc. Útil para guardar
            copia local antes de cambios grandes.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Programado automático: <code className="font-mono">/api/backup</code> a las 03:00 cada noche
            (requiere Vercel Pro y <code>BACKUP_SECRET</code> en env).
          </p>
        </div>
        <Button onClick={descargar} disabled={descargando}>
          {descargando ? (
            <span className="flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Generando…</span>
          ) : (
            <span className="flex items-center gap-1"><Download className="h-4 w-4" /> Descargar ahora</span>
          )}
        </Button>
        {error && <div className="w-full text-xs text-red-600">{error}</div>}
      </CardContent>
    </Card>
  )
}
