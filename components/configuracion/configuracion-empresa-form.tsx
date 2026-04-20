'use client'

import { useEffect, useState, useRef } from 'react'
import {
  obtenerConfiguracionEmpresa,
  actualizarConfiguracionEmpresa,
  subirLogoEmpresa,
  type ConfiguracionEmpresa,
} from '@/lib/services/configuracion'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Settings,
  Save,
  Upload,
  Trash2,
  Loader2,
  Building2,
  Image as ImageIcon,
} from 'lucide-react'

const CAMPOS_TEXTO: Array<{
  key: keyof ConfiguracionEmpresa
  label: string
  placeholder?: string
  fullWidth?: boolean
}> = [
  { key: 'razon_social', label: 'Razón social *', placeholder: 'Turiaval S.L.' },
  { key: 'nombre_comercial', label: 'Nombre comercial', placeholder: 'Turiaval' },
  { key: 'cif_nif', label: 'CIF / NIF *', placeholder: 'B12345678' },
  { key: 'direccion', label: 'Dirección', placeholder: 'Calle Ejemplo, 123', fullWidth: true },
  { key: 'codigo_postal', label: 'Código postal', placeholder: '46980' },
  { key: 'ciudad', label: 'Ciudad', placeholder: 'Paterna' },
  { key: 'provincia', label: 'Provincia', placeholder: 'Valencia' },
  { key: 'pais', label: 'País', placeholder: 'España' },
  { key: 'telefono', label: 'Teléfono', placeholder: '+34 960 00 00 00' },
  { key: 'email', label: 'Email', placeholder: 'info@turiaval.es' },
  { key: 'web', label: 'Web', placeholder: 'https://turiaval.es' },
  { key: 'iban', label: 'IBAN', placeholder: 'ES00 0000 0000 0000 0000 0000' },
]

export default function ConfiguracionEmpresaForm() {
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(
    null
  )
  const [form, setForm] = useState<Partial<ConfiguracionEmpresa>>({})
  const inputLogoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const conf = await obtenerConfiguracionEmpresa()
        if (conf) setForm(conf)
      } catch (e: any) {
        setMensaje({ tipo: 'error', texto: e.message })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 5000)
    return () => clearTimeout(t)
  }, [mensaje])

  function actualizar(key: keyof ConfiguracionEmpresa, valor: any) {
    setForm((prev) => ({ ...prev, [key]: valor }))
  }

  async function guardar() {
    setMensaje(null)
    if (!form.razon_social?.trim()) {
      setMensaje({ tipo: 'error', texto: 'La razón social es obligatoria.' })
      return
    }
    if (!form.cif_nif?.trim()) {
      setMensaje({ tipo: 'error', texto: 'El CIF/NIF es obligatorio.' })
      return
    }

    setGuardando(true)
    try {
      const {
        id,
        created_at,
        updated_at,
        ...datosLimpios
      } = form as ConfiguracionEmpresa
      const actualizada = await actualizarConfiguracionEmpresa(datosLimpios)
      setForm(actualizada)
      setMensaje({
        tipo: 'ok',
        texto: 'Configuración guardada correctamente.',
      })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message || 'Error al guardar' })
    } finally {
      setGuardando(false)
    }
  }

  async function manejarSubidaLogo(file: File) {
    setMensaje(null)
    setSubiendoLogo(true)
    try {
      const url = await subirLogoEmpresa(file)
      actualizar('logo_url', url)
      // Guardar inmediatamente
      await actualizarConfiguracionEmpresa({ logo_url: url })
      setMensaje({ tipo: 'ok', texto: 'Logo subido correctamente.' })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message || 'Error subiendo logo' })
    } finally {
      setSubiendoLogo(false)
      if (inputLogoRef.current) inputLogoRef.current.value = ''
    }
  }

  async function eliminarLogo() {
    if (!confirm('¿Seguro que quieres eliminar el logo?')) return
    try {
      actualizar('logo_url', null)
      await actualizarConfiguracionEmpresa({ logo_url: null })
      setMensaje({ tipo: 'ok', texto: 'Logo eliminado.' })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Configuración de la empresa
        </h1>
        <p className="text-muted-foreground mt-1">
          Estos datos aparecerán en los presupuestos, albaranes y otros documentos.
        </p>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      {/* LOGO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Logo de la empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6 flex-wrap">
            <div className="w-48 h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo_url}
                  alt="Logo empresa"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Sin logo</p>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3 min-w-60">
              <p className="text-sm text-muted-foreground">
                Sube tu logo en formato <strong>PNG, JPG, SVG o WEBP</strong>. Máximo 5MB.
                Aparecerá en la cabecera de los presupuestos.
              </p>
              <div className="flex gap-2 flex-wrap">
                <input
                  ref={inputLogoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) manejarSubidaLogo(file)
                  }}
                />
                <Button
                  onClick={() => inputLogoRef.current?.click()}
                  disabled={subiendoLogo}
                  variant="default"
                >
                  {subiendoLogo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {form.logo_url ? 'Cambiar logo' : 'Subir logo'}
                    </>
                  )}
                </Button>
                {form.logo_url && (
                  <Button
                    variant="outline"
                    onClick={eliminarLogo}
                    disabled={subiendoLogo}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DATOS FISCALES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Datos fiscales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CAMPOS_TEXTO.map((c) => (
              <div
                key={c.key}
                className={`space-y-1 ${c.fullWidth ? 'md:col-span-2' : ''}`}
              >
                <Label className="text-xs">{c.label}</Label>
                <Input
                  value={(form[c.key] as string) ?? ''}
                  onChange={(e) => actualizar(c.key, e.target.value)}
                  placeholder={c.placeholder}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* OPCIONES PRESUPUESTO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opciones de presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Condiciones de pago por defecto</Label>
            <Input
              value={form.condiciones_pago_default ?? ''}
              onChange={(e) => actualizar('condiciones_pago_default', e.target.value)}
              placeholder="Pago a 30 días fecha factura"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">IVA por defecto (%)</Label>
            <Input
              type="number"
              min={0}
              step="1"
              value={form.iva_default ?? 21}
              onChange={(e) =>
                actualizar('iva_default', Number(e.target.value))
              }
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Texto al pie del presupuesto (aparece debajo del total)
            </Label>
            <Textarea
              rows={3}
              value={form.texto_pie_presupuesto ?? ''}
              onChange={(e) =>
                actualizar('texto_pie_presupuesto', e.target.value)
              }
              placeholder={'Ej: Precios válidos durante la validez indicada.\nPlazo de entrega a confirmar según fecha de aceptación.'}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-6">
        <Button size="lg" onClick={guardar} disabled={guardando}>
          <Save className="w-4 h-4 mr-2" />
          {guardando ? 'Guardando...' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  )
}
