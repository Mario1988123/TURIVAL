'use client'

import { useState, useEffect, useTransition } from 'react'
import { Clock, Save, Loader2, Info } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

import {
  accionGuardarTiempoGlobal,
} from '@/lib/actions/config-tiempos'
import type { ConfigTiempoProcesoConProceso } from '@/lib/services/config-tiempos'

// Estado local editable por fila (como strings para permitir vacíos mientras
// el usuario escribe). Al guardar convertimos a número.
interface FilaEditable {
  proceso_id: string
  codigo: string
  nombre: string
  orden_tipico: number
  tiempo_base_min: string
  tiempo_por_m2_min: string
  tiempo_por_ml_min: string
  // Valores originales para detectar cambios (comparación con lo tecleado).
  orig_base: number
  orig_m2: number
  orig_ml: number
}

function mapInicialAFila(t: ConfigTiempoProcesoConProceso): FilaEditable {
  return {
    proceso_id: t.proceso_id,
    codigo: t.proceso?.codigo ?? '?',
    nombre: t.proceso?.nombre ?? '?',
    orden_tipico: t.proceso?.orden_tipico ?? 0,
    tiempo_base_min: String(t.tiempo_base_min ?? 0),
    tiempo_por_m2_min: String(t.tiempo_por_m2_min ?? 0),
    tiempo_por_ml_min: String(t.tiempo_por_ml_min ?? 0),
    orig_base: Number(t.tiempo_base_min ?? 0),
    orig_m2: Number(t.tiempo_por_m2_min ?? 0),
    orig_ml: Number(t.tiempo_por_ml_min ?? 0),
  }
}

export default function TiemposCliente({
  tiemposIniciales,
}: {
  tiemposIniciales: ConfigTiempoProcesoConProceso[]
}) {
  const [filas, setFilas] = useState<FilaEditable[]>(
    tiemposIniciales.map(mapInicialAFila)
  )
  const [guardando, setGuardando] = useState<string | null>(null) // proceso_id
  const [isPending, startTransition] = useTransition()
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'error'
    texto: string
  } | null>(null)

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 3000)
    return () => clearTimeout(t)
  }, [mensaje])

  function actualizarCampo(
    procesoId: string,
    campo: 'tiempo_base_min' | 'tiempo_por_m2_min' | 'tiempo_por_ml_min',
    valor: string
  ) {
    setFilas((fs) =>
      fs.map((f) => (f.proceso_id === procesoId ? { ...f, [campo]: valor } : f))
    )
  }

  function filaModificada(f: FilaEditable): boolean {
    const b = parseFloat(f.tiempo_base_min)
    const m2 = parseFloat(f.tiempo_por_m2_min)
    const ml = parseFloat(f.tiempo_por_ml_min)
    if (!Number.isFinite(b) || !Number.isFinite(m2) || !Number.isFinite(ml)) {
      return true // hay texto no-numérico → marcar como "con cambios" para que el botón aparezca
    }
    return b !== f.orig_base || m2 !== f.orig_m2 || ml !== f.orig_ml
  }

  async function guardar(f: FilaEditable) {
    const b = parseFloat(f.tiempo_base_min)
    const m2 = parseFloat(f.tiempo_por_m2_min)
    const ml = parseFloat(f.tiempo_por_ml_min)
    if (
      !Number.isFinite(b) || b < 0 ||
      !Number.isFinite(m2) || m2 < 0 ||
      !Number.isFinite(ml) || ml < 0
    ) {
      setMensaje({
        tipo: 'error',
        texto: `Tiempos inválidos para ${f.nombre}. Deben ser números ≥ 0.`,
      })
      return
    }

    setGuardando(f.proceso_id)
    startTransition(async () => {
      const res = await accionGuardarTiempoGlobal({
        proceso_id: f.proceso_id,
        tiempo_base_min: b,
        tiempo_por_m2_min: m2,
        tiempo_por_ml_min: ml,
      })
      setGuardando(null)
      if (res.ok) {
        // Actualizar valores originales para "desactivar" el botón Guardar.
        setFilas((fs) =>
          fs.map((x) =>
            x.proceso_id === f.proceso_id
              ? { ...x, orig_base: b, orig_m2: m2, orig_ml: ml }
              : x
          )
        )
        setMensaje({ tipo: 'ok', texto: `Tiempos de ${f.nombre} guardados.` })
      } else {
        setMensaje({
          tipo: 'error',
          texto: res.error ?? 'Error al guardar',
        })
      }
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="w-8 h-8" />
          Tiempos de proceso
          <BotonInfoTiempos />
        </h1>
        <p className="text-muted-foreground">
          Tiempos base (preparación fija) y tiempos por m² o ml para cada uno
          de los 9 procesos. El motor ERP usa estos valores al confirmar un
          pedido para calcular la duración estimada de cada tarea.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de procesos</CardTitle>
          <CardDescription>
            Para cada proceso puedes modificar: tiempo base (fijo, en minutos),
            tiempo por m² (para piezas por superficie) y tiempo por metro lineal
            (para zócalos y molduras).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filas.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              No hay procesos activos en el catálogo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right w-40">Base (min)</TableHead>
                  <TableHead className="text-right w-40">Por m² (min)</TableHead>
                  <TableHead className="text-right w-40">Por ml (min)</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => {
                  const modificada = filaModificada(f)
                  const estaGuardando = guardando === f.proceso_id
                  return (
                    <TableRow key={f.proceso_id}>
                      <TableCell className="font-medium">{f.nombre}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={f.tiempo_base_min}
                          onChange={(e) =>
                            actualizarCampo(f.proceso_id, 'tiempo_base_min', e.target.value)
                          }
                          className="h-8 text-sm text-right font-mono"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={f.tiempo_por_m2_min}
                          onChange={(e) =>
                            actualizarCampo(f.proceso_id, 'tiempo_por_m2_min', e.target.value)
                          }
                          className="h-8 text-sm text-right font-mono"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={f.tiempo_por_ml_min}
                          onChange={(e) =>
                            actualizarCampo(f.proceso_id, 'tiempo_por_ml_min', e.target.value)
                          }
                          className="h-8 text-sm text-right font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => guardar(f)}
                          disabled={!modificada || estaGuardando || isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {estaGuardando ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ...
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5 mr-1" />
                              Guardar
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {mensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[280px] max-w-md">
          <Alert
            variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}
            className={
              mensaje.tipo === 'ok'
                ? 'bg-green-50 border-green-300 text-green-900'
                : ''
            }
          >
            <AlertDescription className="font-medium">
              {mensaje.texto}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Boton info (i) que sustituye al banner anterior (Mario)
// ============================================================

function BotonInfoTiempos() {
  const [abierto, setAbierto] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Información"
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute z-40 top-full mt-1 left-0 w-80 rounded-md border bg-blue-50 border-blue-300 text-blue-900 shadow-lg p-3 text-xs">
            Tiempos <strong>globales</strong> que se aplican cuando una pieza no tiene
            tiempos específicos para su categoría. Ajusta cada proceso según el
            ritmo real del taller y pulsa <strong>Guardar</strong> en esa fila.
          </div>
        </>
      )}
    </span>
  )
}
