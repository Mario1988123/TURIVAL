'use server'

import {
  simularPrecioLineaPersonalizada,
  type SimularPrecioInput,
  type SimularPrecioResultado,
} from '@/lib/services/presupuestos-v2'

/**
 * Server action: calcula el precio de una pieza personalizada SIN
 * insertarla en BD. Usada por el formulario "Nueva pieza" (diálogo)
 * para que el usuario pulse "Calcular precio" y vea los números
 * antes de Guardar el presupuesto.
 */
export async function accionSimularPrecioLineaPersonalizada(
  input: SimularPrecioInput
): Promise<
  | { ok: true; resultado: SimularPrecioResultado }
  | { ok: false; error: string }
> {
  try {
    const resultado = await simularPrecioLineaPersonalizada(input)
    return { ok: true, resultado }
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message ?? 'Error calculando precio',
    }
  }
}
