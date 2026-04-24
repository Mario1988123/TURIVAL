'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, Truck, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import {
  accionCambiarEstadoAlbaran,
} from '@/lib/actions/albaranes'
import type { AlbaranDetalle, EstadoAlbaran } from '@/lib/services/albaranes'
import type { ConfiguracionEmpresa } from '@/lib/services/configuracion'

const ESTADO_CLASES: Record<EstadoAlbaran, string> = {
  borrador:  'bg-slate-100 text-slate-700 border-slate-300',
  impreso:   'bg-blue-100 text-blue-800 border-blue-300',
  entregado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

function formatearFecha(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function AlbaranDetalleCliente({
  albaran,
  empresa,
}: {
  albaran: AlbaranDetalle
  empresa: ConfiguracionEmpresa | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [enviando, setEnviando] = useState(false)

  async function cambiarEstado(estado: EstadoAlbaran) {
    setEnviando(true)
    try {
      const res = await accionCambiarEstadoAlbaran({ albaran_id: albaran.id, estado })
      if (res.ok) startTransition(() => router.refresh())
      else alert(`Error: ${res.error}`)
    } finally {
      setEnviando(false)
    }
  }

  function imprimir() {
    // Si está en borrador, marcamos como impreso y disparamos print tras refresh.
    // Si no, solo imprimimos.
    if (albaran.estado === 'borrador') {
      cambiarEstado('impreso').then(() => setTimeout(() => window.print(), 200))
    } else {
      window.print()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de acciones — no se imprime */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => router.push('/albaranes')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={ESTADO_CLASES[albaran.estado]}>
            {albaran.estado}
          </Badge>
          {albaran.estado === 'borrador' || albaran.estado === 'impreso' ? (
            <Button variant="default" size="sm" onClick={imprimir} disabled={enviando} className="gap-1.5">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Imprimir
            </Button>
          ) : null}
          {albaran.estado === 'impreso' && (
            <Button variant="outline" size="sm" onClick={() => cambiarEstado('entregado')} disabled={enviando} className="gap-1.5">
              <Truck className="h-4 w-4" /> Marcar entregado
            </Button>
          )}
          {albaran.estado === 'entregado' && (
            <span className="flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Entregado
            </span>
          )}
        </div>
      </div>

      {/* Contenido imprimible */}
      <div className="mx-auto w-full max-w-[210mm] rounded-lg bg-white p-8 shadow-sm print:shadow-none print:rounded-none print:p-4">
        {/* Cabecera */}
        <div className="mb-8 flex items-start justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ALBARÁN</h1>
            <p className="mt-1 font-mono text-lg font-semibold text-slate-700">{albaran.numero}</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold text-slate-700">Fecha entrega</div>
            <div>{formatearFecha(albaran.fecha_entrega)}</div>
          </div>
        </div>

        {/* Emisor desde configuracion_empresa */}
        <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Emisor</div>
            {empresa?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logo_url} alt="Logo" className="mb-2 h-12 w-auto object-contain" />
            )}
            <div className="font-semibold">{empresa?.razon_social || empresa?.nombre_comercial || 'Turiaval'}</div>
            {empresa?.cif_nif && <div className="text-slate-600">CIF: {empresa.cif_nif}</div>}
            {empresa?.direccion && <div className="text-slate-600">{empresa.direccion}</div>}
            {(empresa?.codigo_postal || empresa?.ciudad) && (
              <div className="text-slate-600">
                {[empresa.codigo_postal, empresa.ciudad, empresa.provincia].filter(Boolean).join(' · ')}
              </div>
            )}
            {empresa?.telefono && <div className="text-slate-600">Tel: {empresa.telefono}</div>}
            {empresa?.email && <div className="text-slate-600">{empresa.email}</div>}
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Cliente</div>
            <div className="font-semibold">{albaran.cliente_nombre}</div>
            {albaran.cliente_direccion && <div className="text-slate-600">{albaran.cliente_direccion}</div>}
            {albaran.cliente_ciudad && <div className="text-slate-600">{albaran.cliente_ciudad}</div>}
            {albaran.cliente_cif && <div className="text-slate-600">CIF: {albaran.cliente_cif}</div>}
          </div>
        </div>

        <div className="mb-4 text-sm">
          <span className="text-slate-500">Pedido:</span>{' '}
          <span className="font-semibold">{albaran.pedido_numero}</span>
        </div>

        {/* Líneas */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y bg-slate-50">
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">#</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">Pieza</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">Descripción</th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-700">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {albaran.piezas.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-sm text-slate-500">
                  Sin piezas
                </td>
              </tr>
            ) : (
              albaran.piezas.map((p, i) => (
                <tr key={p.linea_id} className="border-b">
                  <td className="px-2 py-2 text-xs">{i + 1}</td>
                  <td className="px-2 py-2 font-mono text-xs">{p.pieza_numero ?? '—'}</td>
                  <td className="px-2 py-2 text-xs">{p.descripcion ?? ''}</td>
                  <td className="px-2 py-2 text-right text-xs">{p.cantidad}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-slate-50">
              <td colSpan={3} className="px-2 py-2 text-right text-xs font-semibold">Total piezas</td>
              <td className="px-2 py-2 text-right font-semibold">{albaran.piezas.length}</td>
            </tr>
          </tfoot>
        </table>

        {albaran.observaciones && (
          <div className="mt-6 text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Observaciones</div>
            <div className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3">
              {albaran.observaciones}
            </div>
          </div>
        )}

        {/* Firma */}
        <div className="mt-10 grid grid-cols-2 gap-6">
          <div>
            <div className="h-16 border-b border-dashed border-slate-400" />
            <div className="mt-1 text-xs text-slate-500">Firma emisor</div>
          </div>
          <div>
            <div className="h-16 border-b border-dashed border-slate-400" />
            <div className="mt-1 text-xs text-slate-500">Firma recibe</div>
          </div>
        </div>

        <div className="mt-8 text-center text-[10px] text-slate-400">
          Generado por Turiaval · {new Date().toLocaleDateString('es-ES')}
        </div>
      </div>
    </div>
  )
}
