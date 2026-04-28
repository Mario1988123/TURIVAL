'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, Users, Calendar, FileText, Settings, FileBox, History, Download } from 'lucide-react'
import FichajesHoyPanel from './tabs/hoy-panel'
import HistoricoPanel from './tabs/historico-panel'
import CalendarioPanel from './tabs/calendario-panel'
import AusenciasPanel from './tabs/ausencias-panel'
import HorariosPanel from './tabs/horarios-panel'
import DocumentosPanel from './tabs/documentos-panel'
import AdminPanel from './tabs/admin-panel'

interface OperarioBase { id: string; nombre: string; rol: string; color: string | null; activo: boolean }

export default function FichajesShell({
  operarios,
  operariosEstado,
  descansoInicial,
}: {
  operarios: OperarioBase[]
  operariosEstado: any[]
  descansoInicial: { activo: boolean; inicio: string | null; minutos_transcurridos: number }
}) {
  const [tab, setTab] = useState('hoy')

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="w-8 h-8" />
          Fichajes y horarios
        </h1>
        <p className="text-sm text-muted-foreground">
          Control horario completo: fichajes, calendario, ausencias, documentos y exportación oficial.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="hoy" className="gap-1"><Users className="h-3.5 w-3.5" /> Hoy</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Calendario</TabsTrigger>
          <TabsTrigger value="ausencias" className="gap-1"><FileText className="h-3.5 w-3.5" /> Ausencias</TabsTrigger>
          <TabsTrigger value="horarios" className="gap-1"><Settings className="h-3.5 w-3.5" /> Horarios</TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1"><FileBox className="h-3.5 w-3.5" /> Documentos</TabsTrigger>
          <TabsTrigger value="admin" className="gap-1"><Download className="h-3.5 w-3.5" /> Admin / Export</TabsTrigger>
        </TabsList>

        <TabsContent value="hoy">
          <FichajesHoyPanel
            operariosEstado={operariosEstado}
            descansoInicial={descansoInicial}
          />
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoPanel operarios={operarios} />
        </TabsContent>

        <TabsContent value="calendario">
          <CalendarioPanel />
        </TabsContent>

        <TabsContent value="ausencias">
          <AusenciasPanel operarios={operarios} />
        </TabsContent>

        <TabsContent value="horarios">
          <HorariosPanel operarios={operarios} />
        </TabsContent>

        <TabsContent value="documentos">
          <DocumentosPanel operarios={operarios} />
        </TabsContent>

        <TabsContent value="admin">
          <AdminPanel operarios={operarios} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
