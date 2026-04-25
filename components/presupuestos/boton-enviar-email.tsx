'use client'

/**
 * Botón "Enviar por email" reutilizable desde /presupuestos/[id] u otros sitios.
 * Dialog con destinatario editable (pre-relleno con email del cliente) y mensaje opcional.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { Mail, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { accionEnviarPresupuestoEmail } from '@/lib/actions/email-presupuestos'

interface Props {
  presupuesto_id: string
  email_cliente?: string | null
  disabled?: boolean
}

export default function BotonEnviarEmail({ presupuesto_id, email_cliente, disabled }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [email, setEmail] = useState(email_cliente ?? '')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'stub' | 'error'; texto: string } | null>(null)

  async function enviar() {
    if (!email.trim()) return
    setEnviando(true)
    setResultado(null)
    try {
      const res = await accionEnviarPresupuestoEmail({
        presupuesto_id,
        email_destino: email.trim(),
        mensaje_personal: mensaje.trim() || undefined,
      })
      if (res.ok) {
        if (res.stub || !res.smtp_configurado) {
          setResultado({
            tipo: 'stub',
            texto: `SMTP no configurado. El email no se ha enviado. Configura SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS en variables de entorno.`,
          })
        } else {
          setResultado({ tipo: 'ok', texto: `Enviado a ${res.email_destino}` })
          setTimeout(() => setAbierto(false), 1500)
        }
      } else {
        setResultado({ tipo: 'error', texto: res.error ?? 'Error' })
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5">
          <Mail className="h-4 w-4" /> Enviar email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar presupuesto por email</DialogTitle>
          <DialogDescription>
            Se enviará con la plantilla HTML al destinatario indicado. Si tienes un enlace público (share_token) el email lo incluye automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Destinatario</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="cliente@ejemplo.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Mensaje personal (opcional)
            </label>
            <Textarea
              rows={3}
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              placeholder="Ej. Hola, como hablamos te mando el presupuesto..."
            />
          </div>

          {resultado && (
            <div
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                resultado.tipo === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : resultado.tipo === 'stub' ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              {resultado.tipo === 'ok' && <CheckCircle2 className="mt-0.5 h-4 w-4" />}
              {resultado.tipo === 'stub' && <AlertTriangle className="mt-0.5 h-4 w-4" />}
              {resultado.tipo === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4" />}
              <div>{resultado.texto}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button onClick={enviar} disabled={!email.trim() || enviando} className="gap-1.5">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
