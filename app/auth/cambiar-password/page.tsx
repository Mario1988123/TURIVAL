'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TuriavalLogo } from '@/components/branding/turiaval-logo'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { accionCambiarMiPassword } from '@/lib/actions/auth-roles'

/**
 * Pantalla obligatoria al primer login (cuando password_temporal=true).
 * Forzada por el AppLayout: si el flag está activo, redirige aquí antes
 * de dejar entrar al CRM.
 */
export default function CambiarPasswordPage() {
  const router = useRouter()
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (nueva !== repetida) { setError('Las contraseñas no coinciden.'); return }
    if (nueva.length < 4)   { setError('Mínimo 4 caracteres.'); return }
    if (nueva === '1234')   { setError('No puedes dejar la contraseña por defecto.'); return }
    setEnviando(true)
    try {
      const res = await accionCambiarMiPassword(nueva)
      if (!res.ok) { setError(res.error); return }
      router.push('/dashboard')
      router.refresh()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <TuriavalLogo size={64} className="rounded-2xl" />
          </div>
          <CardTitle>Cambia tu contraseña</CardTitle>
          <CardDescription>
            Es la primera vez que entras (o el admin acaba de resetearla).
            Cámbiala antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input
                type="password"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Repetir contraseña</Label>
              <Input
                type="password"
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                required
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Guardando…' : (
                <span className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Guardar y entrar
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
