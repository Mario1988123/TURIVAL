'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import {
  Clock, Users, Calendar, FileText, Settings, FileBox, History, Download,
  Bell,
} from 'lucide-react'
import FichajesHoyPanel from './tabs/hoy-panel'
import HistoricoPanel from './tabs/historico-panel'
import CalendarioPanel from './tabs/calendario-panel'
import AusenciasPanel from './tabs/ausencias-panel'
import HorariosPanel from './tabs/horarios-panel'
import DocumentosPanel from './tabs/documentos-panel'
import AdminPanel from './tabs/admin-panel'
import BotonActivarNotif from './boton-activar-notif'

interface OperarioBase { id: string; nombre: string; rol: string; color: string | null; activo: boolean }

export default function FichajesShell({
  operarios,
  operariosEstado,
  descansoInicial,
  esAdmin,
  operarioPropioId,
}: {
  operarios: OperarioBase[]
  operariosEstado: any[]
  descansoInicial: { activo: boolean; inicio: string | null; minutos_transcurridos: number }
  esAdmin: boolean
  operarioPropioId: string | null
}) {
  const [tab, setTab] = useState('hoy')

  // Si es operario solo se ve a sí mismo en los selectores
  const operariosFiltrados = esAdmin
    ? operarios
    : operarios.filter((o) => o.id === operarioPropioId)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="w-8 h-8" />
            Fichajes y horarios
            {!esAdmin && (
              <span className="text-xs font-normal bg-blue-100 text-blue-800 px-2 py-1 rounded">vista operario</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {esAdmin
              ? 'Control horario completo: fichajes, calendario, ausencias, documentos y exportación oficial.'
              : 'Ficha tu jornada, pide ausencias, mira tu calendario y consulta tu saldo de horas.'}
          </p>
        </div>
        <BotonActivarNotif />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="hoy" className="gap-1"><Users className="h-3.5 w-3.5" /> Hoy</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1"><History className="h-3.5 w-3.5" /> Mi histórico</TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Calendario</TabsTrigger>
          <TabsTrigger value="ausencias" className="gap-1"><FileText className="h-3.5 w-3.5" /> Ausencias</TabsTrigger>
          {esAdmin && (
            <>
              <TabsTrigger value="horarios" className="gap-1"><Settings className="h-3.5 w-3.5" /> Horarios</TabsTrigger>
              <TabsTrigger value="documentos" className="gap-1"><FileBox className="h-3.5 w-3.5" /> Documentos</TabsTrigger>
              <TabsTrigger value="admin" className="gap-1"><Download className="h-3.5 w-3.5" /> Admin / Export</TabsTrigger>
            </>
          )}
          {!esAdmin && (
            <TabsTrigger value="documentos" className="gap-1"><FileBox className="h-3.5 w-3.5" /> Mis documentos</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="hoy">
          <FichajesHoyPanel
            operariosEstado={operariosEstado}
            descansoInicial={descansoInicial}
          />
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoPanel operarios={operariosFiltrados} />
        </TabsContent>

        <TabsContent value="calendario">
          <CalendarioPanel soloLectura={!esAdmin} />
        </TabsContent>

        <TabsContent value="ausencias">
          <AusenciasPanel operarios={operariosFiltrados} esAdmin={esAdmin} />
        </TabsContent>

        {esAdmin && (
          <TabsContent value="horarios">
            <HorariosPanel operarios={operarios} />
          </TabsContent>
        )}

        <TabsContent value="documentos">
          <DocumentosPanel operarios={operariosFiltrados} esAdmin={esAdmin} />
        </TabsContent>

        {esAdmin && (
          <TabsContent value="admin">
            <AdminPanel operarios={operarios} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
