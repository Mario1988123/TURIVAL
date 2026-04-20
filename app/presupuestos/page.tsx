import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const ESTADOS: Record<string, { label: string; color: string }> = {
  borrador: { label: "Borrador", color: "bg-gray-100 text-gray-700" },
  enviado: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
  aceptado: { label: "Aceptado", color: "bg-green-100 text-green-700" },
  rechazado: { label: "Rechazado", color: "bg-red-100 text-red-700" },
  caducado: { label: "Caducado", color: "bg-orange-100 text-orange-700" },
}

export default async function PresupuestosPage() {
  const supabase = await createClient()

  const { data: presupuestos } = await supabase
    .from("presupuestos")
    .select(
      `
      id,
      numero,
      fecha,
      fecha_validez,
      estado,
      total,
      clientes ( nombre )
    `
    )
    .order("fecha", { ascending: false })
    .limit(100)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Presupuestos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {presupuestos?.length ?? 0} presupuestos
          </p>
        </div>
        <Link
          href="/presupuestos/nuevo"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          + Nuevo presupuesto
        </Link>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                Número
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                Fecha
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                Cliente
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                Válido hasta
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                Estado
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                Total
              </th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {presupuestos?.map((p: any) => {
              const estado = ESTADOS[p.estado] ?? ESTADOS.borrador
              return (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">
                    <Link
                      href={`/presupuestos/${p.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {p.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(p.fecha).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.clientes?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p.fecha_validez
                      ? new Date(p.fecha_validez).toLocaleDateString("es-ES")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${estado.color}`}
                    >
                      {estado.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {Number(p.total ?? 0).toLocaleString("es-ES", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/presupuestos/${p.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(!presupuestos || presupuestos.length === 0) && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-500 text-sm"
                >
                  Aún no hay presupuestos. Pulsa "Nuevo presupuesto" para crear
                  el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
