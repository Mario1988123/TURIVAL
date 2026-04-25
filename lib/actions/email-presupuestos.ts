// lib/actions/email-presupuestos.ts
'use server'

import { revalidatePath } from 'next/cache'
import { enviarPresupuestoPorEmail, type ResultadoEnvioPresupuesto } from '@/lib/services/email-presupuestos'

export async function accionEnviarPresupuestoEmail(params: {
  presupuesto_id: string
  email_destino?: string
  mensaje_personal?: string
}): Promise<ResultadoEnvioPresupuesto> {
  const res = await enviarPresupuestoPorEmail(params)
  if (res.ok) {
    revalidatePath('/presupuestos')
    revalidatePath(`/presupuestos/${params.presupuesto_id}`)
  }
  return res
}
