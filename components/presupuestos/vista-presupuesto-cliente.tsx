"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Cliente = {
  id: string
  nombre: string
  cif: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
}

type Presupuesto = {
  id: string
  numero: string
  fecha: string
  fecha_validez: string | null
  fecha_entrega_estimada: string | null
  estado: string
  subtotal: number
  iva: number
  iva_pct: number
  total: number
  observaciones: string | null
  cliente_id: string
  clientes: Cliente
}

type Linea = {
  id: string
  orden: number
  descripcion: string
  ancho: number
  alto: number
  grosor: number
  caras: number
  cantidad: number
  superficie_m2: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
  nivel_complejidad: string | null
  productos: { nombre: string } | null
  colores: { nombre: string; ral: string | null } | null
  tratamientos: { nombre: string } | null
}

type Empresa = {
  razonSocial: string
  nombreComercial: string
  cif: string
  direccion: string
  codigoPostal: string
  ciudad: string
  provincia: string
  telefono: string
  email: string
  web: string
  condiciones: readonly string[]
  iban: string
  logoUrl: string
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  borrador: { label: "Borrador", color: "bg-gray-100 text-gray-700" },
  enviado: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
  aceptado: { label: "Aceptado", color: "bg-green-100 text-green-700" },
  rechazado: { label: "Rechazado", color: "bg-red-100 text-red-700" },
  caducado: { label: "Caducado", color: "bg-orange-100 text-orange-700" },
}

const formatoEuro = (n: number) =>
  Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR" })

const formatoFecha = (f: string | null) =>
  f ? new Date(f).toLocaleDateString("es-ES") : "—"

export default function VistaPresupuestoCliente({
  presupuesto,
  lineas,
  empresa,
}: {
  presupuesto: Presupuesto
  lineas: Linea[]
  empresa: Empresa
}) {
  const router = useRouter()
  const supabase = createClient()
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cliente = presupuesto.clientes
  const estado = ESTADOS[presupuesto.estado] ?? ESTADOS.borrador

  function imprimir() {
    window.print()
  }

  function descargarPDF() {
    window.open(`/api/presupuestos/${presupuesto.id}/pdf`, "_blank")
  }

  function enviarWhatsApp() {
    if (!cliente.telefono) {
      alert(
        "Este cliente no tiene teléfono. Añádelo en su ficha para enviar por WhatsApp."
      )
      return
    }
    const tel = cliente.telefono.replace(/[^\d]/g, "")

    const urlPDF =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/presupuestos/${presupuesto.id}/pdf`
        : ""

    const texto = `Hola ${cliente.nombre},

Le envío el presupuesto ${presupuesto.numero} con fecha ${formatoFecha(
      presupuesto.fecha
    )}.

Importe total: ${formatoEuro(presupuesto.total)}
Válido hasta: ${formatoFecha(presupuesto.fecha_validez)}

Puede descargar el PDF aquí:
${urlPDF}

Quedo a su disposición para cualquier aclaración.

Saludos,
${empresa.nombreComercial}`

    const url = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
    window.open(url, "_blank")
  }

  function enviarEmail() {
    if (!cliente.email) {
      alert(
        "Este cliente no tiene email. Añádelo en su ficha para enviar por correo."
      )
      return
    }

    const urlPDF =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/presupuestos/${presupuesto.id}/pdf`
        : ""

    const asunto = `Presupuesto ${presupuesto.numero} — ${empresa.nombreComercial}`
    const cuerpo = `Estimado/a ${cliente.nombre},

Adjunto le remito el presupuesto ${presupuesto.numero} con fecha ${formatoFecha(
      presupuesto.fecha
    )}.

Importe total: ${formatoEuro(presupuesto.total)}
Válido hasta: ${formatoFecha(presupuesto.fecha_validez)}

Puede descargar el PDF desde el siguiente enlace:
${urlPDF}

Quedo a su disposición para cualquier aclaración.

Atentamente,
${empresa.nombreComercial}
${empresa.telefono}
${empresa.email}`

    const url = `mailto:${cliente.email}?subject=${encodeURIComponent(
      asunto
    )}&body=${encodeURIComponent(cuerpo)}`
    window.location.href = url
  }

  async function cambiarEstado(nuevoEstado: string) {
    setCambiandoEstado(true)
    setError(null)
    const { error } = await supabase
      .from("presupuestos")
      .update({ estado: nuevoEstado })
      .eq("id", presupuesto.id)

    if (error) {
      setError(error.message)
    } else {
      router.refresh()
    }
    setCambiandoEstado(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10 print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/presupuestos")}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Volver
            </button>
            <div className="text-sm">
              <span className="font-mono font-medium">
                {presupuesto.numero}
              </span>
              <span
                className={`ml-3 px-2 py-0.5 rounded-full text-xs font-medium ${estado.color}`}
              >
                {estado.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={presupuesto.estado}
              onChange={(e) => cambiarEstado(e.target.value)}
              disabled={cambiandoEstado}
              className="text-sm border rounded-lg px-2 py-1.5"
            >
              <option value="borrador">Borrador</option>
              <option value="enviado">Enviado</option>
              <option value="aceptado">Aceptado</option>
              <option value="rechazado">Rechazado</option>
              <option value="caducado">Caducado</option>
            </select>

            <div className="h-6 w-px bg-gray-300 mx-1" />

            <button
              onClick={imprimir}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              title="Imprimir"
            >
              🖨️ Imprimir
            </button>
            <button
              onClick={descargarPDF}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              title="Descargar PDF"
            >
              📄 PDF
            </button>
            <button
              onClick={enviarWhatsApp}
              className="px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-800 rounded-lg"
              title="Enviar por WhatsApp"
            >
              💬 WhatsApp
            </button>
            <button
              onClick={enviarEmail}
              className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg"
              title="Enviar por email"
            >
              ✉️ Email
            </button>
          </div>
        </div>
        {error && (
          <div className="max-w-5xl mx-auto px-6 pb-3">
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto p-6 print:p-0">
        <div className="bg-white border rounded-lg shadow-sm print:border-0 print:shadow-none p-10 print:p-0">
          <div className="flex items-start justify-between border-b pb-6 mb-6">
            <div>
              {empresa.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={empresa.logoUrl}
                  alt={empresa.nombreComercial}
                  className="h-16 mb-3"
                />
              ) : (
                <div className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                  {empresa.nombreComercial}
                </div>
              )}
              <div className="text-xs text-gray-600 space-y-0.5">
                <div className="font-medium">{empresa.razonSocial}</div>
                <div>CIF: {empresa.cif}</div>
                <div>{empresa.direccion}</div>
                <div>
                  {empresa.codigoPostal} {empresa.ciudad} ({empresa.provincia})
                </div>
                <div>
                  Tel: {empresa.telefono} · {empresa.email}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Presupuesto
              </div>
              <div className="text-2xl font-bold font-mono mt-1">
                {presupuesto.numero}
              </div>
              <div className="mt-4 text-sm space-y-1">
                <div>
                  <span className="text-gray-500">Fecha: </span>
                  <span className="font-medium">
                    {formatoFecha(presupuesto.fecha)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Válido hasta: </span>
                  <span className="font-medium">
                    {formatoFecha(presupuesto.fecha_validez)}
                  </span>
                </div>
                {presupuesto.fecha_entrega_estimada && (
                  <div>
                    <span className="text-gray-500">Entrega estimada: </span>
                    <span className="font-medium">
                      {formatoFecha(presupuesto.fecha_entrega_estimada)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Cliente
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <div className="font-semibold text-base">{cliente.nombre}</div>
              <div className="text-gray-600 mt-1 space-y-0.5">
                {cliente.cif && <div>CIF/NIF: {cliente.cif}</div>}
                {cliente.direccion && <div>{cliente.direccion}</div>}
                <div>
                  {cliente.email && <span>{cliente.email}</span>}
                  {cliente.email && cliente.telefono && <span> · </span>}
                  {cliente.telefono && <span>{cliente.telefono}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Detalle
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2 font-semibold">#</th>
                  <th className="text-left py-2 font-semibold">Descripción</th>
                  <th className="text-right py-2 font-semibold w-14">Uds</th>
                  <th className="text-right py-2 font-semibold w-20">m²</th>
                  <th className="text-right py-2 font-semibold w-24">
                    € unit.
                  </th>
                  <th className="text-right py-2 font-semibold w-14">Dto %</th>
                  <th className="text-right py-2 font-semibold w-28">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 align-top">
                    <td className="py-3 text-gray-500">{l.orden}</td>
                    <td className="py-3 pr-2">
                      <div className="font-medium">{l.descripcion}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {[
                          l.productos?.nombre,
                          l.colores?.nombre +
                            (l.colores?.ral ? ` (${l.colores.ral})` : ""),
                          l.tratamientos?.nombre,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {(l.ancho > 0 || l.alto > 0) && (
                          <>
                            {" · "}
                            {l.ancho}×{l.alto}
                            {l.grosor ? `×${l.grosor}` : ""} mm
                          </>
                        )}
                        {l.caras > 0 && <> · {l.caras} caras</>}
                      </div>
                    </td>
                    <td className="py-3 text-right">{l.cantidad}</td>
                    <td className="py-3 text-right text-gray-600">
                      {Number(l.superficie_m2).toFixed(3)}
                    </td>
                    <td className="py-3 text-right">
                      {formatoEuro(l.precio_unitario)}
                    </td>
                    <td className="py-3 text-right text-gray-600">
                      {Number(l.descuento_pct) > 0
                        ? `${l.descuento_pct}%`
                        : "—"}
                    </td>
                    <td className="py-3 text-right font-medium">
                      {formatoEuro(l.subtotal)}
                    </td>
                  </tr>
                ))}
                {lineas.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-sm text-gray-500"
                    >
                      Sin líneas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-72 text-sm space-y-1">
              <div className="flex justify-between py-1">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">
                  {formatoEuro(presupuesto.subtotal)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-600">
                  IVA ({presupuesto.iva_pct}%)
                </span>
                <span className="font-medium">
                  {formatoEuro(presupuesto.iva)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-gray-300 text-base">
                <span className="font-bold">TOTAL</span>
                <span className="font-bold text-blue-700">
                  {formatoEuro(presupuesto.total)}
                </span>
              </div>
            </div>
          </div>

          {presupuesto.observaciones && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                Observaciones
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                {presupuesto.observaciones}
              </div>
            </div>
          )}

          <div className="border-t pt-6 text-xs text-gray-500">
            <div className="font-semibold text-gray-700 mb-2">Condiciones</div>
            <ul className="space-y-1 list-disc list-inside">
              {empresa.condiciones.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            {empresa.iban && (
              <div className="mt-3">
                <span className="font-medium">IBAN:</span> {empresa.iban}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  )
}
