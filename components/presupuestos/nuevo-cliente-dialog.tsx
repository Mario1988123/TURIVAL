'use client'

import { useState } from 'react'
import { crearCliente } from '@/lib/services'
import type { Cliente } from '@/lib/types/erp'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Save, UserPlus } from 'lucide-react'

export default function NuevoClienteDialog({
  abierto,
  onCerrar,
  onCreado,
}: {
  abierto: boolean
  onCerrar: () => void
  onCreado: (cliente: Cliente) => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    tipo: 'precliente' as Cliente['tipo'],
    nombre_comercial: '',
    razon_social: '',
    cif_nif: '',
    persona_contacto: '',
    email: '',
    telefono: '',
    direccion: '',
    codigo_postal: '',
    ciudad: '',
    provincia: '',
    notas: '',
  })

  async function guardar() {
    setError(null)
    if (!form.nombre_comercial.trim()) {
      setError('El nombre comercial es obligatorio.')
      return
    }

    setGuardando(true)
    try {
      const nuevo = await crearCliente({
        tipo: form.tipo,
        nombre_comercial: form.nombre_comercial.trim(),
        razon_social: form.razon_social.trim() || null,
        cif_nif: form.cif_nif.trim() || null,
        persona_contacto: form.persona_contacto.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        codigo_postal: form.codigo_postal.trim() || null,
        ciudad: form.ciudad.trim() || null,
        provincia: form.provincia.trim() || null,
        notas: form.notas.trim() || null,
        origen: null,
        observaciones_internas: null,
        frecuencia_trabajo: null,
        condiciones_pago: '30 días',
        descuento_general: 0,
      } as any)

      // Reset formulario
      setForm({
        tipo: 'precliente',
        nombre_comercial: '',
        razon_social: '',
        cif_nif: '',
        persona_contacto: '',
        email: '',
        telefono: '',
        direccion: '',
        codigo_postal: '',
        ciudad: '',
        provincia: '',
        notas: '',
      })

      onCreado(nuevo)
      onCerrar()
    } catch (e: any) {
      console.error('[NuevoClienteDialog] Error:', e)
      setError(e.message || 'Error al crear el cliente')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Nuevo cliente
          </DialogTitle>
          <DialogDescription>
            Crea un cliente rápido. Podrás completar el resto de datos más tarde.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Nombre comercial *</Label>
              <Input
                value={form.nombre_comercial}
                onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })}
                placeholder="Ej: TURMALINA"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v: Cliente['tipo']) => setForm({ ...form, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="precliente">Pre-cliente</SelectItem>
                  <SelectItem value="cliente_activo">Cliente Activo</SelectItem>
                  <SelectItem value="cliente_recurrente">Cliente Recurrente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>CIF / NIF</Label>
              <Input
                value={form.cif_nif}
                onChange={(e) => setForm({ ...form, cif_nif: e.target.value })}
                placeholder="B12345678"
              />
            </div>

            <div className="space-y-1 col-span-2">
              <Label>Razón social</Label>
              <Input
                value={form.razon_social}
                onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                placeholder="Razón social completa"
              />
            </div>

            <div className="space-y-1">
              <Label>Persona de contacto</Label>
              <Input
                value={form.persona_contacto}
                onChange={(e) => setForm({ ...form, persona_contacto: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Dirección</Label>
              <Input
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Código postal</Label>
              <Input
                value={form.codigo_postal}
                onChange={(e) => setForm({ ...form, codigo_postal: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Ciudad</Label>
              <Input
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Provincia</Label>
              <Input
                value={form.provincia}
                onChange={(e) => setForm({ ...form, provincia: e.target.value })}
              />
            </div>

            <div className="space-y-1 col-span-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            <Save className="w-4 h-4 mr-2" />
            {guardando ? 'Creando...' : 'Crear cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
