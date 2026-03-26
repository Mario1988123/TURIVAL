'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  listarProductos,
  listarColores,
  listarTratamientos,
  listarAcabados,
  listarTarifas,
} from '@/lib/services'
import { Plus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Producto, Color, Tratamiento, Acabado, Tarifa } from '@/lib/types/erp'

export default function CatalogosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [colores, setColores] = useState<Color[]>([])
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [acabados, setAcabados] = useState<any[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarCatalogos() {
      try {
        const [prod, col, trat, acab, tar] = await Promise.all([
          listarProductos(false),
          listarColores({ activos_solo: false }),
          listarTratamientos(false),
          listarAcabados(false),
          listarTarifas({ activos_solo: false }),
        ])

        setProductos(prod)
        setColores(col)
        setTratamientos(trat)
        setAcabados(acab)
        setTarifas(tar)
      } catch (error) {
        console.error('[v0] Error cargando catálogos:', error)
      } finally {
        setLoading(false)
      }
    }

    cargarCatalogos()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Catálogos</h1>
        <p className="text-slate-600 mt-1">Gestiona productos, colores, tratamientos y tarifas</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="productos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="colores">Colores</TabsTrigger>
          <TabsTrigger value="tratamientos">Tratamientos</TabsTrigger>
          <TabsTrigger value="acabados">Acabados</TabsTrigger>
          <TabsTrigger value="tarifas">Tarifas</TabsTrigger>
        </TabsList>

        {/* PRODUCTOS */}
        <TabsContent value="productos" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Productos / Tipos de Pieza</h2>
              <p className="text-sm text-slate-600">{productos.length} productos registrados</p>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : productos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productos.map((prod) => (
                      <TableRow key={prod.id}>
                        <TableCell className="font-medium">{prod.nombre}</TableCell>
                        <TableCell>{prod.categoria || '-'}</TableCell>
                        <TableCell>{prod.unidad_tarificacion}</TableCell>
                        <TableCell>
                          <Badge variant={prod.activo ? 'default' : 'secondary'}>
                            {prod.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-slate-500 py-8">No hay productos</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* COLORES */}
        <TabsContent value="colores" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Colores</h2>
              <p className="text-sm text-slate-600">{colores.length} colores registrados</p>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Color
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : colores.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Sobrecoste</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colores.map((color) => (
                      <TableRow key={color.id}>
                        <TableCell className="font-mono font-bold">{color.codigo}</TableCell>
                        <TableCell>{color.nombre}</TableCell>
                        <TableCell>{color.tipo}</TableCell>
                        <TableCell>{color.sobrecoste > 0 ? `+${color.sobrecoste}€` : '-'}</TableCell>
                        <TableCell>
                          <Badge variant={color.activo ? 'default' : 'secondary'}>
                            {color.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-slate-500 py-8">No hay colores</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRATAMIENTOS */}
        <TabsContent value="tratamientos" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Tratamientos</h2>
              <p className="text-sm text-slate-600">{tratamientos.length} tratamientos registrados</p>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Tratamiento
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : tratamientos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Multiplicador Coste</TableHead>
                      <TableHead>Tiempo Base (min)</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tratamientos.map((trat) => (
                      <TableRow key={trat.id}>
                        <TableCell className="font-medium">{trat.nombre}</TableCell>
                        <TableCell>{trat.multiplicador_coste.toFixed(2)}x</TableCell>
                        <TableCell>{trat.tiempo_estimado_base || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={trat.activo ? 'default' : 'secondary'}>
                            {trat.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-slate-500 py-8">No hay tratamientos</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACABADOS */}
        <TabsContent value="acabados" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Acabados</h2>
              <p className="text-sm text-slate-600">{acabados.length} acabados registrados</p>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Acabado
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : acabados.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Acabado</TableHead>
                      <TableHead>Brillo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acabados.map((acab) => (
                      <TableRow key={acab.id}>
                        <TableCell className="font-mono">{acab.codigo}</TableCell>
                        <TableCell>
                          {acab.colores?.nombre || 'N/A'}
                          {acab.colores?.hex_aproximado && (
                            <div
                              className="w-8 h-8 rounded border mt-1"
                              style={{ backgroundColor: acab.colores.hex_aproximado }}
                            />
                          )}
                        </TableCell>
                        <TableCell>{acab.acabado || '-'}</TableCell>
                        <TableCell>{acab.brillo || '-'}%</TableCell>
                        <TableCell>
                          <Badge variant={acab.activo ? 'default' : 'secondary'}>
                            {acab.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-slate-500 py-8">No hay acabados</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TARIFAS */}
        <TabsContent value="tarifas" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Tarifas</h2>
              <p className="text-sm text-slate-600">{tarifas.length} tarifas registradas</p>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Tarifa
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : tarifas.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Modo Precio</TableHead>
                      <TableHead>Precio m²</TableHead>
                      <TableHead>Precio Pieza</TableHead>
                      <TableHead>Mínimo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tarifas.map((tarifa) => (
                      <TableRow key={tarifa.id}>
                        <TableCell className="font-medium">{tarifa.nombre}</TableCell>
                        <TableCell>{tarifa.modo_precio}</TableCell>
                        <TableCell>{tarifa.precio_m2 ? `${tarifa.precio_m2}€` : '-'}</TableCell>
                        <TableCell>{tarifa.precio_pieza ? `${tarifa.precio_pieza}€` : '-'}</TableCell>
                        <TableCell>{tarifa.precio_minimo || '-'}€</TableCell>
                        <TableCell>
                          <Badge variant={tarifa.activo ? 'default' : 'secondary'}>
                            {tarifa.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-slate-500 py-8">No hay tarifas</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
