/**
 * Helper para exportar arrays de objetos a CSV y disparar descarga
 * desde el navegador. No requiere dependencias externas.
 */

export type CsvCell = string | number | boolean | null | undefined | Date

export interface CsvColumn<T> {
  /** Cabecera en la primera fila. */
  header: string
  /** Selector del valor. */
  get: (row: T) => CsvCell
}

function escaparCampo(v: CsvCell): string {
  if (v == null) return ''
  const s = v instanceof Date ? v.toISOString() : String(v)
  // Si contiene coma, comilla doble o salto de línea, envolver en comillas y duplicar comillas internas.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportarCsv<T>(
  filas: T[],
  columnas: CsvColumn<T>[],
  nombreFichero: string,
): void {
  const cabecera = columnas.map(c => escaparCampo(c.header)).join(',')
  const cuerpo = filas
    .map(row => columnas.map(c => escaparCampo(c.get(row))).join(','))
    .join('\r\n')
  const csv = `﻿${cabecera}\r\n${cuerpo}` // BOM UTF-8 para que Excel detecte bien acentos.

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreFichero
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}
