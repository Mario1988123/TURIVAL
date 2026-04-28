'use client'

/**
 * Tab "Hoy": panel de operarios en activo con su estado actual.
 * Reusa la UI vieja `FichajesCliente` envolviendola.
 */

import FichajesCliente from '../fichajes-cliente'

export default function HoyPanel({
  operariosEstado,
  descansoInicial,
}: {
  operariosEstado: any[]
  descansoInicial: { activo: boolean; inicio: string | null; minutos_transcurridos: number }
}) {
  return (
    <FichajesCliente
      operariosIniciales={operariosEstado}
      descansoInicial={descansoInicial}
      errorInicial={null}
    />
  )
}
