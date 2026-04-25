'use client'

/**
 * Selector visual de categoría de pieza — grid de tarjetas con icono SVG.
 *
 * Cada tarjeta representa una categoría (Zócalo, Puerta, Mueble cocina,
 * Mobiliario, Listón, Irregular) y al pulsar dispara `onSeleccionar(cat)`.
 * El padre usa los defaults de la categoría (`procesos_default`,
 * `caras_default`, `modo_precio_default`, `permite_ml`,
 * `contabilizar_grosor_default`) para pre-rellenar el formulario.
 *
 * Los iconos son SVGs inline simples, sin librerías externas.
 */

import { Button } from '@/components/ui/button'
import type { CategoriaPieza } from '@/lib/types/erp'

interface Props {
  categorias: CategoriaPieza[]
  categoriaSeleccionadaId: string | null
  onSeleccionar: (categoria: CategoriaPieza) => void
}

function IconoCategoria({ codigo, color }: { codigo: string; color: string }) {
  // Dibujitos SVG orientativos por código
  const stroke = color || '#64748b'
  switch (codigo) {
    case 'ZOCALO':
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-16" fill="none">
          <rect x="4" y="36" width="56" height="10" rx="1" fill={stroke + '33'} stroke={stroke} strokeWidth="1.5" />
          <rect x="4" y="46" width="56" height="14" rx="1" fill={stroke + '11'} stroke={stroke} strokeWidth="1" />
          <line x1="4" y1="41" x2="60" y2="41" stroke={stroke} strokeWidth="0.5" strokeDasharray="2 2" />
        </svg>
      )
    case 'PUERTA':
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-10" fill="none">
          <rect x="14" y="6" width="36" height="54" rx="1" fill={stroke + '22'} stroke={stroke} strokeWidth="1.5" />
          <rect x="18" y="12" width="28" height="20" rx="1" fill={stroke + '11'} stroke={stroke} strokeWidth="1" />
          <rect x="18" y="36" width="28" height="18" rx="1" fill={stroke + '11'} stroke={stroke} strokeWidth="1" />
          <circle cx="43" cy="34" r="1.5" fill={stroke} />
        </svg>
      )
    case 'MUEBLE_COCINA':
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-12" fill="none">
          <rect x="6" y="10" width="24" height="44" rx="1" fill={stroke + '22'} stroke={stroke} strokeWidth="1.5" />
          <rect x="34" y="10" width="24" height="44" rx="1" fill={stroke + '22'} stroke={stroke} strokeWidth="1.5" />
          <circle cx="18" cy="32" r="1.5" fill={stroke} />
          <circle cx="46" cy="32" r="1.5" fill={stroke} />
          <line x1="6" y1="34" x2="30" y2="34" stroke={stroke} strokeWidth="1" />
          <line x1="34" y1="34" x2="58" y2="34" stroke={stroke} strokeWidth="1" />
        </svg>
      )
    case 'MOBILIARIO':
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-12" fill="none">
          <path d="M8 20 L56 20 L56 52 L8 52 Z" fill={stroke + '22'} stroke={stroke} strokeWidth="1.5" />
          <path d="M8 20 L14 12 L62 12 L56 20 Z" fill={stroke + '33'} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M56 20 L62 12 L62 44 L56 52 Z" fill={stroke + '44'} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )
    case 'LISTON':
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-12" fill="none">
          <path d="M8 24 L56 18 L60 22 L12 28 Z" fill={stroke + '33'} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 28 L60 22 L60 30 L12 36 Z" fill={stroke + '22'} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 24 L12 28 L12 36 L8 32 Z" fill={stroke + '44'} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )
    case 'IRREGULAR':
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-10" fill="none">
          <path d="M10 22 Q 20 6, 34 14 Q 52 8, 56 28 Q 60 48, 42 54 Q 22 60, 14 46 Q 4 34, 10 22 Z" fill={stroke + '22'} stroke={stroke} strokeWidth="1.5" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 64 64" className="h-10 w-10" fill="none">
          <rect x="12" y="12" width="40" height="40" rx="2" fill={stroke + '22'} stroke={stroke} strokeWidth="1.5" />
        </svg>
      )
  }
}

export default function SelectorCategoriaPieza({ categorias, categoriaSeleccionadaId, onSeleccionar }: Props) {
  if (categorias.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
        No hay categorías de pieza dadas de alta.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
      {categorias.map((cat) => {
        const seleccionada = cat.id === categoriaSeleccionadaId
        return (
          <Button
            key={cat.id}
            type="button"
            variant="outline"
            onClick={() => onSeleccionar(cat)}
            className={`flex h-auto flex-col items-center gap-1 p-3 ${
              seleccionada
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                : 'hover:border-blue-300 hover:bg-blue-50/40'
            }`}
            title={cat.descripcion || cat.nombre}
          >
            <IconoCategoria codigo={cat.codigo} color={cat.color || '#64748b'} />
            <span className="text-xs font-medium">{cat.nombre}</span>
            <span className="text-[10px] text-slate-500">
              {cat.caras_default} cara{cat.caras_default !== 1 ? 's' : ''} · {cat.modo_precio_default}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
