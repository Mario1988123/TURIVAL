import { obtenerResumenNotificaciones } from '@/lib/services/notificaciones'
import PanelNotificacionesCliente from './panel-cliente'

export const dynamic = 'force-dynamic'

export default async function NotificacionesPage() {
  const resumen = await obtenerResumenNotificaciones()
  return <PanelNotificacionesCliente resumenInicial={resumen} />
}
