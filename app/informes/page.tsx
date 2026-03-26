'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function InformesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Informes</h1>
        <p className="text-gray-600 mt-1">Consulta informes y reportes del negocio</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">El módulo de informes está en desarrollo.</p>
        </CardContent>
      </Card>
    </div>
  )
}
