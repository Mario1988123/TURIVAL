'use client'

import { useEffect } from 'react'
import VisualizacionPiezaSVG from './visualizacion-pieza-svg'
import { Printer, ArrowLeft } from 'lucide-react'

type Cliente = {
  nombre_comercial: string
  razon_social: string | null
  cif_nif: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  codigo_postal: string | null
  ciudad: string | null
  provincia: string | null
  persona_contacto: string | null
}

type Presupuesto = {
  id: string
  numero: string
  fecha: string
  estado: string
  validez_dias: number
  fecha_entrega_estimada: string | null
  observaciones_comerciales: string | null
  subtotal: number
  descuento_porcentaje: number
  descuento_importe: number
  base_imponible: number
  iva_porcentaje: number
  iva_importe: number
  total: number
  cliente: Cliente | null
}

type Linea = {
  id: string
  orden: number
  descripcion: string
  cantidad: number
  tipo_pieza: 'tablero' | 'frente' | 'moldura' | 'irregular' | null
  modo_precio: string
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
  superficie_m2: number | null
  precio_unitario: number | null
  total_linea: number
  suplemento_manual: number
}

type Empresa = {
  razon_social: string | null
  nombre_comercial: string | null
  cif_nif: string | null
  direccion: string | null
  codigo_postal: string | null
  ciudad: string | null
  provincia: string | null
  pais: string | null
  telefono: string | null
  email: string | null
  web: string | null
  iban: string | null
  logo_url: string | null
  texto_pie_presupuesto: string | null
  condiciones_pago_default: string | null
} | null

const euro = (n: number) =>
  Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

function fechaES(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function fechaValidez(fecha: string, dias: number) {
  try {
    const d = new Date(fecha)
    d.setDate(d.getDate() + dias)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export default function PresupuestoImprimible({
  presupuesto,
  lineas,
  empresa,
}: {
  presupuesto: Presupuesto
  lineas: Linea[]
  empresa: Empresa
}) {
  useEffect(() => {
    document.title = `${presupuesto.numero}`
  }, [presupuesto.numero])

  const cliente = presupuesto.cliente

  return (
    <>
      {/* BARRA SUPERIOR (se oculta al imprimir) */}
      <div className="print:hidden bg-slate-100 border-b sticky top-0 z-10 px-6 py-3 flex items-center justify-between gap-3">
        <button
          onClick={() => window.close()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Cerrar
        </button>
        <div className="text-sm text-muted-foreground">
          Pulsa <strong>Imprimir</strong> y selecciona "Guardar como PDF" en el diálogo
          del navegador.
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          <Printer className="w-4 h-4" />
          Imprimir / PDF
        </button>
      </div>

      {/* HOJA A4 */}
      <div className="hoja-a4 mx-auto my-6 bg-white shadow-sm print:shadow-none print:my-0 p-10 text-slate-900">

        {/* CABECERA */}
        <header className="flex items-start justify-between gap-6 pb-4 border-b-2 border-slate-800">
          <div className="flex-1">
            {empresa?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={empresa.logo_url}
                alt="Logo"
                className="max-h-20 max-w-[220px] object-contain mb-2"
              />
            ) : (
              <div className="text-2xl font-bold mb-1">
                {empresa?.nombre_comercial || empresa?.razon_social || 'Turiaval'}
              </div>
            )}
            <div className="text-xs text-slate-600 leading-snug">
              {empresa?.razon_social && (
                <div className="font-semibold">{empresa.razon_social}</div>
              )}
              {empresa?.cif_nif && <div>CIF/NIF: {empresa.cif_nif}</div>}
              {empresa?.direccion && (
                <div>
                  {empresa.direccion}
                  {empresa.codigo_postal && `, ${empresa.codigo_postal}`}
                  {empresa.ciudad && ` ${empresa.ciudad}`}
                  {empresa.provincia && ` (${empresa.provincia})`}
                </div>
              )}
              <div>
                {empresa?.telefono && <span>Tel: {empresa.telefono}</span>}
                {empresa?.telefono && empresa?.email && <span> · </span>}
                {empresa?.email && <span>{empresa.email}</span>}
              </div>
              {empresa?.web && <div>{empresa.web}</div>}
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block bg-slate-800 text-white px-4 py-2 rounded">
              <div className="text-[10px] uppercase tracking-wider opacity-80">
                Presupuesto
              </div>
              <div className="text-2xl font-bold">{presupuesto.numero}</div>
            </div>
            <div className="mt-2 text-xs text-slate-600 space-y-0.5">
              <div>
                <strong>Fecha:</strong> {fechaES(presupuesto.fecha)}
              </div>
              <div>
                <strong>Validez:</strong>{' '}
                {fechaValidez(presupuesto.fecha, presupuesto.validez_dias)}
              </div>
              {presupuesto.fecha_entrega_estimada && (
                <div>
                  <strong>Entrega est.:</strong>{' '}
                  {fechaES(presupuesto.fecha_entrega_estimada)}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CLIENTE */}
        {cliente && (
          <section className="mt-5 bg-slate-50 rounded p-4 border">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Cliente
            </div>
            <div className="font-bold text-lg">{cliente.nombre_comercial}</div>
            {cliente.razon_social &&
              cliente.razon_social !== cliente.nombre_comercial && (
                <div className="text-sm text-slate-700">{cliente.razon_social}</div>
              )}
            <div className="text-xs text-slate-600 mt-1 space-y-0.5">
              {cliente.cif_nif && <div>CIF/NIF: {cliente.cif_nif}</div>}
              {(cliente.direccion ||
                cliente.ciudad ||
                cliente.codigo_postal) && (
                <div>
                  {[
                    cliente.direccion,
                    cliente.codigo_postal,
                    cliente.ciudad,
                    cliente.provincia,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
              {cliente.persona_contacto && (
                <div>Contacto: {cliente.persona_contacto}</div>
              )}
              <div className="flex gap-3 flex-wrap">
                {cliente.telefono && <span>Tel: {cliente.telefono}</span>}
                {cliente.email && <span>{cliente.email}</span>}
              </div>
            </div>
          </section>
        )}

        {/* LÍNEAS */}
        <section className="mt-5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
            Detalle de trabajos
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="text-left p-2 w-8">#</th>
                <th className="text-left p-2">Descripción</th>
                <th className="text-right p-2 w-14">Uds</th>
                <th className="text-right p-2 w-20">m²/m.l.</th>
                <th className="text-right p-2 w-20">€ unit.</th>
                <th className="text-right p-2 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, idx) => {
                const tipo = l.tipo_pieza ?? 'tablero'
                const caras = [
                  l.cara_frontal && 'Frontal',
                  l.cara_trasera && 'Trasera',
                  l.canto_superior && 'C.sup',
                  l.canto_inferior && 'C.inf',
                  l.canto_izquierdo && 'C.izq',
                  l.canto_derecho && 'C.der',
                ]
                  .filter(Boolean)
                  .join(', ')
                return (
                  <tr key={l.id} className="border-b border-slate-200 align-top linea-row">
                    <td className="p-2">{idx + 1}</td>
                    <td className="p-2">
                      <div className="font-semibold mb-1">{l.descripcion}</div>
                      <div className="text-[10px] text-slate-600 space-y-0.5">
                        {tipo === 'moldura' ? (
                          <div>
                            Moldura · Longitud:{' '}
                            <strong>
                              {Number(l.longitud_ml ?? 0).toFixed(2)} m
                            </strong>{' '}
                            · Perfil: {l.ancho ?? '?'}×{l.grosor ?? '?'} mm
                          </div>
                        ) : tipo === 'irregular' ? (
                          <div>Pieza irregular · precio pactado</div>
                        ) : (
                          <>
                            <div>
                              {tipo === 'frente' ? 'Frente/Puerta' : 'Tablero'} ·
                              Dimensiones:{' '}
                              <strong>
                                {l.ancho ?? 0} × {l.alto ?? 0} × {l.grosor ?? 0} mm
                              </strong>
                            </div>
                            {caras && <div>Caras lacadas: {caras}</div>}
                          </>
                        )}
                        <div>
                          Modo:{' '}
                          {l.modo_precio === 'm2'
                            ? 'por m²'
                            : l.modo_precio === 'pieza'
                            ? 'por pieza'
                            : 'por m.l.'}
                          {Number(l.suplemento_manual) > 0 &&
                            ` · Suplemento: ${euro(Number(l.suplemento_manual))}`}
                        </div>
                      </div>
                    </td>
                    <td className="text-right p-2">{l.cantidad}</td>
                    <td className="text-right p-2">
                      {tipo === 'moldura'
                        ? `${Number(l.longitud_ml ?? 0).toFixed(2)} m`
                        : tipo === 'irregular'
                        ? '—'
                        : Number(l.superficie_m2 ?? 0).toFixed(3)}
                    </td>
                    <td className="text-right p-2">
                      {euro(Number(l.precio_unitario ?? 0))}
                    </td>
                    <td className="text-right p-2 font-semibold">
                      {euro(Number(l.total_linea))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        {/* TOTALES */}
        <section className="mt-5 flex justify-end">
          <div className="w-80 text-xs">
            <div className="flex justify-between py-1 border-b">
              <span>Subtotal</span>
              <span>{euro(Number(presupuesto.subtotal))}</span>
            </div>
            {Number(presupuesto.descuento_porcentaje) > 0 && (
              <div className="flex justify-between py-1 border-b">
                <span>Descuento ({presupuesto.descuento_porcentaje}%)</span>
                <span>−{euro(Number(presupuesto.descuento_importe))}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b">
              <span>Base imponible</span>
              <span>{euro(Number(presupuesto.base_imponible))}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span>IVA ({presupuesto.iva_porcentaje}%)</span>
              <span>{euro(Number(presupuesto.iva_importe))}</span>
            </div>
            <div className="flex justify-between py-2 bg-slate-800 text-white px-3 mt-1 rounded">
              <span className="font-bold">TOTAL</span>
              <span className="font-bold text-base">
                {euro(Number(presupuesto.total))}
              </span>
            </div>
          </div>
        </section>

        {/* OBSERVACIONES + CONDICIONES */}
        {(presupuesto.observaciones_comerciales ||
          empresa?.texto_pie_presupuesto ||
          empresa?.condiciones_pago_default) && (
          <section className="mt-6 text-[10px] text-slate-700 space-y-2">
            {presupuesto.observaciones_comerciales && (
              <div>
                <div className="font-semibold text-slate-800 mb-1">Observaciones</div>
                <div className="whitespace-pre-wrap">
                  {presupuesto.observaciones_comerciales}
                </div>
              </div>
            )}
            {empresa?.condiciones_pago_default && (
              <div>
                <strong>Forma de pago:</strong> {empresa.condiciones_pago_default}
              </div>
            )}
            {empresa?.texto_pie_presupuesto && (
              <div className="whitespace-pre-wrap">{empresa.texto_pie_presupuesto}</div>
            )}
            {empresa?.iban && (
              <div>
                <strong>IBAN:</strong> {empresa.iban}
              </div>
            )}
          </section>
        )}

        {/* FIRMA */}
        <section className="mt-8 grid grid-cols-2 gap-8 text-xs pt-4 border-t">
          <div>
            <div className="font-semibold mb-8">Conforme cliente</div>
            <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">
              Firma y sello
            </div>
          </div>
          <div>
            <div className="font-semibold mb-8">
              {empresa?.nombre_comercial || 'La empresa'}
            </div>
            <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">
              Firma y sello
            </div>
          </div>
        </section>

        {/* PIE página */}
        <footer className="mt-6 pt-3 border-t text-center text-[9px] text-slate-500">
          {empresa?.razon_social || 'Turiaval'} · {empresa?.cif_nif || ''} ·{' '}
          Presupuesto {presupuesto.numero}
        </footer>
      </div>

      {/* ESTILOS GLOBALES PARA IMPRESIÓN */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .hoja-a4 {
            width: 210mm;
            min-height: 297mm;
            box-sizing: border-box;
          }
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .hoja-a4 {
              width: 100% !important;
              min-height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
            .linea-row {
              page-break-inside: avoid;
            }
          }
        `,
        }}
      />
    </>
  )
}
