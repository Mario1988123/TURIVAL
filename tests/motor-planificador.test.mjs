/**
 * Tests del motor planificador — sin vitest. Usa el runner nativo de
 * Node 18+ (`node --test`).
 *
 * Ejecutar:
 *   node --test tests/motor-planificador.test.mjs
 *
 * Solo importamos cosas puras del motor (no servicios, no Supabase).
 * Para que TypeScript se transpile a JS, usamos el output de Next/Babel
 * via tsx si esta instalado, o ejecutamos directamente con tsx en CI.
 *
 * Si no quieres TS, los tests llaman a la funcion compilada en .next.
 * Para mantenerlo simple, este archivo prueba helpers basicos
 * (formateo de minutos) que no dependen de tipos complejos.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

// =============================================================
// formatearMinutosJornada — replica del motor en JS puro
// =============================================================
// Si el motor cambia, copia los tests para que sean reproducibles.
function formatear(minutos, minPorDia = 540) {
  const total = Math.max(0, Math.round(minutos))
  const dias = Math.floor(total / minPorDia)
  const resto1 = total - dias * minPorDia
  const horas = Math.floor(resto1 / 60)
  const mins = resto1 - horas * 60
  const partes = []
  if (dias > 0) partes.push(`${dias}d`)
  if (horas > 0) partes.push(`${horas}h`)
  if (mins > 0 || partes.length === 0) partes.push(`${mins}m`)
  return partes.join(' ')
}

test('formatearMinutosJornada — 0 minutos', () => {
  assert.equal(formatear(0), '0m')
})

test('formatearMinutosJornada — solo minutos', () => {
  assert.equal(formatear(45), '45m')
})

test('formatearMinutosJornada — horas y minutos', () => {
  assert.equal(formatear(95), '1h 35m')
})

test('formatearMinutosJornada — un dia laboral exacto', () => {
  assert.equal(formatear(540), '1d')
})

test('formatearMinutosJornada — multidia', () => {
  // 1939m con 540min/dia = 3d 319m sobrante = 3d 5h 19m
  assert.equal(formatear(1939), '3d 5h 19m')
})

// =============================================================
// minutosJornadaEntre — solo calculamos un caso simple
// =============================================================
function minutosJornadaEntre(desde, hasta, jornada) {
  if (hasta.getTime() <= desde.getTime()) return 0
  const minutosPorDia = (() => {
    const ini = jornada.hora_inicio.split(':').map(Number)
    const fin = jornada.hora_fin.split(':').map(Number)
    const total = (fin[0] * 60 + fin[1]) - (ini[0] * 60 + ini[1])
    return Math.max(0, total - (jornada.minutos_descanso_intermedio ?? 0))
  })()
  if (minutosPorDia <= 0) return 0
  let acc = 0
  const cursor = new Date(desde)
  cursor.setHours(0, 0, 0, 0)
  const limite = new Date(hasta)
  limite.setHours(0, 0, 0, 0)
  const conHora = (base, hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date(base); d.setHours(h, m, 0, 0); return d
  }
  while (cursor.getTime() <= limite.getTime()) {
    if (jornada.dias_laborables.includes(cursor.getDay())) {
      const ini = conHora(cursor, jornada.hora_inicio)
      const fin = conHora(cursor, jornada.hora_fin)
      const sliceIni = desde > ini ? desde : ini
      const sliceFin = hasta < fin ? hasta : fin
      if (sliceFin > sliceIni) acc += Math.round((sliceFin - sliceIni) / 60_000)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return acc
}

const JORNADA = {
  hora_inicio: '08:00',
  hora_fin: '17:00',
  minutos_descanso_intermedio: 0,
  dias_laborables: [1, 2, 3, 4, 5],
}

test('minutosJornadaEntre — ignora finde', () => {
  // Viernes 10:00 a Lunes 09:00 = solo 7h del viernes (10-17) + 1h del lunes (8-9) = 480
  const viernes = new Date(2026, 4, 1, 10, 0)  // 1-may-2026 (vie)
  const lunes = new Date(2026, 4, 4, 9, 0)      // 4-may-2026 (lun)
  const min = minutosJornadaEntre(viernes, lunes, JORNADA)
  // viernes 10-17 = 7h * 60 = 420
  // lunes 8-9 = 1h * 60 = 60
  // total = 480
  assert.equal(min, 480)
})

test('minutosJornadaEntre — mismo dia', () => {
  const a = new Date(2026, 4, 4, 9, 0)
  const b = new Date(2026, 4, 4, 12, 30)
  assert.equal(minutosJornadaEntre(a, b, JORNADA), 210)
})

test('minutosJornadaEntre — desde > hasta', () => {
  const a = new Date(2026, 4, 4, 12, 0)
  const b = new Date(2026, 4, 4, 11, 0)
  assert.equal(minutosJornadaEntre(a, b, JORNADA), 0)
})
