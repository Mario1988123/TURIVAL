'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tratamiento } from '@/lib/types/erp'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Save, Pencil, Layers } from 'lucide-react'

export default function TratamientosPage() {
  const supabase = createClient()

  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<Tratamiento | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    multiplicador_coste: 1.0,
    tiempo_estimado_base: 30,
    activo: true,
  })

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 4000)
    return () => clearTimeout(t)
  }, [mensaje])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tratamientos')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      setMensaje({ tipo: 'error', texto: `Error cargando tratamientos: ${error.message}` })
    } else {
      setTratamientos((data || []) as Tratamiento[])
    }
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrirNuevo() {
    setEditando(null)
    setForm({
      nombre: '',
      descripcion: '',
      multiplicador_coste: 1.0,
      tiempo_estimado_base: 30,
      activo: true,
    })
    setDialogoAbierto(true)
  }

  function abrirEditar(t: Tratamiento) {
    setEditando(t)
    setForm({
      nombre: t.nombre,
      descripcion: t.descripcion || '',
      multiplicador_coste: Number(t.multiplicador_coste) || 1.0,
      tiempo_estimado_base: Number(t.tiempo_estimado_base) || 0,
      activo: t.activo,
    })
    setDialogoAbierto(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio.' })
      return
    }

    try {
      if (editando) {
        const { error } = await supabase
          .from('tratamientos')
          .update({
            nombre: form.nombre.trim(),
            descripcion: form.descripcion.trim() || null,
            multiplicador_coste: form.multiplicador_coste,
            tiempo_estimado_base: form.tiempo_estimado_base,
            activo: form.activo,
          })
          .eq('id', editando.id)
        if (error) throw error
        setMensaje({ tipo: 'ok', texto: 'Tratamiento actualizado.' })
      } else {
        const { error } = await supabase.from('tratamientos').insert({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          multiplicador_coste: form.multiplicador_coste,
          tiempo_estimado_base: form.tiempo_estimado_base,
          activo: form.activo,
        })
        if (error) throw error
        setMensaje({ tipo: 'ok', texto: 'Tratamiento creado.' })
      }
      setDialogoAbierto(false)
      await cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: `Error guardando: ${err.message || err}` })
    }
  }

  async function toggleActivo(t: Tratamiento) {
    try {
      const { error } = await supabase
        .from('tratamientos')
        .update({ activo: !t.activo })
        .eq('id', t.id)
      if (error) throw error
      await cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${err.message || err}` })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="w-8 h-8" />
          Tratamientos
        </h1>
        <p className="text-muted-foreground">
          Tipos de tratamiento de lacado disponibles. El multiplicador de coste se aplica
          al precio base del presupuesto.
        </p>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de tratamientos</CardTitle>
              <CardDescription>
                {tratamientos.length} tratamientos registrados.
                El multiplicador afecta al coste: ×1.0 = sin cambio, ×1.5 = 50% más caro.
              </CardDescription>
            </div>
            <Button onClick={abrirNuevo}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo tratamiento
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : tratamientos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay tratamientos. Crea el primero con el botón de arriba.
            </p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-center w-36">Multiplicador</TableHead>
                    <TableHead className="text-center w-36">Tiempo base</TableHead>
                    <TableHead className="text-center w-24">Estado</TableHead>
                    <TableHead className="text-right w-44">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tratamientos.map((t) => (
                    <TableRow key={t.id} className={!t.activo ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{t.nombre}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {t.descripcion || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            Number(t.multiplicador_coste) > 1
                              ? 'default'
                              : Number(t.multiplicador_coste) < 1
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          ×{Number(t.multiplicador_coste).toFixed(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {t.tiempo_estimado_base ? `${t.tiempo_estimado_base} min` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={t.activo ? 'default' : 'secondary'}>
                          {t.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" onClick={() => abrirEditar(t)}>
                          <Pencil className="w-3 h-3 mr-1" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActivo(t)}>
                          {t.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo crear/editar */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar tratamiento' : 'Nuevo tratamiento'}
            </DialogTitle>
            <DialogDescription>
              Define el tipo de tratamiento y su impacto en el coste.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Lacado poliuretano"
              />
            </div>

            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Breve explicación del tratamiento..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Multiplicador de coste</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={form.multiplicador_coste}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      multiplicador_coste: parseFloat(e.target.value) || 1.0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  ×1.0 = precio normal. ×1.5 = 50% más caro. ×0.8 = 20% más barato.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Tiempo estimado base (min)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.tiempo_estimado_base}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tiempo_estimado_base: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Minutos típicos para este tratamiento.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="activo" className="cursor-pointer mb-0">
                Activo (disponible para presupuestos)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

