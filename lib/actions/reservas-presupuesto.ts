'use server'

import { revalidatePath } from 'next/cache'
import {
  reservarHorasDesdePresupuesto,
  liberarReservasPresupuesto,
  validarReservasTentativas,
} from '@/lib/services/reservas-presupuesto'

export async function accionReservarHoras(presupuestoId: string) {
  const res = await reservarHorasDesdePresupuesto(presupuestoId)
  if (res.ok) {
    revalidatePath('/planificador')
    revalidatePath(`/presupuestos/${presupuestoId}`)
  }
  return res
}

export async function accionLiberarReservas(presupuestoId: string) {
  const res = await liberarReservasPresupuesto(presupuestoId)
  if (res.ok) {
    revalidatePath('/planificador')
    revalidatePath(`/presupuestos/${presupuestoId}`)
  }
  return res
}

export async function accionValidarReservasTentativas(presupuestoId: string) {
  const res = await validarReservasTentativas(presupuestoId)
  if (res.ok) {
    revalidatePath('/planificador')
    revalidatePath(`/presupuestos/${presupuestoId}`)
  }
  return res
}
