'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play, Pause, RotateCcw, QrCode, CheckCircle, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Pieza {
  id: string
  codigo_unico: string
  qr_code: string
  estado: string
  carro_id: string
  proceso_actual_id: string
}

interface Tarea {
  id: string
  nombre: string
  pieza_id: string
  proceso_id: string
  estado: string
  tiempo_estimado: number
  tiempo_acumulado: number
  empleado_id: string
  orden_secuencia: number
}

interface Proceso {
  id: string
  nombre: string
}

interface Carro {
  id: string
  codigo: string
}

export default function ProduccionTiempoReal() {
  const supabase = createClient()
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [piezaActual, setPiezaActual] = useState<Pieza | null>(null)
  const [tareasActuales, setTareasActuales] = useState<Tarea[]>([])
  const [tareaActiva, setTareaActiva] = useState<Tarea | null>(null)
  const [procesos, setProcesos] = useState<Map<string, Proceso>>(new Map())
  const [carros, setCarros] = useState<Map<string, Carro>>(new Map())
  
  const [cronometro, setCronometro] = useState(0)
  const [corriendo, setCorriendo] = useState(false)
  const [pausado, setPausado] = useState(false)
  
  const [qrInput, setQrInput] = useState('')
  const [carroAsignado, setCarroAsignado] = useState('')
  const [showCarroDialog, setShowCarroDialog] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (corriendo && !pausado) {
      interval = setInterval(() => {
        setCronometro(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [corriendo, pausado])

  async function loadData() {
    try {
      const { data: procesosData } = await supabase.from('procesos_catalogo').select('*')
      const { data: carrosData } = await supabase.from('carros').select('*')

      const procesosMap = new Map()
      procesosData?.forEach(p => procesosMap.set(p.id, p))
      setProcesos(procesosMap)

      const carrosMap = new Map()
      carrosData?.forEach(c => carrosMap.set(c.id, c))
      setCarros(carrosMap)
    } catch (err) {
      console.error('Error cargando datos:', err)
    }
  }

  async function handleScanQR() {
    if (!qrInput) return

    try {
      const { data: pieza } = await supabase
        .from('piezas')
        .select('*')
        .or(`qr_code.eq.${qrInput},codigo_unico.eq.${qrInput}`)
        .single()

      if (!pieza) {
        setError('Pieza no encontrada')
        return
      }

      setPiezaActual(pieza)
      setQrInput('')
      setError('')

      // Cargar tareas de la pieza ordenadas por secuencia
      const { data: tareasData } = await supabase
        .from('tareas_produccion')
        .select('*')
        .eq('pieza_id', pieza.id)
        .order('orden_secuencia')

      setTareasActuales(tareasData || [])

      // Encontrar tarea activa (siguiente sin completar)
      const siguiente = tareasData?.find(t => t.estado !== 'completada')
      if (siguiente) {
        setTareaActiva(siguiente)
        setCronometro(siguiente.tiempo_acumulado || 0)
      }

      // Preguntar por carro si es la primera vez
      if (!pieza.carro_id) {
        setShowCarroDialog(true)
      }
    } catch (err) {
      setError('Error al procesar QR')
      console.error(err)
    }
  }

  async function asignarCarro() {
    if (!piezaActual || !carroAsignado) return

    await supabase
      .from('piezas')
      .update({ carro_id: carroAsignado })
      .eq('id', piezaActual.id)

    setShowCarroDialog(false)
  }

  async function iniciarTarea() {
    if (!tareaActiva) return

    await supabase
      .from('tareas_produccion')
      .update({
        estado: 'en_progreso',
        fecha_inicio: new Date().toISOString(),
        tiempo_acumulado: 0,
      })
      .eq('id', tareaActiva.id)

    setCronometro(0)
    setCorriendo(true)
    setPausado(false)
  }

  async function pausarTarea() {
    if (!tareaActiva) return

    await supabase
      .from('tareas_produccion')
      .update({ tiempo_acumulado: cronometro, en_pausa: true })
      .eq('id', tareaActiva.id)

    setCorriendo(false)
    setPausado(true)
  }

  async function completarTarea() {
    if (!tareaActiva || !piezaActual) return

    const tiempo_real = cronometro
    const dentro_tiempo = tiempo_real <= (tareaActiva.tiempo_estimado * 60)

    // Actualizar tarea
    await supabase
      .from('tareas_produccion')
      .update({
        estado: 'completada',
        tiempo_real,
        fecha_fin: new Date().toISOString(),
      })
      .eq('id', tareaActiva.id)

    // Encontrar siguiente tarea
    const siguiente = tareasActuales.find((t, idx) => 
      tareasActuales.indexOf(tareaActiva) < idx && t.estado !== 'completada'
    )

    if (siguiente) {
      setTareaActiva(siguiente)
      setCronometro(0)
      setCorriendo(false)
      setPausado(false)
    } else {
      // Todas completadas
      await supabase
        .from('piezas')
        .update({ estado: 'completada' })
        .eq('id', piezaActual.id)

      setPiezaActual(null)
      setTareaActiva(null)
    }
  }

  const minutos = Math.floor(cronometro / 60)
  const segundos = cronometro % 60
  const tiempoEstimadoSeg = (tareaActiva?.tiempo_estimado || 0) * 60
  const tiempoExcedido = cronometro > tiempoEstimadoSeg && tiempoEstimadoSeg > 0

  return (
    <div className="space-y-6 p-6">
      {/* Escaneo QR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Escanear Pieza
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Escanea el código QR o ingresa el código único"
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleScanQR()}
              className="flex-1 px-3 py-2 border rounded-md"
              autoFocus
            />
            <Button onClick={handleScanQR}>Cargar Pieza</Button>
          </div>
          {error && <Alert className="mt-2 bg-red-50"><AlertDescription>{error}</AlertDescription></Alert>}
        </CardContent>
      </Card>

      {/* Asignación a carro */}
      {showCarroDialog && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Ubicar pieza en carro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Selecciona carro</label>
              <Select value={carroAsignado} onValueChange={setCarroAsignado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(carros.values()).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.codigo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={asignarCarro} className="w-full">Asignar Carro</Button>
          </CardContent>
        </Card>
      )}

      {/* Tarea activa */}
      {piezaActual && tareaActiva && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Pieza: {piezaActual.codigo_unico}</CardTitle>
                <p className="text-sm text-muted-foreground">Proceso: {procesos.get(tareaActiva.proceso_id)?.nombre}</p>
              </div>
              <Badge variant={tareaActiva.estado === 'en_progreso' ? 'default' : 'outline'}>
                {tareaActiva.estado.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cronómetro */}
            <div className="text-center">
              <div className={`text-6xl font-mono font-bold ${tiempoExcedido ? 'text-red-600' : 'text-blue-600'}`}>
                {String(minutos).padStart(2, '0')}:{String(segundos).padStart(2, '0')}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Tiempo estimado: {tareaActiva.tiempo_estimado}min ({(tareaActiva.tiempo_estimado * 60)}s)
              </p>
              {tiempoExcedido && (
                <div className="flex items-center gap-2 mt-2 text-red-600 justify-center">
                  <AlertTriangle className="w-4 h-4" />
                  Tiempo excedido
                </div>
              )}
            </div>

            {/* Controles */}
            <div className="flex gap-2 justify-center">
              {!corriendo ? (
                <Button onClick={iniciarTarea} size="lg" className="gap-2">
                  <Play className="w-4 h-4" />
                  Iniciar
                </Button>
              ) : (
                <Button onClick={pausarTarea} size="lg" variant="secondary" className="gap-2">
                  <Pause className="w-4 h-4" />
                  Pausar
                </Button>
              )}
              <Button onClick={completarTarea} size="lg" variant="default" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Completar
              </Button>
            </div>

            {/* Siguiente tarea */}
            {tareasActuales.length > 1 && (
              <div className="bg-slate-50 p-3 rounded">
                <p className="text-sm font-medium mb-2">Secuencia de procesos:</p>
                <div className="space-y-1">
                  {tareasActuales.map((t, idx) => (
                    <div key={t.id} className={`text-sm p-2 rounded ${
                      t.id === tareaActiva.id ? 'bg-blue-100 font-medium' : 
                      t.estado === 'completada' ? 'bg-green-100 line-through' :
                      'opacity-50'
                    }`}>
                      {idx + 1}. {procesos.get(t.proceso_id)?.nombre} - {t.tiempo_estimado}min
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!piezaActual && (
        <Card className="text-center py-12">
          <CardContent>
            <QrCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">Escanea una pieza para empezar</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
