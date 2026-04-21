'use client'

import { useEffect, useState, useRef } from 'react'
import {
  obtenerConfiguracionEmpresa,
  actualizarConfiguracionEmpresa,
  subirLogoEmpresa,
  type ConfiguracionEmpresa,
} from '@/lib/services/configuracion'
import { listarMateriales } from '@/lib/services/materiales'
import type { MaterialConProveedor } from '@/lib/types/erp'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Settings, Save, Upload, Trash2, Loader2,
  Building2, Image as ImageIcon, Calculator, Beaker,
} from 'lucide-react'

const CAMPOS_FISCALES: Array<{
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
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [form, setForm] = useState<Partial<ConfiguracionEmpresa>>({})
  const [catalizadores, setCatalizadores] = useState<MaterialConProveedor[]>([])
  const [disolventes, setDisolventes]     = useState<MaterialConProveedor[]>([])
  const inputLogoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      try {
        const [conf, cata, dis] = await Promise.all([
          obtenerConfiguracionEmpresa(),
          listarMateriales({ tipo: 'catalizador', activos_solo: true }),
          listarMateriales({ tipo: 'disolvente',  activos_solo: true }),
        ])
        if (conf) setForm(conf)
        setCatalizadores(cata)
        setDisolventes(dis)
      } catch (e: any) {
        setMensaje({ tipo: 'error', texto: e.message })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 3000)
    return () => clearTimeout(t)
  }, [mensaje])

  function actualizar(key: keyof ConfiguracionEmpresa, valor: any) {
    setForm((prev) => ({ ...prev, [key]: valor }))
  }

  async function guardar() {
    setGuardando(true)
    try {
      const actualizada = await actualizarConfiguracionEmpresa(form)
      setForm(actualizada)
      setMensaje({ tipo: 'ok', texto: 'Configuración guardada.' })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    } finally {
      setGuardando(false)
    }
  }

  async function onSeleccionarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoLogo(true)
    try {
      const url = await subirLogoEmpresa(file)
      const actualizada = await actualizarConfiguracionEmpresa({ logo_url: url })
      setForm(actualizada)
      setMensaje({ tipo: 'ok', texto: 'Logo subido.' })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    } finally {
      setSubiendoLogo(false)
      if (inputLogoRef.current) inputLogoRef.current.value = ''
    }
  }

  async function eliminarLogo() {
    if (!form.logo_url) return
    if (!confirm('¿Eliminar el logo actual?')) return
    try {
      const actualizada = await actualizarConfiguracionEmpresa({ logo_url: null })
      setForm(actualizada)
      setMensaje({ tipo: 'ok', texto: 'Logo eliminado.' })
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const numInput = (key: keyof ConfiguracionEmpresa, step = '0.01', min = '0') => (
    <Input
      type="number"
      step={step}
      min={min}
      value={form[key] as any ?? ''}
      onChange={(e) => actualizar(key, parseFloat(e.target.value) || 0)}
    />
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Configuración
        </h1>
        <p className="text-muted-foreground">
          Datos fiscales, logo, parámetros de cálculo ERP y materiales por defecto.
        </p>
      </div>

      <Tabs defaultValue="fiscal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fiscal"><Building2 className="w-4 h-4 mr-2" />Datos fiscales</TabsTrigger>
          <TabsTrigger value="logo"><ImageIcon className="w-4 h-4 mr-2" />Logo</TabsTrigger>
          <TabsTrigger value="erp"><Calculator className="w-4 h-4 mr-2" />Parámetros ERP</TabsTrigger>
          <TabsTrigger value="defaults"><Beaker className="w-4 h-4 mr-2" />Mezclas</TabsTrigger>
        </TabsList>

        {/* ===== DATOS FISCALES ===== */}
        <TabsContent value="fiscal">
          <Card>
            <CardHeader>
              <CardTitle>Datos fiscales</CardTitle>
              <CardDescription>Aparecen en presupuestos, pedidos y facturas.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAMPOS_FISCALES.map((c) => (
                <div key={String(c.key)} className={c.fullWidth ? 'md:col-span-2' : ''}>
                  <Label className="text-xs mb-1 block">{c.label}</Label>
                  <Input
                    value={(form[c.key] as string) ?? ''}
                    onChange={(e) => actualizar(c.key, e.target.value)}
                    placeholder={c.placeholder}
                  />
                </div>
              ))}
              <div>
                <Label className="text-xs mb-1 block">IVA por defecto (%)</Label>
                {numInput('iva_default', '0.1')}
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs mb-1 block">Condiciones de pago por defecto</Label>
                <Input
                  value={form.condiciones_pago_default ?? ''}
                  onChange={(e) => actualizar('condiciones_pago_default', e.target.value)}
                  placeholder="Pago a 30 días fecha factura"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs mb-1 block">Texto pie de presupuesto</Label>
                <Textarea
                  rows={3}
                  value={form.texto_pie_presupuesto ?? ''}
                  onChange={(e) => actualizar('texto_pie_presupuesto', e.target.value)}
                  placeholder="Texto legal, condiciones generales, etc."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== LOGO ===== */}
        <TabsContent value="logo">
          <Card>
            <CardHeader>
              <CardTitle>Logo de la empresa</CardTitle>
              <CardDescription>Máx 5MB. PNG, JPG, SVG o WEBP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.logo_url ? (
                <div className="flex items-start gap-4 flex-wrap">
                  <img
                    src={form.logo_url}
                    alt="Logo"
                    className="h-32 bg-white border rounded p-3"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => inputLogoRef.current?.click()}
                      disabled={subiendoLogo}
                    >
                      {subiendoLogo
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Subiendo…</>
                        : <><Upload className="w-4 h-4 mr-2" />Reemplazar</>}
                    </Button>
                    <Button variant="outline" onClick={eliminarLogo} className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => inputLogoRef.current?.click()} disabled={subiendoLogo}>
                  {subiendoLogo
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Subiendo…</>
                    : <><Upload className="w-4 h-4 mr-2" />Subir logo</>}
                </Button>
              )}
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={onSeleccionarLogo}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PARÁMETROS ERP ===== */}
        <TabsContent value="erp">
          <Card>
            <CardHeader>
              <CardTitle>Parámetros de cálculo ERP</CardTitle>
              <CardDescription>
                Valores globales que usan los motores de superficie, coste y mezcla.
                Los materiales individuales pueden sobrescribirlos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Rendimientos */}
              <div>
                <h3 className="font-semibold mb-2 text-sm">Rendimiento de pintura (kg/m²)</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Cuántos kg de pintura o fondo se gastan por m² pintado. Valor promedio del taller.
                  Cada material puede sobrescribir su propio rendimiento.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1 block">Lacado (kg/m²)</Label>
                    {numInput('rendimiento_lacado_kg_m2', '0.01')}
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Fondo (kg/m²)</Label>
                    {numInput('rendimiento_fondo_kg_m2', '0.01')}
                  </div>
                </div>
              </div>

              {/* Ratios de mezcla */}
              <div>
                <h3 className="font-semibold mb-2 text-sm">Ratios de mezcla (X:1)</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Por cada X partes de pintura/fondo, 1 parte de componente.
                  Ejemplo: ratio 8 = 8 kg de pintura por cada 1 kg de catalizador.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs mb-1 block">Lacado · cata</Label>
                    {numInput('ratio_cata_lacado', '0.5', '1')}
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Lacado · disolvente</Label>
                    {numInput('ratio_dis_lacado', '0.5', '1')}
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Fondo · cata</Label>
                    {numInput('ratio_cata_fondo', '0.5', '1')}
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Fondo · disolvente</Label>
                    {numInput('ratio_dis_fondo', '0.5', '1')}
                  </div>
                </div>
              </div>

              {/* Mano de obra */}
              <div>
                <h3 className="font-semibold mb-2 text-sm">Coste humano</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1 block">Coste €/minuto operario</Label>
                    {numInput('coste_minuto_operario', '0.01')}
                    <p className="text-xs text-muted-foreground mt-1">0,40 €/min = 24 €/h.</p>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Jornada (horas/día)</Label>
                    {numInput('jornada_horas', '0.5')}
                  </div>
                </div>
              </div>

              {/* Venta */}
              <div>
                <h3 className="font-semibold mb-2 text-sm">Venta</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1 block">Margen objetivo (%)</Label>
                    {numInput('margen_objetivo_porcentaje', '1')}
                    <p className="text-xs text-muted-foreground mt-1">
                      Se aplica sobre el coste total. 30 % = precio sube un 30% sobre coste.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Ancho mínimo pistola (cm)</Label>
                    {numInput('ancho_minimo_pistola_cm', '1')}
                    <p className="text-xs text-muted-foreground mt-1">
                      También el ancho del metro lineal: 1 ml = 1 m × {form.ancho_minimo_pistola_cm ?? 15} cm.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MATERIALES DEFAULT ===== */}
        <TabsContent value="defaults">
          <Card>
            <CardHeader>
              <CardTitle>Materiales por defecto para mezclas</CardTitle>
              <CardDescription>
                El catalizador y disolvente que se añade automáticamente a las mezclas
                de lacado y fondo. Si en el futuro añades variedades especiales,
                puedes asignarlas material a material.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1 block">Catalizador por defecto</Label>
                <Select
                  value={form.material_catalizador_default_id ?? '__ninguno__'}
                  onValueChange={(v) => actualizar(
                    'material_catalizador_default_id',
                    v === '__ninguno__' ? null : v
                  )}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ninguno__">(ninguno)</SelectItem>
                    {catalizadores.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.codigo ? `${m.codigo} · ` : ''}{m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Disolvente por defecto</Label>
                <Select
                  value={form.material_disolvente_default_id ?? '__ninguno__'}
                  onValueChange={(v) => actualizar(
                    'material_disolvente_default_id',
                    v === '__ninguno__' ? null : v
                  )}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ninguno__">(ninguno)</SelectItem>
                    {disolventes.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.codigo ? `${m.codigo} · ` : ''}{m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando…</>
                     : <><Save className="w-4 h-4 mr-2" />Guardar configuración</>}
        </Button>
      </div>

      {mensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[280px] max-w-md">
          <Alert
            variant={mensaje.tipo === 'error' ? 'destructive' : 'default'}
            className={mensaje.tipo === 'ok' ? 'bg-green-50 border-green-300 text-green-900' : ''}
          >
            <AlertDescription className="font-medium">{mensaje.texto}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
