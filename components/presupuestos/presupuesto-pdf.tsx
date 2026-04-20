import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer"
import React from "react"

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

type Cliente = {
  nombre: string
  cif: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
}

type Presupuesto = {
  numero: string
  fecha: string
  fecha_validez: string | null
  fecha_entrega_estimada: string | null
  subtotal: number
  iva: number
  iva_pct: number
  total: number
  observaciones: string | null
  clientes: Cliente
}

type Linea = {
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
  productos: { nombre: string } | null
  colores: { nombre: string; ral: string | null } | null
  tratamientos: { nombre: string } | null
}

const euro = (n: number) =>
  Number(n).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const fecha = (f: string | null) =>
  f ? new Date(f).toLocaleDateString("es-ES") : "—"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 15,
    marginBottom: 15,
  },
  logo: { height: 45, marginBottom: 8 },
  empresaName: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  empresaData: { fontSize: 8, color: "#6b7280", lineHeight: 1.4 },
  presupuestoBox: { alignItems: "flex-end" },
  presupuestoLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    color: "#6b7280",
    letterSpacing: 1,
  },
  presupuestoNumero: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 2,
    marginBottom: 10,
  },
  fechaLine: { fontSize: 9, marginBottom: 2 },
  fechaLabel: { color: "#6b7280" },
  sectionTitle: {
    fontSize: 8,
    textTransform: "uppercase",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 5,
  },
  clienteBox: {
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 4,
    marginBottom: 15,
  },
  clienteNombre: { fontSize: 12, fontWeight: "bold", marginBottom: 3 },
  clienteData: { fontSize: 8, color: "#4b5563", lineHeight: 1.5 },
  table: { marginBottom: 15 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#374151",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableHeaderCell: { fontSize: 8, fontWeight: "bold" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 6,
  },
  colOrden: { width: "5%" },
  colDesc: { width: "45%", paddingRight: 4 },
  colUds: { width: "7%", textAlign: "right" },
  colM2: { width: "9%", textAlign: "right" },
  colPrecio: { width: "11%", textAlign: "right" },
  colDto: { width: "7%", textAlign: "right" },
  colSubtotal: { width: "16%", textAlign: "right" },
  descripcion: { fontSize: 9, fontWeight: "bold", marginBottom: 2 },
  descripcionDetalle: { fontSize: 7, color: "#6b7280", lineHeight: 1.3 },
  totalesContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  totalesBox: { width: "40%" },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalLineFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderTopWidth: 1.5,
    borderTopColor: "#374151",
    marginTop: 3,
  },
  totalLabel: { fontSize: 9, color: "#4b5563" },
  totalValue: { fontSize: 9, fontWeight: "bold" },
  totalFinalLabel: { fontSize: 11, fontWeight: "bold" },
  totalFinalValue: { fontSize: 11, fontWeight: "bold", color: "#1d4ed8" },
  observacionesBox: {
    backgroundColor: "#f9fafb",
    padding: 8,
    borderRadius: 4,
    marginBottom: 15,
  },
  observacionesText: { fontSize: 8, lineHeight: 1.5 },
  condicionesContainer: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
  },
  condicionesTitulo: {
    fontSize: 8,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#374151",
  },
  condicionItem: {
    fontSize: 7,
    color: "#6b7280",
    marginBottom: 2,
    lineHeight: 1.4,
  },
  iban: { fontSize: 8, marginTop: 6, color: "#374151" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7,
    color: "#9ca3af",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 5,
  },
})

export default function PresupuestoPDF({
  presupuesto,
  lineas,
  empresa,
}: {
  presupuesto: Presupuesto
  lineas: Linea[]
  empresa: Empresa
}) {
  const c = presupuesto.clientes

  return (
    <Document
      title={`Presupuesto ${presupuesto.numero}`}
      author={empresa.nombreComercial}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {empresa.logoUrl ? (
              <Image src={empresa.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.empresaName}>{empresa.nombreComercial}</Text>
            )}
            <Text style={[styles.empresaData, { fontWeight: "bold" }]}>
              {empresa.razonSocial}
            </Text>
            <Text style={styles.empresaData}>CIF: {empresa.cif}</Text>
            <Text style={styles.empresaData}>{empresa.direccion}</Text>
            <Text style={styles.empresaData}>
              {empresa.codigoPostal} {empresa.ciudad} ({empresa.provincia})
            </Text>
            <Text style={styles.empresaData}>
              Tel: {empresa.telefono} · {empresa.email}
            </Text>
          </View>

          <View style={styles.presupuestoBox}>
            <Text style={styles.presupuestoLabel}>Presupuesto</Text>
            <Text style={styles.presupuestoNumero}>{presupuesto.numero}</Text>
            <Text style={styles.fechaLine}>
              <Text style={styles.fechaLabel}>Fecha: </Text>
              {fecha(presupuesto.fecha)}
            </Text>
            <Text style={styles.fechaLine}>
              <Text style={styles.fechaLabel}>Válido hasta: </Text>
              {fecha(presupuesto.fecha_validez)}
            </Text>
            {presupuesto.fecha_entrega_estimada && (
              <Text style={styles.fechaLine}>
                <Text style={styles.fechaLabel}>Entrega: </Text>
                {fecha(presupuesto.fecha_entrega_estimada)}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Cliente</Text>
        <View style={styles.clienteBox}>
          <Text style={styles.clienteNombre}>{c.nombre}</Text>
          {c.cif && <Text style={styles.clienteData}>CIF/NIF: {c.cif}</Text>}
          {c.direccion && <Text style={styles.clienteData}>{c.direccion}</Text>}
          <Text style={styles.clienteData}>
            {[c.email, c.telefono].filter(Boolean).join(" · ")}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Detalle</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colOrden]}>#</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>
              Descripción
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colUds]}>Uds</Text>
            <Text style={[styles.tableHeaderCell, styles.colM2]}>m²</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrecio]}>
              € unit.
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colDto]}>Dto %</Text>
            <Text style={[styles.tableHeaderCell, styles.colSubtotal]}>
              Subtotal
            </Text>
          </View>

          {lineas.map((l) => {
            const detalles = [
              l.productos?.nombre,
              l.colores
                ? l.colores.nombre + (l.colores.ral ? ` (${l.colores.ral})` : "")
                : null,
              l.tratamientos?.nombre,
              l.ancho > 0 || l.alto > 0
                ? `${l.ancho}×${l.alto}${l.grosor ? `×${l.grosor}` : ""} mm`
                : null,
              l.caras > 0 ? `${l.caras} caras` : null,
            ]
              .filter(Boolean)
              .join(" · ")

            return (
              <View key={l.orden} style={styles.tableRow} wrap={false}>
                <Text style={styles.colOrden}>{l.orden}</Text>
                <View style={styles.colDesc}>
                  <Text style={styles.descripcion}>{l.descripcion}</Text>
                  {detalles && (
                    <Text style={styles.descripcionDetalle}>{detalles}</Text>
                  )}
                </View>
                <Text style={styles.colUds}>{l.cantidad}</Text>
                <Text style={styles.colM2}>
                  {Number(l.superficie_m2).toFixed(3)}
                </Text>
                <Text style={styles.colPrecio}>{euro(l.precio_unitario)}</Text>
                <Text style={styles.colDto}>
                  {Number(l.descuento_pct) > 0 ? `${l.descuento_pct}%` : "—"}
                </Text>
                <Text style={styles.colSubtotal}>{euro(l.subtotal)}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.totalesContainer}>
          <View style={styles.totalesBox}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{euro(presupuesto.subtotal)}</Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>
                IVA ({presupuesto.iva_pct}%)
              </Text>
              <Text style={styles.totalValue}>{euro(presupuesto.iva)}</Text>
            </View>
            <View style={styles.totalLineFinal}>
              <Text style={styles.totalFinalLabel}>TOTAL</Text>
              <Text style={styles.totalFinalValue}>
                {euro(presupuesto.total)}
              </Text>
            </View>
          </View>
        </View>

        {presupuesto.observaciones && (
          <>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <View style={styles.observacionesBox}>
              <Text style={styles.observacionesText}>
                {presupuesto.observaciones}
              </Text>
            </View>
          </>
        )}

        <View style={styles.condicionesContainer}>
          <Text style={styles.condicionesTitulo}>Condiciones</Text>
          {empresa.condiciones.map((cond, i) => (
            <Text key={i} style={styles.condicionItem}>
              • {cond}
            </Text>
          ))}
          {empresa.iban && (
            <Text style={styles.iban}>IBAN: {empresa.iban}</Text>
          )}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${empresa.nombreComercial} · ${empresa.web || empresa.email} · Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
