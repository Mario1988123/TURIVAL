'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { obtenerCliente, actualizarCliente } from '@/lib/services'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save } from 'lucide-react'
import type { Cliente } from '@/lib/types/erp'

export default function EditarClientePage() {
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const [form, setForm] = useState({
    tipo: 'precliente' as 'precliente' | 'cliente_activo' | 'cliente_recurrente',
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
    condiciones_pago: '30 dias',
    descuento_general: 0,
  })

  useEffect(() => {
    async function loadCliente() {
      try {
        const cliente = await obtenerCliente(clienteId)
        setForm({
          tipo: cliente.tipo || 'precliente',
          nombre_comercial: cliente.nombre_comercial || '',
          razon_social: cliente.razon_social || '',
          cif_nif: cliente.cif_nif || '',
          persona_contacto: cliente.persona_contacto || '',
          email: cliente.email || '',
          telefono: cliente.telefono || '',
          direccion: cliente.direccion || '',
          codigo_postal: cliente.codigo_postal || '',
          ciudad: cliente.ciudad || '',
          provincia: cliente.provincia || '',
          notas: cliente.notas || '',
          condiciones_pago: cliente.condiciones_pago || '30 dias',
          descuento_general: cliente.descuento_general || 0,
        })
      } catch (error) {
        console.error('Error loading cliente:', error)
        setError('Error al cargar el cliente')
      } finally {
        setLoading(false)
      }
    }
    loadCliente()
  }, [clienteId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre_comercial.trim()) {
      setError('El nombre comercial es obligatorio')
      return
    }

    setSaving(true)
    setError('')

    try {
      await actualizarCliente(clienteId, form)
      router.push(`/dashboard/clientes/${clienteId}`)
    } catch (err) {
      console.error('Error actualizando cliente:', err)
      setError('Error al actualizar el cliente. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-64 bg-muted animate-pulse rounded" />
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Cliente</h1>
          <p className="text-muted-foreground">{form.nombre_comercial}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Datos Principales */}
          <Card>
            <CardHeader>
              <CardTitle>Datos Principales</CardTitle>
              <CardDescription>Informacion basica del cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo de Cliente</Label>
                <Select value={form.tipo} onValueChange={(v: any) => setForm({...form, tipo: v})}>
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
              
              <div className="grid gap-2">
                <Label htmlFor="nombre_comercial">Nombre Comercial *</Label>
                <Input
                  id="nombre_comercial"
                  value={form.nombre_comercial}
                  onChange={(e) => setForm({...form, nombre_comercial: e.target.value})}
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="razon_social">Razon Social</Label>
                <Input
                  id="razon_social"
                  value={form.razon_social}
                  onChange={(e) => setForm({...form, razon_social: e.target.value})}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="cif_nif">CIF/NIF</Label>
                <Input
                  id="cif_nif"
                  value={form.cif_nif}
                  onChange={(e) => setForm({...form, cif_nif: e.target.value})}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="persona_contacto">Persona de Contacto</Label>
                <Input
                  id="persona_contacto"
                  value={form.persona_contacto}
                  onChange={(e) => setForm({...form, persona_contacto: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contacto */}
          <Card>
            <CardHeader>
              <CardTitle>Contacto</CardTitle>
              <CardDescription>Datos de contacto y ubicacion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({...form, email: e.target.value})}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="telefono">Telefono</Label>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => setForm({...form, telefono: e.target.value})}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="direccion">Direccion</Label>
                <Input
                  id="direccion"
                  value={form.direccion}
                  onChange={(e) => setForm({...form, direccion: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="codigo_postal">Codigo Postal</Label>
                  <Input
                    id="codigo_postal"
                    value={form.codigo_postal}
                    onChange={(e) => setForm({...form, codigo_postal: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input
                    id="ciudad"
                    value={form.ciudad}
                    onChange={(e) => setForm({...form, ciudad: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="provincia">Provincia</Label>
                <Input
                  id="provincia"
                  value={form.provincia}
                  onChange={(e) => setForm({...form, provincia: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Condiciones Comerciales */}
          <Card>
            <CardHeader>
              <CardTitle>Condiciones Comerciales</CardTitle>
              <CardDescription>Condiciones de pago y descuentos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="condiciones_pago">Condiciones de Pago</Label>
                <Select value={form.condiciones_pago} onValueChange={(v) => setForm({...form, condiciones_pago: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contado">Contado</SelectItem>
                    <SelectItem value="15 dias">15 dias</SelectItem>
                    <SelectItem value="30 dias">30 dias</SelectItem>
                    <SelectItem value="45 dias">45 dias</SelectItem>
                    <SelectItem value="60 dias">60 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="descuento_general">Descuento General (%)</Label>
                <Input
                  id="descuento_general"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.descuento_general}
                  onChange={(e) => setForm({...form, descuento_general: parseFloat(e.target.value) || 0})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
              <CardDescription>Informacion adicional</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="notas">Notas internas</Label>
                <Textarea
                  id="notas"
                  value={form.notas}
                  onChange={(e) => setForm({...form, notas: e.target.value})}
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  )
}
