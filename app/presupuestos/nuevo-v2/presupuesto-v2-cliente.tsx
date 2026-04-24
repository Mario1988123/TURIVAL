'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { listarClientes } from '@/lib/services/clientes'
import {
  listarReferenciasPorCliente,
  crearReferencia,
  type ReferenciaCliente,
} from '@/lib/services/referencias-cliente'
import {
  crearPresupuestoV2,
  type LineaPresupuestoInput,
  type SimularPrecioResultado,
} from '@/lib/services/presupuestos-v2'
import type { Cliente } from '@/lib/types/erp'
import type { FactorComplejidad } from '@/lib/motor/coste'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  FileText, Plus, Save, Loader2, X, Trash2, Layers, Edit3, Info,
} from 'lucide-react'
import DialogNuevaPiezaV2, { type NuevaPiezaData } from './dialog-nueva-pieza-v2'

interface DatosPersonalizados {
  categoria_pieza_id: string | null
  modo_precio: 'm2' | 'pieza' | 'ml'
  ancho: number | null
  alto: number | null
  grosor: number | null
  longitud_ml: number | null
  cara_frontal: boolean
  cara_trasera: boolean
  canto_superior: boolean
  canto_inferior: boolean
  canto_izquierdo: boolean
  canto_derecho: boolean
  contabilizar_grosor: boolean
  material_lacado_id: string | null
  material_fondo_id: string | null
  factor_complejidad: FactorComplejidad
  descuento_porcentaje: number
  precio_aproximado: boolean
  procesos_codigos: string[]
  guardar_como_referencia: boolean
  nombre_referencia: string
  // Preview calculado en el dialog con el botón "Calcular precio"
  // (Opción B). Si existe, lo usamos en la tabla y totales sin
  // esperar al guardado. El motor ERP recalcula igualmente al
  // guardar, esto es sólo UX para evitar el "Al guardar —".
  preview: SimularPrecioResultado | null
}

type LineaItem =
  | { tipo: 'referencia'; referencia: ReferenciaCliente; cantidad: number; descripcion: string }
  | { tipo: 'manual';     descripcion: string; cantidad: number; precio_unitario: number }
  | { tipo: 'personalizada'; descripcion: string; cantidad: number; datos: DatosPersonalizados }

const EURO = (n: number) =>
  Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export default function PresupuestoV2Cliente() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState<string>('')
  const [referencias, setReferencias] = useState<ReferenciaCliente[]>([])
  const [cargandoRefs, setCargandoRefs] = useState(false)

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [validezDias, setValidezDias] = useState(30)
  const [iva, setIva] = useState(21)
  const [descuentoGlobal, setDescuentoGlobal] = useState(0)
  const [obsComerciales, setObsComerciales] = useState('')
  const [obsInternas, setObsInternas] = useState('')

  const [lineas, setLineas] = useState<LineaItem[]>([])

  // Dialogs
  const [dialogoRef, setDialogoRef] = useState(false)
  const [dialogoManual, setDialogoManual] = useState(false)
  const [dialogoNuevaPieza, setDialogoNuevaPieza] = useState(false)
  const [formManual, setFormManual] = useState({ descripcion: '', cantidad: 1, precio: 0 })

  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // Cargar clientes
  useEffect(() => {
    (async () => {
      const res = await listarClientes({ limite: 5000, pagina: 0 })
      setClientes(res.clientes ?? [])
      const pre = searchParams.get('cliente')
      if (pre) setClienteId(pre)
    })()
  }, [searchParams])

  // Cargar referencias del cliente seleccionado
  useEffect(() => {
    if (!clienteId) {
      setReferencias([])
      return
    }
    setCargandoRefs(true)
    listarReferenciasPorCliente(clienteId, true)
      .then(setReferencias)
      .catch((e) => setMensaje({ tipo: 'error', texto: `Error cargando referencias: ${e.message}` }))
      .finally(() => setCargandoRefs(false))
  }, [clienteId])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 3000)
    return () => clearTimeout(t)
  }, [mensaje])

  // ===== Añadir líneas =====
  function añadirDesdeReferencia(ref: ReferenciaCliente) {
    setLineas(ls => [
      ...ls,
      {
        tipo: 'referencia',
        referencia: ref,
        cantidad: 1,
        descripcion: ref.nombre_pieza || ref.referencia_cliente,
      },
    ])
    setDialogoRef(false)
    setMensaje({ tipo: 'ok', texto: `Añadida: ${ref.nombre_pieza || ref.referencia_cliente}` })
  }

  function añadirManual() {
    if (!formManual.descripcion.trim()) {
      setMensaje({ tipo: 'error', texto: 'La descripción es obligatoria.' })
      return
    }
    setLineas(ls => [
      ...ls,
      {
        tipo: 'manual',
        descripcion: formManual.descripcion.trim(),
        cantidad: Math.max(1, formManual.cantidad),
        precio_unitario: Math.max(0, formManual.precio),
      },
    ])
    setFormManual({ descripcion: '', cantidad: 1, precio: 0 })
    setDialogoManual(false)
    setMensaje({ tipo: 'ok', texto: 'Línea manual añadida.' })
  }

  function añadirPiezaNueva(datos: NuevaPiezaData) {
    setLineas(ls => [
      ...ls,
      {
        tipo: 'personalizada',
        descripcion: datos.descripcion,
        cantidad: datos.cantidad,
        datos: {
          categoria_pieza_id: datos.categoria_pieza_id,
          modo_precio: datos.modo_precio,
          ancho: datos.ancho,
          alto: datos.alto,
          grosor: datos.grosor,
          longitud_ml: datos.longitud_ml,
          cara_frontal: datos.cara_frontal,
          cara_trasera: datos.cara_trasera,
          canto_superior: datos.canto_superior,
          canto_inferior: datos.canto_inferior,
          canto_izquierdo: datos.canto_izquierdo,
          canto_derecho: datos.canto_derecho,
          contabilizar_grosor: datos.contabilizar_grosor,
          material_lacado_id: datos.material_lacado_id,
          material_fondo_id: datos.material_fondo_id,
          factor_complejidad: datos.factor_complejidad,
          descuento_porcentaje: datos.descuento_porcentaje,
          precio_aproximado: datos.precio_aproximado,
          procesos_codigos: datos.procesos_codigos,
          guardar_como_referencia: datos.guardar_como_referencia,
          nombre_referencia: datos.nombre_referencia,
          preview: datos.preview,
        },
      },
    ])
    setDialogoNuevaPieza(false)
    const extra = datos.guardar_como_referencia
      ? ' (se guardará también como referencia al crear el presupuesto)'
      : ''
    setMensaje({ tipo: 'ok', texto: `Pieza añadida: ${datos.descripcion}${extra}` })
  }

  function quitarLinea(idx: number) {
    setLineas(ls => ls.filter((_, i) => i !== idx))
  }

  function actLinea(idx: number, campo: string, valor: any) {
    setLineas(ls => ls.map((l, i) => i === idx ? { ...l, [campo]: valor } : l))
  }

  // ===== Totales en vivo =====
  const totales = useMemo(() => {
    let subtotal = 0
    let hayPersonalizadasSinPreview = false
    for (const l of lineas) {
      if (l.tipo === 'manual') {
        subtotal += Number(l.precio_unitario) * Math.max(1, l.cantidad)
      } else if (l.tipo === 'personalizada') {
        // Si el usuario pulsó "Calcular precio" en el diálogo, tenemos
        // un preview y lo sumamos. Si no, avisamos al usuario de que
        // ese precio se calcula al guardar.
        if (l.datos.preview) {
          subtotal += Number(l.datos.preview.precio_unitario) * Math.max(1, l.cantidad)
        } else {
          hayPersonalizadasSinPreview = true
        }
      } else {
        // Para referencias usamos precio_calculado_ultimo (snapshot)
        const precioUnit = Number(l.referencia.precio_calculado_ultimo ?? 0)
        subtotal += precioUnit * Math.max(1, l.cantidad)
      }
    }
    const desc = (subtotal * descuentoGlobal) / 100
    const base = subtotal - desc
    const ivaEur = (base * iva) / 100
    const total = base + ivaEur
    return { subtotal, desc, base, ivaEur, total, hayPersonalizadasSinPreview }
  }, [lineas, descuentoGlobal, iva])

  async function guardar() {
    if (!clienteId) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un cliente.' })
      return
    }
    if (lineas.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Añade al menos una línea.' })
      return
    }
    setGuardando(true)
    try {
      const lineasInput: LineaPresupuestoInput[] = lineas.map((l, idx): LineaPresupuestoInput => {
        if (l.tipo === 'manual') {
          return {
            tipo: 'manual',
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            orden: idx,
            precio_unitario_manual: l.precio_unitario,
          }
        }
        if (l.tipo === 'personalizada') {
          return {
            tipo: 'personalizada',
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            orden: idx,
            datos_personalizada: {
              categoria_pieza_id: l.datos.categoria_pieza_id,
              modo_precio: l.datos.modo_precio,
              ancho: l.datos.ancho,
              alto: l.datos.alto,
              grosor: l.datos.grosor,
              longitud_ml: l.datos.longitud_ml,
              cara_frontal: l.datos.cara_frontal,
              cara_trasera: l.datos.cara_trasera,
              canto_superior: l.datos.canto_superior,
              canto_inferior: l.datos.canto_inferior,
              canto_izquierdo: l.datos.canto_izquierdo,
              canto_derecho: l.datos.canto_derecho,
              contabilizar_grosor: l.datos.contabilizar_grosor,
              material_lacado_id: l.datos.material_lacado_id,
              material_fondo_id: l.datos.material_fondo_id,
              factor_complejidad: l.datos.factor_complejidad,
              descuento_porcentaje: l.datos.descuento_porcentaje,
              precio_aproximado: l.datos.precio_aproximado,
              // Procesos seleccionados por el usuario en el formulario
              // Nueva pieza. El backend rellena tiempos desde
              // PROCESOS_DEFAULTS si no los especificamos aquí.
              procesos: l.datos.procesos_codigos.map((codigo, i) => ({
                proceso_codigo: codigo,
                orden: i + 1,
                tiempo_base_min: 0,
                tiempo_por_m2_min: 0,
              })),
            },
          }
        }
        return {
          tipo: 'referencia',
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          orden: idx,
          referencia: l.referencia,
        }
      })

      const resultado = await crearPresupuestoV2({
        cliente_id: clienteId,
        fecha,
        validez_dias: validezDias,
        iva_porcentaje: iva,
        descuento_porcentaje: descuentoGlobal,
        observaciones_comerciales: obsComerciales || undefined,
        observaciones_internas: obsInternas || undefined,
        lineas: lineasInput,
      })

      // Presupuesto creado OK. Ahora, para cada línea personalizada que
      // pidió "guardar como referencia", creamos la referencia. Si falla,
      // avisamos pero NO revertimos el presupuesto.
      const piezasAGuardar = lineas
        .filter((l): l is Extract<LineaItem, { tipo: 'personalizada' }> =>
          l.tipo === 'personalizada' && l.datos.guardar_como_referencia
        )

      let referenciasOk = 0
      const referenciasError: string[] = []
      for (const p of piezasAGuardar) {
        try {
          // Código único por cliente: slug del nombre + timestamp corto.
          // Si el usuario ya tiene una con ese mismo nombre, diferenciamos
          // con sufijo numérico automático del timestamp.
          const slug = (p.datos.nombre_referencia || p.descripcion)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 32) || 'ref'
          const codigo = `${slug}-${Date.now().toString(36).slice(-4)}`
          await crearReferencia({
            cliente_id: clienteId,
            referencia_cliente: codigo,
            referencia_interna: null,
            nombre_pieza: p.datos.nombre_referencia || p.descripcion,
            descripcion: p.descripcion,
            categoria_pieza_id: p.datos.categoria_pieza_id,
            modo_precio: p.datos.modo_precio,
            ancho: p.datos.ancho,
            alto: p.datos.alto,
            grosor: p.datos.grosor,
            longitud_ml: p.datos.longitud_ml,
            cara_frontal: p.datos.cara_frontal,
            cara_trasera: p.datos.cara_trasera,
            canto_superior: p.datos.canto_superior,
            canto_inferior: p.datos.canto_inferior,
            canto_izquierdo: p.datos.canto_izquierdo,
            canto_derecho: p.datos.canto_derecho,
            contabilizar_grosor: p.datos.contabilizar_grosor,
            material_lacado_id: p.datos.material_lacado_id,
            material_fondo_id: p.datos.material_fondo_id,
            procesos: p.datos.procesos_codigos.map((codigo, i) => ({
              proceso_codigo: codigo,
              orden: i + 1,
            })),
            factor_complejidad: p.datos.factor_complejidad,
            descuento_porcentaje: p.datos.descuento_porcentaje,
            precio_aproximado: p.datos.precio_aproximado,
            precio_pactado: null,
            observaciones: null,
            activo: true,
          } as any)
          referenciasOk += 1
        } catch (e: any) {
          referenciasError.push(
            `${p.datos.nombre_referencia || p.descripcion}: ${e?.message ?? 'error'}`
          )
        }
      }

      let texto = `Presupuesto ${resultado.numero} creado (${EURO(resultado.total)} total).`
      if (referenciasOk > 0) {
        texto += ` · ${referenciasOk} referencia(s) guardada(s).`
      }
      if (referenciasError.length > 0) {
        texto += ` · Aviso: ${referenciasError.length} referencia(s) NO se guardaron (puedes crearlas a mano desde la ficha del cliente).`
      }
      setMensaje({
        tipo: referenciasError.length > 0 ? 'error' : 'ok',
        texto,
      })
      // Redirigir al detalle (presupuesto sí se creó siempre)
      setTimeout(() => {
        router.push(`/presupuestos/${resultado.presupuesto_id}`)
      }, referenciasError.length > 0 ? 2500 : 800)
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: `Error: ${e.message || e}` })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Nuevo presupuesto (motor ERP)
        </h1>
        <p className="text-muted-foreground">
          Carga piezas recurrentes del cliente o añade líneas manuales.
          El coste, margen y consumo de materiales se calcula automáticamente.
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-300">
        <Info className="w-4 h-4" />
        <AlertDescription className="text-sm">
          Esta es la ruta del presupuestador <strong>nuevo</strong>, con motor de costes real.
          El presupuestador clásico (<code>/presupuestos/nuevo</code>) sigue disponible
          mientras terminamos de migrar.
        </AlertDescription>
      </Alert>

      {/* Cabecera */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecciona un cliente…" /></SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre_comercial}{c.razon_social ? ` — ${c.razon_social}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label>Validez (días)</Label>
            <Input type="number" min="1" value={validezDias}
              onChange={(e) => setValidezDias(parseInt(e.target.value) || 30)} />
          </div>
          <div>
            <Label>IVA %</Label>
            <Input type="number" min="0" step="0.1" value={iva}
              onChange={(e) => setIva(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Descuento global %</Label>
            <Input type="number" min="0" max="100" value={descuentoGlobal}
              onChange={(e) => setDescuentoGlobal(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="md:col-span-2">
            <Label>Observaciones comerciales (se imprimen)</Label>
            <Textarea rows={2} value={obsComerciales}
              onChange={(e) => setObsComerciales(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Label>Observaciones internas (no se imprimen)</Label>
            <Textarea rows={2} value={obsInternas}
              onChange={(e) => setObsInternas(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Líneas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Líneas del presupuesto ({lineas.length})</CardTitle>
            <CardDescription>
              Añade piezas recurrentes del cliente o escribe líneas manuales
              (piezas irregulares, servicios extra, etc.).
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setDialogoRef(true)}
              disabled={!clienteId}
            >
              <Layers className="w-4 h-4 mr-2" />
              + Desde referencia
            </Button>
            <Button
              variant="outline"
              onClick={() => setDialogoNuevaPieza(true)}
              disabled={!clienteId}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              + Nueva pieza
            </Button>
            <Button
              variant="outline"
              onClick={() => setDialogoManual(true)}
              disabled={!clienteId}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              + Línea manual
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lineas.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">
              {clienteId
                ? 'Añade tu primera línea con los botones de arriba.'
                : 'Selecciona primero un cliente.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right w-24">Cant.</TableHead>
                  <TableHead className="text-right w-28">Precio ud.</TableHead>
                  <TableHead className="text-right w-28">Subtotal</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l, idx) => {
                  let precioUnit = 0
                  let precioUnitDisplay: string
                  let personalizadaSinPreview = false
                  if (l.tipo === 'manual') {
                    precioUnit = l.precio_unitario
                    precioUnitDisplay = EURO(precioUnit)
                  } else if (l.tipo === 'referencia') {
                    precioUnit = Number(l.referencia.precio_calculado_ultimo ?? 0)
                    precioUnitDisplay = EURO(precioUnit)
                  } else {
                    // personalizada: usar preview si lo hay, si no "Al guardar"
                    if (l.datos.preview) {
                      precioUnit = Number(l.datos.preview.precio_unitario)
                      precioUnitDisplay = EURO(precioUnit)
                    } else {
                      precioUnit = 0
                      precioUnitDisplay = 'Al guardar'
                      personalizadaSinPreview = true
                    }
                  }
                  const subtotal = precioUnit * Math.max(1, l.cantidad)
                  const subtotalDisplay = personalizadaSinPreview ? '—' : EURO(subtotal)

                  let badgeLabel = 'Ref.'
                  let badgeClase = ''
                  if (l.tipo === 'manual') {
                    badgeLabel = 'Manual'
                  } else if (l.tipo === 'personalizada') {
                    badgeLabel = 'Nueva'
                    badgeClase = 'border-blue-300 text-blue-700 bg-blue-50'
                  }

                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${badgeClase}`}>
                          {badgeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={l.descripcion}
                          onChange={(e) => actLinea(idx, 'descripcion', e.target.value)}
                          className="h-8 text-sm"
                        />
                        {l.tipo === 'referencia' && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {l.referencia.referencia_cliente} · modo {l.referencia.modo_precio}
                          </p>
                        )}
                        {l.tipo === 'personalizada' && (
                          <p className="text-xs text-blue-700 mt-1">
                            {l.datos.modo_precio === 'ml'
                              ? `${l.datos.longitud_ml ?? '?'} ml`
                              : `${l.datos.ancho ?? '?'}×${l.datos.alto ?? '?'} mm`}
                            {' · '}{l.datos.factor_complejidad}
                            {l.datos.guardar_como_referencia && ' · se guardará como ref.'}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min="1"
                          value={l.cantidad}
                          onChange={(e) => actLinea(idx, 'cantidad', parseInt(e.target.value) || 1)}
                          className="h-8 text-sm text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {l.tipo === 'manual' ? (
                          <Input
                            type="number" step="0.01" min="0"
                            value={l.precio_unitario}
                            onChange={(e) => actLinea(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm text-right"
                          />
                        ) : (
                          <span className={personalizadaSinPreview ? 'text-muted-foreground italic' : ''}>
                            {precioUnitDisplay}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {subtotalDisplay}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => quitarLinea(idx)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
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

      {/* Totales */}
      {lineas.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            {totales.hayPersonalizadasSinPreview && (
              <Alert className="mb-4 bg-blue-50 border-blue-200 text-blue-900">
                <Info className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Hay piezas nuevas sin calcular. Su precio se calcula en
                  servidor al guardar (motor ERP con rendimientos y tarifas),
                  o puedes pulsar <strong>Calcular precio</strong> en el
                  diálogo de cada pieza para verlo ya aquí.
                </AlertDescription>
              </Alert>
            )}
            <div className="max-w-md ml-auto space-y-1 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono font-medium">{EURO(totales.subtotal)}</span>
              </div>
              {descuentoGlobal > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Descuento ({descuentoGlobal}%)</span>
                  <span className="font-mono text-red-600">−{EURO(totales.desc)}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Base imponible</span>
                <span className="font-mono">{EURO(totales.base)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">IVA ({iva}%)</span>
                <span className="font-mono">{EURO(totales.ivaEur)}</span>
              </div>
              <div className="flex justify-between py-2 border-t mt-2 text-lg">
                <span className="font-bold">TOTAL</span>
                <span className="font-mono font-bold text-blue-700">{EURO(totales.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acción */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={guardando}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={guardando || lineas.length === 0 || !clienteId}>
          {guardando
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando…</>
            : <><Save className="w-4 h-4 mr-2" />Guardar presupuesto</>}
        </Button>
      </div>

      {/* DIALOG SELECCIONAR REFERENCIA */}
      <Dialog open={dialogoRef} onOpenChange={setDialogoRef}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Selecciona una pieza recurrente</DialogTitle>
            <DialogDescription>
              Estas son las piezas que ya tienes configuradas para este cliente.
              Haz clic en una para añadirla como línea del presupuesto.
            </DialogDescription>
          </DialogHeader>

          {cargandoRefs ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : referencias.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">
              Este cliente no tiene piezas recurrentes.
              Créalas desde su ficha &gt; tab Referencias.
            </p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto border rounded">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Pieza</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead className="text-right">Precio ud.</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referencias.map(r => (
                    <TableRow key={r.id} className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => añadirDesdeReferencia(r)}>
                      <TableCell className="font-mono text-xs font-semibold">{r.referencia_cliente}</TableCell>
                      <TableCell>{r.nombre_pieza ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.modo_precio}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold text-blue-700">
                        {r.precio_calculado_ultimo != null ? EURO(Number(r.precio_calculado_ultimo)) : '—'}
                      </TableCell>
                      <TableCell>
                        <Button size="sm">Añadir</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoRef(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG LÍNEA MANUAL */}
      <Dialog open={dialogoManual} onOpenChange={setDialogoManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva línea manual</DialogTitle>
            <DialogDescription>
              Para piezas irregulares, servicios extra, portes, etc.
              Descripción libre y precio a mano.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label>Descripción *</Label>
              <Input
                value={formManual.descripcion}
                onChange={(e) => setFormManual({ ...formManual, descripcion: e.target.value })}
                placeholder="Ej: Pieza irregular cliente (presupuesto aproximado)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad</Label>
                <Input type="number" min="1" value={formManual.cantidad}
                  onChange={(e) => setFormManual({ ...formManual, cantidad: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Precio unitario (€)</Label>
                <Input type="number" step="0.01" min="0" value={formManual.precio}
                  onChange={(e) => setFormManual({ ...formManual, precio: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoManual(false)}>Cancelar</Button>
            <Button onClick={añadirManual}>
              <Plus className="w-4 h-4 mr-2" />
              Añadir línea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nueva pieza personalizada */}
      {dialogoNuevaPieza && clienteId && (
        <DialogNuevaPiezaV2
          open={dialogoNuevaPieza}
          onOpenChange={setDialogoNuevaPieza}
          clienteId={clienteId}
          onConfirmar={añadirPiezaNueva}
        />
      )}

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
