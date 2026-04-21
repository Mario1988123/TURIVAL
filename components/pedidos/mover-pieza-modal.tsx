'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MapPin, AlertCircle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  accionListarUbicacionesActivas,
  accionMoverPieza,
  type UbicacionOpcion,
} from '@/lib/actions/pedidos'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  piezaId: string
  piezaNumero: string
  ubicacionActualId: string | null
  ubicacionActualCodigo?: string
  onDone?: (ok: boolean, texto: string) => void
}

export function MoverPiezaModal({
  open,
  onOpenChange,
  piezaId,
  piezaNumero,
  ubicacionActualId,
  ubicacionActualCodigo,
  onDone,
}: Props) {
  const router = useRouter()
  const [ubicaciones, setUbicaciones] = useState<UbicacionOpcion[]>([])
  const [destinoId, setDestinoId] = useState<string>('')
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    setDestinoId('')
    setMotivo('')
    setErrorSubmit(null)

    accionListarUbicacionesActivas()
      .then((res) => {
        if (cancelado) return
        if (res.ok) {
          // Filtrar la ubicación actual (no tiene sentido mover a donde ya está)
          const filtradas = res.ubicaciones.filter(
            (u) => u.id !== ubicacionActualId
          )
          setUbicaciones(filtradas)
          if (filtradas.length > 0) setDestinoId(filtradas[0].id)
        } else {
          setErrorCarga(res.error ?? 'Error cargando ubicaciones')
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [open, ubicacionActualId])

  function submit() {
    setErrorSubmit(null)
    if (!destinoId) {
      setErrorSubmit('Selecciona una ubicación destino')
      return
    }
    startTransition(async () => {
      const res = await accionMoverPieza({
        piezaId,
        nuevaUbicacionId: destinoId,
        motivo: motivo.trim() || null,
      })
      if (res.ok) {
        onDone?.(true, `Pieza ${piezaNumero} movida`)
        onOpenChange(false)
        router.refresh()
      } else {
        setErrorSubmit(res.error ?? 'Error al mover')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Mover pieza {piezaNumero}
          </DialogTitle>
          <DialogDescription>
            {ubicacionActualCodigo ? (
              <>
                Ubicación actual:{' '}
                <span className="font-mono font-medium">
                  {ubicacionActualCodigo}
                </span>
                . Selecciona destino:
              </>
            ) : (
              <>Esta pieza no tiene ubicación asignada. Selecciona una:</>
            )}
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Cargando ubicaciones...
          </div>
        )}

        {errorCarga && (
          <Alert variant="destructive">
            <AlertDescription>{errorCarga}</AlertDescription>
          </Alert>
        )}

        {!cargando && !errorCarga && ubicaciones.length === 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              No hay otras ubicaciones activas disponibles. Crea una en
              /configuracion/ubicaciones.
            </AlertDescription>
          </Alert>
        )}

        {!cargando && !errorCarga && ubicaciones.length > 0 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="destino">Ubicación destino</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger id="destino">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ubicaciones.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="font-mono">{u.codigo}</span> — {u.nombre}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({u.tipo})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo (opcional)</Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Por ejemplo: tanda de blanco agrupada, liberar espacio..."
              />
              <p className="text-xs text-muted-foreground">
                Se guarda en el histórico de movimientos de la pieza.
              </p>
            </div>
          </>
        )}

        {errorSubmit && (
          <Alert variant="destructive">
            <AlertDescription>{errorSubmit}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || !destinoId || cargando}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Moviendo...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Mover pieza
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default MoverPiezaModal
