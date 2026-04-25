// lib/actions/fichajes.ts
'use server'

import { revalidatePath } from 'next/cache'
import {
  registrarFichaje,
  registrarDescansoGlobal,
  listarEstadoOperariosHoy,
  resumenOperarioRango,
  obtenerFichajesDia,
  obtenerDescansoGlobalActivo,
  type TipoFichaje,
} from '@/lib/services/fichajes'

export async function accionRegistrarFichaje(params: {
  operario_id: string
  tipo: TipoFichaje
  notas?: string
}) {
  const res = await registrarFichaje(params)
  if (res.ok) {
    revalidatePath('/fichajes')
    revalidatePath('/planificador')
  }
  return res
}

export async function accionDescansoGlobal(inicio: boolean, notas?: string) {
  const res = await registrarDescansoGlobal({ inicio, notas })
  if (res.ok) {
    revalidatePath('/fichajes')
    revalidatePath('/planificador')
  }
  return res
}

export async function accionEstadoOperariosHoy() {
  return listarEstadoOperariosHoy()
}

export async function accionResumenOperario(operario_id: string, desdeISO: string, hastaISO: string) {
  return resumenOperarioRango({
    operario_id,
    desde: new Date(desdeISO),
    hasta: new Date(hastaISO),
  })
}

export async function accionFichajesDia(operario_id: string, fechaISO: string) {
  return obtenerFichajesDia(operario_id, new Date(fechaISO))
}

export async function accionDescansoGlobalActivo() {
  return obtenerDescansoGlobalActivo()
}
