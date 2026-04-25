'use client'

/**
 * Wrapper visual para seleccionar un material tipo 'lacado' (o 'fondo')
 * reutilizando el dialog visual SelectorColorDialog (que usa ColorItem).
 *
 * Acepta una lista `MaterialConProveedor` y la adapta al formato ColorItem.
 * El botón pinta la muestra de color del material seleccionado + código/nombre.
 */

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Palette, X } from 'lucide-react'
import SelectorColorDialog, { type ColorItem } from './selector-color-dialog'
import type { MaterialConProveedor } from '@/lib/types/erp'

interface Props {
  materiales: MaterialConProveedor[]
  valorId: string
  onSeleccionar: (material_id: string) => void
  placeholder?: string
  /** Para que encaje con el grid: 'lacado' (default) o 'fondo'. */
  etiqueta?: string
}

export default function SelectorMaterialColor({
  materiales,
  valorId,
  onSeleccionar,
  placeholder = 'Opcional',
  etiqueta,
}: Props) {
  const [abierto, setAbierto] = useState(false)

  const items: ColorItem[] = useMemo(() => materiales.map((m) => ({
    id: m.id,
    codigo: m.codigo ?? '',
    nombre: m.nombre,
    // Heurística: los materiales que vienen de RAL/NCS mantienen el prefijo en su código.
    tipo: (m.codigo?.toUpperCase().startsWith('NCS') ? 'NCS'
      : m.codigo?.toUpperCase().startsWith('RAL') ? 'RAL'
      : 'referencia_interna'),
    hex_aproximado: m.hex_aproximado ?? null,
    sobrecoste: null,
  })), [materiales])

  const seleccionado = items.find((c) => c.id === valorId)

  return (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setAbierto(true)}
          className="flex-1 justify-start gap-2"
        >
          {seleccionado ? (
            <>
              <span
                className="inline-block h-5 w-5 flex-shrink-0 rounded border border-slate-300"
                style={{ backgroundColor: seleccionado.hex_aproximado || '#ddd' }}
              />
              <span className="truncate text-left">
                <span className="font-semibold">{seleccionado.codigo}</span>
                {seleccionado.nombre && <span className="text-slate-500"> · {seleccionado.nombre}</span>}
              </span>
            </>
          ) : (
            <>
              <Palette className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">{placeholder}</span>
            </>
          )}
        </Button>
        {valorId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onSeleccionar('')}
            title="Quitar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <SelectorColorDialog
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        colores={items}
        colorSeleccionadoId={valorId || null}
        onSeleccionar={(c) => onSeleccionar(c?.id ?? '')}
      />
      {/* etiqueta usada solo para prop typing; evita warning */}
      {etiqueta && <span className="sr-only">{etiqueta}</span>}
    </>
  )
}
