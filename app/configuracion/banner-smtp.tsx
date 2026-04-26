'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, CheckCircle2, AlertTriangle, Send, Loader2 } from 'lucide-react'

export default function BannerSmtp({
  configurado,
  verificacion,
}: {
  configurado: boolean
  verificacion: { ok: boolean; error?: string } | null
}) {
  const [emailPrueba, setEmailPrueba] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; error?: string } | null>(null)

  async function probar() {
    if (!emailPrueba.trim()) return
    setEnviando(true)
    setResultado(null)
    try {
      const r = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailPrueba.trim() }),
      })
      const data = await r.json()
      setResultado(data)
    } catch (e: any) {
      setResultado({ ok: false, error: e?.message ?? 'Error red' })
    } finally {
      setEnviando(false)
    }
  }

  if (!configurado) {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <div className="font-semibold">SMTP no configurado</div>
            <p className="text-xs mt-1">
              Los envíos de email funcionan en modo stub (no salen). Configura
              en Vercel las variables: <code className="font-mono">SMTP_HOST</code>,{' '}
              <code className="font-mono">SMTP_PORT</code>,{' '}
              <code className="font-mono">SMTP_USER</code>,{' '}
              <code className="font-mono">SMTP_PASS</code>,{' '}
              <code className="font-mono">SMTP_FROM</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const verificadoOk = verificacion?.ok === true
  return (
    <Card className={verificadoOk ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}>
      <CardContent className="p-4 flex items-start gap-3">
        {verificadoOk ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${verificadoOk ? 'text-emerald-900' : 'text-red-900'}`}>
            <Mail className="inline h-4 w-4 mr-1" />
            SMTP {verificadoOk ? 'conectado' : 'con problemas'}
          </div>
          {!verificadoOk && (
            <p className="text-xs text-red-800 mt-1">{verificacion?.error}</p>
          )}
          <div className="mt-2 flex gap-2 items-center">
            <Input
              type="email"
              placeholder="email@ejemplo.com para test"
              value={emailPrueba}
              onChange={(e) => setEmailPrueba(e.target.value)}
              className="h-8 text-xs flex-1 max-w-xs bg-white"
            />
            <Button size="sm" onClick={probar} disabled={!emailPrueba || enviando} className="h-8">
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span className="ml-1">Enviar test</span>
            </Button>
          </div>
          {resultado && (
            <div className={`mt-2 text-xs ${resultado.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {resultado.ok ? '✓ Email de prueba enviado' : `✗ ${resultado.error}`}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
