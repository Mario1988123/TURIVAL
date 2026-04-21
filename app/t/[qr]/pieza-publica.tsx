'use client'

import {
  Package,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  Factory,
  Calendar,
  User,
  Zap,
} from 'lucide-react'

// =============================================================
// TIPOS
// =============================================================

interface Tarea {
  secuencia: number
  estado: string
  fecha_inicio_real: string | null
  fecha_fin_real: string | null
  fecha_fin_secado: string | null
  tiempo_real_minutos: number | null
  tiempo_estimado_minutos: number | null
  forzado_seco: boolean | null
  proceso_nombre: string
  proceso_abreviatura: string | null
  proceso_color: string | null
  proceso_requiere_secado: boolean | null
  operario_nombre: string | null
  operario_color: string | null
}

interface Movimiento {
  fecha: string
  motivo: string | null
  origen_codigo: string | null
  origen_nombre: string | null
  destino_codigo: string | null
  destino_nombre: string | null
}

interface Datos {
  pieza: {
    id: string
    numero: string
    estado: string
    qr_codigo: string | null
    tipo_pieza: string | null
    ancho: number | null
    alto: number | null
    grosor: number | null
    longitud_ml: number | null
    superficie_m2: number | null
    fecha_confirmacion: string | null
    fecha_completada: string | null
    fecha_entrega: string | null
    material_disponible: boolean | null
  }
  color: { nombre: string; codigo: string | null; hex_aproximado: string | null } | null
  tratamiento: { nombre: string } | null
  ubicacion: { codigo: string; nombre: string; tipo: string } | null
  pedido: {
    numero: string
    estado: string
    prioridad: string | null
    fecha_creacion: string | null
    fecha_entrega_estimada: string | null
    descripcion_linea: string | null
  } | null
  cliente: { nombre_comercial: string } | null
  producto: { nombre: string } | null
  tareas: Tarea[] | null
  movimientos: Movimiento[] | null
}

// =============================================================
// Labels y colores
// =============================================================

const ESTADO_PIEZA: Record<string, { label: string; clase: string }> = {
  sin_producir:  { label: 'Sin producir',  clase: 'bg-slate-100 text-slate-700' },
  en_produccion: { label: 'En producción', clase: 'bg-amber-100 text-amber-800' },
  completada:    { label: 'Completada',    clase: 'bg-emerald-100 text-emerald-800' },
  en_almacen:    { label: 'En almacén',    clase: 'bg-blue-100 text-blue-800' },
  entregada:     { label: 'Entregada',     clase: 'bg-green-200 text-green-900' },
  incidencia:    { label: 'Incidencia',    clase: 'bg-red-100 text-red-800' },
  cancelada:     { label: 'Cancelada',     clase: 'bg-slate-100 text-slate-500' },
}

const ESTADO_TAREA: Record<string, { label: string; clase: string }> = {
  pendiente:    { label: 'Pendiente',    clase: 'bg-slate-100 text-slate-700' },
  en_cola:      { label: 'En cola',      clase: 'bg-slate-200 text-slate-800' },
  en_progreso:  { label: 'En progreso',  clase: 'bg-amber-100 text-amber-800' },
  en_secado:    { label: 'En secado',    clase: 'bg-purple-100 text-purple-800' },
  completada:   { label: 'Completada',   clase: 'bg-emerald-100 text-emerald-800' },
  incidencia:   { label: 'Incidencia',   clase: 'bg-red-100 text-red-800' },
  anulada:      { label: 'Anulada',      clase: 'bg-slate-100 text-slate-500' },
}

const ESTADO_PEDIDO: Record<string, string> = {
  borrador:      'Borrador',
  confirmado:    'Confirmado',
  en_produccion: 'En producción',
  completado:    'Completado',
  entregado:     'Entregado',
  facturado:     'Facturado',
  cancelado:     'Cancelado',
}

// =============================================================
// Helpers
// =============================================================

function fechaHora(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function formatearMinutos(m: number | null): string {
  if (m == null || !Number.isFinite(m)) return '—'
  const mins = Math.round(m)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const r = mins % 60
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

// =============================================================
// Componente
// =============================================================

export default function PiezaPublica({ data }: { data: Datos }) {
  const { pieza, color, tratamiento, ubicacion, pedido, cliente, producto, tareas, movimientos } = data
  const estadoInfo = ESTADO_PIEZA[pieza.estado] ?? ESTADO_PIEZA.sin_producir

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-6 h-6 text-blue-400" />
            <span className="text-sm font-medium text-slate-300">
              Trazabilidad de pieza
            </span>
          </div>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <h1 className="text-3xl md:text-4xl font-mono font-bold tracking-tight">
              {pieza.numero}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${estadoInfo.clase}`}
            >
              {estadoInfo.label}
            </span>
          </div>
          {pedido && (
            <div className="mt-2 text-slate-300 text-sm">
              Pedido{' '}
              <span className="font-mono text-white font-semibold">{pedido.numero}</span>
              {cliente && ` · ${cliente.nombre_comercial}`}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Datos de la pieza */}
        <section className="bg-white rounded-lg border shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Datos de la pieza
          </h2>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {producto?.nombre && (
              <Campo label="Producto" valor={producto.nombre} />
            )}
            {pieza.tipo_pieza && (
              <Campo label="Tipo" valor={pieza.tipo_pieza} />
            )}
            {color?.nombre && (
              <div>
                <dt className="text-xs text-slate-500 mb-1">Color</dt>
                <dd className="font-medium flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border border-slate-300"
                    style={{ backgroundColor: color.hex_aproximado || '#ccc' }}
                  />
                  <span>{color.nombre}</span>
                  {color.codigo && (
                    <span className="text-xs text-slate-500">({color.codigo})</span>
                  )}
                </dd>
              </div>
            )}
            {tratamiento?.nombre && (
              <Campo label="Tratamiento" valor={tratamiento.nombre} />
            )}
            {pieza.tipo_pieza === 'moldura' ? (
              <>
                {pieza.longitud_ml != null && (
                  <Campo
                    label="Longitud"
                    valor={`${Number(pieza.longitud_ml).toFixed(2)} m`}
                  />
                )}
                {pieza.ancho != null && pieza.grosor != null && (
                  <Campo label="Perfil" valor={`${pieza.ancho} × ${pieza.grosor} mm`} />
                )}
              </>
            ) : (
              <>
                {pieza.ancho != null && pieza.alto != null && (
                  <Campo
                    label="Dimensiones"
                    valor={`${pieza.ancho} × ${pieza.alto}${pieza.grosor ? ` × ${pieza.grosor}` : ''} mm`}
                  />
                )}
                {pieza.superficie_m2 != null && Number(pieza.superficie_m2) > 0 && (
                  <Campo
                    label="Superficie"
                    valor={`${Number(pieza.superficie_m2).toFixed(3)} m²`}
                  />
                )}
              </>
            )}
            {pieza.fecha_confirmacion && (
              <Campo
                label="Confirmada"
                valor={fechaCorta(pieza.fecha_confirmacion)}
              />
            )}
            {pieza.fecha_completada && (
              <Campo
                label="Completada"
                valor={fechaCorta(pieza.fecha_completada)}
              />
            )}
          </dl>
        </section>

        {/* Pedido */}
        {pedido && (
          <section className="bg-white rounded-lg border shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Pedido
            </h2>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Campo label="Número" valor={pedido.numero} mono />
              <Campo
                label="Estado"
                valor={ESTADO_PEDIDO[pedido.estado] ?? pedido.estado}
              />
              {pedido.prioridad && (
                <Campo label="Prioridad" valor={pedido.prioridad} capitalize />
              )}
              {cliente?.nombre_comercial && (
                <Campo label="Cliente" valor={cliente.nombre_comercial} />
              )}
              {pedido.fecha_creacion && (
                <Campo
                  label="Fecha creación"
                  valor={fechaCorta(pedido.fecha_creacion)}
                />
              )}
              {pedido.fecha_entrega_estimada && (
                <Campo
                  label="Entrega prevista"
                  valor={fechaCorta(pedido.fecha_entrega_estimada)}
                />
              )}
            </dl>
            {pedido.descripcion_linea && (
              <div className="mt-4 pt-4 border-t text-sm">
                <div className="text-xs text-slate-500 mb-1">Descripción</div>
                <div className="text-slate-800">{pedido.descripcion_linea}</div>
              </div>
            )}
          </section>
        )}

        {/* Ubicación */}
        {ubicacion && (
          <section className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              Ubicación actual
            </h2>
            <div className="flex items-baseline gap-3">
              <span className="font-mono font-bold text-2xl text-blue-900">
                {ubicacion.codigo}
              </span>
              <span className="text-slate-700">{ubicacion.nombre}</span>
              <span className="text-xs text-slate-500 px-2 py-0.5 bg-white rounded border border-slate-200">
                {ubicacion.tipo}
              </span>
            </div>
          </section>
        )}

        {/* Tareas */}
        {tareas && tareas.length > 0 && (
          <section className="bg-white rounded-lg border shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Factory className="w-4 h-4" />
              Procesos de fabricación
            </h2>
            <div className="space-y-3">
              {tareas.map((t, i) => (
                <TareaItem key={`${t.secuencia}-${i}`} tarea={t} />
              ))}
            </div>
          </section>
        )}

        {/* Historial movimientos */}
        {movimientos && movimientos.length > 0 && (
          <section className="bg-white rounded-lg border shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              Historial de ubicaciones
            </h2>
            <ul className="space-y-2 text-sm">
              {movimientos.map((m, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 pb-2 border-b border-slate-100 last:border-0"
                >
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500">
                      {fechaHora(m.fecha)}
                    </div>
                    <div className="mt-0.5">
                      {m.origen_codigo ? (
                        <>
                          <span className="font-mono text-slate-600">
                            {m.origen_codigo}
                          </span>
                          <span className="mx-1 text-slate-400">→</span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500 mr-1">
                          Inicio →
                        </span>
                      )}
                      <span className="font-mono font-semibold">
                        {m.destino_codigo ?? '?'}
                      </span>
                      {m.destino_nombre && (
                        <span className="text-slate-500 ml-1">
                          ({m.destino_nombre})
                        </span>
                      )}
                    </div>
                    {m.motivo && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {m.motivo}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="text-center text-xs text-slate-400 pt-2 pb-8">
          Información pública de trazabilidad · Turiaval
        </footer>
      </div>
    </div>
  )
}

// =============================================================
// Subcomponentes
// =============================================================

function Campo({
  label,
  valor,
  mono = false,
  capitalize = false,
}: {
  label: string
  valor: string
  mono?: boolean
  capitalize?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500 mb-1">{label}</dt>
      <dd
        className={`font-medium text-slate-900 ${mono ? 'font-mono' : ''} ${capitalize ? 'capitalize' : ''}`}
      >
        {valor}
      </dd>
    </div>
  )
}

function TareaItem({ tarea }: { tarea: Tarea }) {
  const estadoInfo = ESTADO_TAREA[tarea.estado] ?? ESTADO_TAREA.pendiente
  const enSecadoConFecha = tarea.estado === 'en_secado' && tarea.fecha_fin_secado

  return (
    <div className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0">
      {/* Chip proceso */}
      <div
        className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-white font-bold text-sm"
        style={{ backgroundColor: tarea.proceso_color || '#475569' }}
      >
        <span className="text-base leading-none">
          {tarea.proceso_abreviatura ?? '?'}
        </span>
        <span className="text-[10px] font-normal opacity-80 mt-0.5">
          #{tarea.secuencia}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="font-medium">{tarea.proceso_nombre}</div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoInfo.clase}`}>
            {estadoInfo.label}
          </span>
        </div>

        <div className="mt-1 space-y-0.5 text-xs text-slate-600">
          {tarea.operario_nombre && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full border border-slate-300"
                style={{ backgroundColor: tarea.operario_color || '#64748b' }}
              />
              <User className="w-3 h-3" />
              <span>{tarea.operario_nombre}</span>
            </div>
          )}
          {tarea.fecha_inicio_real && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>Inicio: {fechaHora(tarea.fecha_inicio_real)}</span>
            </div>
          )}
          {tarea.fecha_fin_real && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" />
              <span>
                Fin proceso: {fechaHora(tarea.fecha_fin_real)}
                {tarea.tiempo_real_minutos != null && (
                  <span className="text-slate-400 ml-1">
                    ({formatearMinutos(tarea.tiempo_real_minutos)})
                  </span>
                )}
              </span>
            </div>
          )}
          {enSecadoConFecha && (
            <div className="flex items-center gap-1.5 text-purple-700">
              <Clock className="w-3 h-3" />
              <span>
                Secado hasta {fechaHora(tarea.fecha_fin_secado)}
              </span>
            </div>
          )}
          {tarea.forzado_seco && (
            <div className="flex items-center gap-1.5 text-purple-700">
              <Zap className="w-3 h-3" />
              <span>Secado forzado manualmente</span>
            </div>
          )}
          {tarea.estado === 'incidencia' && (
            <div className="flex items-center gap-1.5 text-red-700">
              <AlertTriangle className="w-3 h-3" />
              <span>Incidencia registrada</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
