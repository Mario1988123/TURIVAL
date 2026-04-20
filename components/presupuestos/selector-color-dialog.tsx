'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

export type ColorItem = {
  id: string
  codigo: string
  nombre: string
  tipo: 'RAL' | 'NCS' | 'referencia_interna' | 'muestra_cliente'
  hex_aproximado: string | null
  sobrecoste: number | null
}

const TIPOS_LABEL: Record<string, string> = {
  RAL: 'RAL',
  NCS: 'NCS',
  referencia_interna: 'Referencia interna',
  muestra_cliente: 'Muestra cliente',
}

function etiquetaGrupoRAL(digito: string): string {
  const m: Record<string, string> = {
    '1': 'Amarillos y beiges',
    '2': 'Naranjas',
    '3': 'Rojos',
    '4': 'Violetas',
    '5': 'Azules',
    '6': 'Verdes',
    '7': 'Grises',
    '8': 'Marrones',
    '9': 'Blancos y negros',
  }
  return m[digito] || 'Otros'
}

function esColorOscuro(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length !== 6) return false
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminancia < 0.5
}

export default function SelectorColorDialog({
  abierto,
  onCerrar,
  colores,
  onSeleccionar,
  colorSeleccionadoId,
}: {
  abierto: boolean
  onCerrar: () => void
  colores: ColorItem[]
  onSeleccionar: (color: ColorItem | null) => void
  colorSeleccionadoId: string | null
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  const coloresFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return colores.filter((c) => {
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false
      if (q) {
        const hay =
          c.codigo.toLowerCase().includes(q) ||
          c.nombre.toLowerCase().includes(q) ||
          (c.hex_aproximado || '').toLowerCase().includes(q)
        if (!hay) return false
      }
      return true
    })
  }, [colores, busqueda, filtroTipo])

  const coloresPorGrupo = useMemo(() => {
    const grupos: Record<string, ColorItem[]> = {}
    for (const c of coloresFiltrados) {
      let clave: string
      if (c.tipo === 'RAL') {
        const match = c.codigo.match(/RAL\s*(\d)/)
        clave = match
          ? `RAL ${match[1]}000 — ${etiquetaGrupoRAL(match[1])}`
          : 'RAL (otros)'
      } else {
        clave = TIPOS_LABEL[c.tipo]
      }
      if (!grupos[clave]) grupos[clave] = []
      grupos[clave].push(c)
    }
    return grupos
  }, [coloresFiltrados])

  const clavesOrdenadas = Object.keys(coloresPorGrupo).sort()

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleccionar color</DialogTitle>
          <DialogDescription>
            {colores.length} colores disponibles. Filtra y pulsa uno para seleccionarlo.
          </DialogDescription>
        </DialogHeader>

        {/* Barra de búsqueda y filtros */}
        <div className="flex gap-3 items-center flex-wrap border-b pb-3">
          <div className="flex-1 min-w-60 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar código, nombre o hex…"
              className="pl-10"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['todos', 'RAL', 'NCS', 'referencia_interna', 'muestra_cliente'].map((t) => (
              <Button
                key={t}
                variant={filtroTipo === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroTipo(t)}
              >
                {t === 'todos' ? 'Todos' : TIPOS_LABEL[t]}
              </Button>
            ))}
          </div>
          {colorSeleccionadoId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSeleccionar(null)
                onCerrar()
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Quitar color
            </Button>
          )}
        </div>

        {/* Contador */}
        <div className="text-xs text-muted-foreground">
          Mostrando <strong>{coloresFiltrados.length}</strong> colores
        </div>

        {/* Grid scrollable */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {clavesOrdenadas.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No hay colores que coincidan con la búsqueda.
            </div>
          ) : (
            clavesOrdenadas.map((clave) => (
              <div key={clave}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {clave} · {coloresPorGrupo[clave].length}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {coloresPorGrupo[clave].map((c) => {
                    const hex = c.hex_aproximado || '#DDDDDD'
                    const seleccionado = colorSeleccionadoId === c.id
                    const textoClaro = esColorOscuro(hex)
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          onSeleccionar(c)
                          onCerrar()
                        }}
                        className={`relative rounded-md overflow-hidden border text-left hover:shadow-md transition ${
                          seleccionado ? 'ring-2 ring-blue-500 border-blue-500' : ''
                        }`}
                      >
                        <div
                          className="h-14 flex items-start justify-end p-1"
                          style={{ backgroundColor: hex }}
                        >
                          {Number(c.sobrecoste || 0) > 0 && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                textoClaro
                                  ? 'bg-white/90 text-slate-900'
                                  : 'bg-slate-900/80 text-white border-slate-700'
                              }`}
                            >
                              +{Number(c.sobrecoste).toFixed(2)}€
                            </Badge>
                          )}
                        </div>
                        <div className="p-1.5 bg-white">
                          <p className="text-[11px] font-semibold truncate">
                            {c.codigo}
                          </p>
                          <p className="text-[10px] text-slate-600 truncate">
                            {c.nombre}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
