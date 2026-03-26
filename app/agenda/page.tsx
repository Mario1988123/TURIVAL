'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Database } from '@/lib/types/database'

interface PedidoAgenda {
  id: string
  numero: string
  clientes: { nombre_comercial: string } | null
  fecha_entrega: string | null
  estado: string
  total: number
}

export default function AgendaPage() {
  const [pedidos, setPedidos] = useState<PedidoAgenda[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadPedidos()
  }, [])

  async function loadPedidos() {
    const { data } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero,
        clientes(nombre_comercial),
        fecha_entrega,
        estado,
        total
      `)
      .neq('estado', 'cancelado')
      .not('fecha_entrega', 'is', null)
      .order('fecha_entrega', { ascending: true })

    setPedidos((data as PedidoAgenda[]) || [])
    setLoading(false)
  }

  const getWeekDays = () => {
    const days = []
    const startDate = new Date(currentDate)
    startDate.setDate(startDate.getDate() - startDate.getDay())

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      days.push(date)
    }
    return days
  }

  const getPedidosForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return pedidos.filter(p => p.fecha_entrega?.split('T')[0] === dateStr)
  }

  const getColorByEstado = (estado: string) => {
    const colors: Record<string, string> = {
      'pendiente': 'bg-yellow-100 border-yellow-300 text-yellow-900',
      'confirmado': 'bg-blue-100 border-blue-300 text-blue-900',
      'en_produccion': 'bg-purple-100 border-purple-300 text-purple-900',
      'completado': 'bg-green-100 border-green-300 text-green-900',
      'entregado': 'bg-emerald-100 border-emerald-300 text-emerald-900',
    }
    return colors[estado] || 'bg-slate-100 border-slate-300 text-slate-900'
  }

  const weekDays = getWeekDays()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Agenda de Proyectos</h1>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setDate(newDate.getDate() - 7)
              setCurrentDate(newDate)
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-40 text-center">
            {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setDate(newDate.getDate() + 7)
              setCurrentDate(newDate)
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Vista Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, idx) => {
                const dayPedidos = getPedidosForDate(day)
                const isToday =
                  day.toDateString() === new Date().toDateString()

                return (
                  <div
                    key={idx}
                    className={`rounded-lg border-2 p-3 min-h-80 ${
                      isToday
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-sm mb-3">
                      {day.toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                      })}
                    </div>

                    <div className="space-y-2">
                      {dayPedidos.map(pedido => (
                        <div
                          key={pedido.id}
                          className={`p-2 rounded text-xs border ${getColorByEstado(
                            pedido.estado
                          )}`}
                        >
                          <div className="font-bold truncate">
                            {pedido.numero}
                          </div>
                          <div className="text-xs opacity-75 truncate">
                            {pedido.clientes?.nombre_comercial}
                          </div>
                          <div className="text-xs opacity-75">
                            €{pedido.total.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
