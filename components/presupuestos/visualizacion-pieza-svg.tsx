'use client'

/**
 * Visualización 2D de una pieza con vista frontal + perfil.
 * Las caras que se lacan aparecen en verde, las que no en gris.
 */

export type DatosVisualizacionPieza = {
  tipo_pieza: 'tablero' | 'frente' | 'moldura' | 'irregular'
  ancho: number
  alto: number
  grosor: number
  longitud_ml?: number | null
  cara_frontal: boolean
  cara_trasera: boolean
  canto_superior: boolean
  canto_inferior: boolean
  canto_izquierdo: boolean
  canto_derecho: boolean
  color_hex?: string | null
}

const COLOR_LACA_ON = '#22c55e'
const COLOR_LACA_OFF = '#e2e8f0'
const COLOR_STROKE = '#475569'
const COLOR_TEXT = '#334155'

export default function VisualizacionPiezaSVG({
  datos,
}: {
  datos: DatosVisualizacionPieza
}) {
  const {
    tipo_pieza,
    ancho,
    alto,
    grosor,
    longitud_ml,
    cara_frontal,
    cara_trasera,
    canto_superior,
    canto_inferior,
    canto_izquierdo,
    canto_derecho,
    color_hex,
  } = datos

  // IRREGULAR
  if (tipo_pieza === 'irregular') {
    return (
      <div className="border rounded-md bg-slate-50 p-6 text-center">
        <div className="text-5xl mb-2">📐</div>
        <div className="text-sm text-muted-foreground">
          Pieza irregular — sin visualización
        </div>
      </div>
    )
  }

  // MOLDURA
  if (tipo_pieza === 'moldura') {
    const lon = longitud_ml ?? 0
    return (
      <div className="border rounded-md bg-slate-50 p-4">
        <div className="text-sm font-semibold mb-3 text-center text-slate-700">
          Perfil moldura
        </div>
        <svg viewBox="0 0 320 120" className="w-full h-auto">
          {/* Barra principal (vista longitudinal) */}
          <rect
            x="20"
            y="40"
            width="280"
            height="25"
            fill={color_hex || COLOR_LACA_ON}
            stroke={COLOR_STROKE}
            strokeWidth="1.5"
          />
          {/* Líneas de lacado arriba/abajo */}
          <line
            x1="20" y1="36" x2="300" y2="36"
            stroke={COLOR_LACA_ON} strokeWidth="3" strokeDasharray="5,2"
          />
          <line
            x1="20" y1="69" x2="300" y2="69"
            stroke={COLOR_LACA_ON} strokeWidth="3" strokeDasharray="5,2"
          />
          {/* Medida longitud */}
          <text x="160" y="25" fontSize="12" fill={COLOR_TEXT} textAnchor="middle" fontWeight="500">
            {lon > 0 ? `${lon.toFixed(2)} m lineales` : '— m lineales'}
          </text>
          {/* Perfil sección a la derecha */}
          <g>
            <text x="160" y="90" fontSize="10" fill={COLOR_TEXT} textAnchor="middle">
              Sección del perfil
            </text>
            <rect
              x="140"
              y="95"
              width={Math.min(Math.max((ancho / 10), 15), 40)}
              height={Math.min(Math.max((grosor / 2), 10), 20)}
              fill={color_hex || COLOR_LACA_ON}
              stroke={COLOR_STROKE}
              strokeWidth="1"
            />
            <text x="160" y="115" fontSize="9" fill={COLOR_TEXT} textAnchor="middle">
              {ancho > 0 && grosor > 0 ? `${ancho} × ${grosor} mm` : 'perfil no definido'}
            </text>
          </g>
        </svg>
        <div className="text-center text-xs text-muted-foreground mt-2">
          Se laca toda la superficie del perfil
        </div>
      </div>
    )
  }

  // TABLERO / FRENTE
  if (!ancho || !alto) {
    return (
      <div className="border rounded-md bg-slate-50 p-8 text-center text-sm text-muted-foreground">
        Introduce <strong>ancho y alto</strong> para ver la pieza
      </div>
    )
  }

  // Escalado: mantener ratio pero con límites
  // Queremos que el SVG frontal ocupe ~ 240×240 como máximo en area útil
  const MAX_W = 220
  const MAX_H = 260
  const ratio = ancho / alto
  let wFront: number
  let hFront: number

  if (ratio > 1) {
    // más ancho que alto
    wFront = MAX_W
    hFront = MAX_W / ratio
    if (hFront > MAX_H) {
      hFront = MAX_H
      wFront = MAX_H * ratio
    }
  } else {
    // más alto que ancho
    hFront = MAX_H
    wFront = MAX_H * ratio
    if (wFront > MAX_W) {
      wFront = MAX_W
      hFront = MAX_W / ratio
    }
  }

  // Mínimos para que nunca quede demasiado fino
  wFront = Math.max(wFront, 30)
  hFront = Math.max(hFront, 30)

  // Perfil: mismo alto que frontal, ancho proporcional al grosor
  const escalaFrontal = wFront / ancho
  const grosorEscalado = Math.max(grosor * escalaFrontal, 18)
  const wPerfil = grosorEscalado
  const hPerfil = hFront

  // Colores por cara
  const cFrontal = cara_frontal ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cTrasera = cara_trasera ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cCantoSup = canto_superior ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cCantoInf = canto_inferior ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cCantoIzq = canto_izquierdo ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cCantoDer = canto_derecho ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF

  return (
    <div className="border rounded-md bg-slate-50 p-4 space-y-3">
      {/* Layout flex con 2 columnas: frontal y perfil, separadas */}
      <div className="flex items-start justify-center gap-8 flex-wrap">

        {/* VISTA FRONTAL */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-semibold text-slate-700 mb-2">Vista frontal</div>
          <div className="relative">
            {/* Medida ancho arriba */}
            <div className="text-[11px] text-center text-slate-600 mb-1">
              ← {ancho} mm →
            </div>
            {/* SVG cuerpo + medida alto al lado */}
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-slate-600 whitespace-nowrap">
                {alto}
                <br />mm
              </div>
              <svg
                width={wFront}
                height={hFront}
                viewBox={`0 0 ${wFront} ${hFront}`}
                className="overflow-visible"
              >
                {/* Cara frontal (fondo) */}
                <rect
                  x="0" y="0"
                  width={wFront} height={hFront}
                  fill={cFrontal}
                  stroke={COLOR_STROKE}
                  strokeWidth="1.5"
                />
                {/* Canto superior */}
                <line
                  x1="0" y1="0" x2={wFront} y2="0"
                  stroke={cCantoSup === COLOR_LACA_OFF ? COLOR_STROKE : cCantoSup}
                  strokeWidth={canto_superior ? 5 : 1.5}
                />
                {/* Canto inferior */}
                <line
                  x1="0" y1={hFront} x2={wFront} y2={hFront}
                  stroke={cCantoInf === COLOR_LACA_OFF ? COLOR_STROKE : cCantoInf}
                  strokeWidth={canto_inferior ? 5 : 1.5}
                />
                {/* Canto izquierdo */}
                <line
                  x1="0" y1="0" x2="0" y2={hFront}
                  stroke={cCantoIzq === COLOR_LACA_OFF ? COLOR_STROKE : cCantoIzq}
                  strokeWidth={canto_izquierdo ? 5 : 1.5}
                />
                {/* Canto derecho */}
                <line
                  x1={wFront} y1="0" x2={wFront} y2={hFront}
                  stroke={cCantoDer === COLOR_LACA_OFF ? COLOR_STROKE : cCantoDer}
                  strokeWidth={canto_derecho ? 5 : 1.5}
                />
              </svg>
            </div>
          </div>
          <div className={`text-[11px] mt-2 font-medium ${cara_frontal ? 'text-green-700' : 'text-slate-400'}`}>
            {cara_frontal ? '✓ Frontal lacada' : 'Frontal sin lacar'}
          </div>
        </div>

        {/* VISTA PERFIL */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-semibold text-slate-700 mb-2">Perfil (vista lateral)</div>
          <div className="relative">
            <div className="text-[11px] text-center text-slate-600 mb-1">
              ← {grosor} mm →
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-slate-600 whitespace-nowrap">
                {alto}
                <br />mm
              </div>
              <svg
                width={wPerfil}
                height={hPerfil}
                viewBox={`0 0 ${wPerfil} ${hPerfil}`}
                className="overflow-visible"
              >
                {/* Fondo del perfil (neutro) */}
                <rect
                  x="0" y="0"
                  width={wPerfil} height={hPerfil}
                  fill="#f8fafc"
                  stroke={COLOR_STROKE}
                  strokeWidth="1.5"
                />
                {/* Lado izquierdo del perfil = cara frontal */}
                <line
                  x1="0" y1="0" x2="0" y2={hPerfil}
                  stroke={cFrontal === COLOR_LACA_OFF ? COLOR_STROKE : cFrontal}
                  strokeWidth={cara_frontal ? 5 : 1.5}
                />
                {/* Lado derecho del perfil = cara trasera */}
                <line
                  x1={wPerfil} y1="0" x2={wPerfil} y2={hPerfil}
                  stroke={cTrasera === COLOR_LACA_OFF ? COLOR_STROKE : cTrasera}
                  strokeWidth={cara_trasera ? 5 : 1.5}
                />
                {/* Línea superior del perfil = canto superior */}
                <line
                  x1="0" y1="0" x2={wPerfil} y2="0"
                  stroke={cCantoSup === COLOR_LACA_OFF ? COLOR_STROKE : cCantoSup}
                  strokeWidth={canto_superior ? 5 : 1.5}
                />
                {/* Línea inferior del perfil = canto inferior */}
                <line
                  x1="0" y1={hPerfil} x2={wPerfil} y2={hPerfil}
                  stroke={cCantoInf === COLOR_LACA_OFF ? COLOR_STROKE : cCantoInf}
                  strokeWidth={canto_inferior ? 5 : 1.5}
                />
              </svg>
            </div>
          </div>
          <div className={`text-[11px] mt-2 font-medium ${cara_trasera ? 'text-green-700' : 'text-slate-400'}`}>
            {cara_trasera ? '✓ Trasera lacada' : 'Trasera sin lacar'}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 justify-center text-[11px] flex-wrap border-t pt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm border" style={{ backgroundColor: color_hex || COLOR_LACA_ON }} />
          Se laca
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm border" style={{ backgroundColor: COLOR_LACA_OFF }} />
          Sin lacar
        </span>
      </div>

      {/* Aviso grosor */}
      {grosor > 0 && grosor <= 19 && (
        <div className="text-center text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1.5">
          ⚠ Grosor ≤ 19mm: los cantos no suman superficie en el cálculo
        </div>
      )}
      {grosor > 19 && (canto_superior || canto_inferior || canto_izquierdo || canto_derecho) && (
        <div className="text-center text-[11px] text-green-700 bg-green-50 rounded px-2 py-1.5">
          ✓ Grosor &gt; 19mm: los cantos marcados sí suman en la superficie
        </div>
      )}
    </div>
  )
}
