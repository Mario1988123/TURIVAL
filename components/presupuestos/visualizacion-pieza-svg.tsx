'use client'

/**
 * Visualización 2D de una pieza con vista frontal + perfil.
 * Las caras que se lacan aparecen en verde, las que no en gris.
 * Para molduras muestra el perfil lineal.
 */

export type DatosVisualizacionPieza = {
  tipo_pieza: 'tablero' | 'frente' | 'moldura' | 'irregular'
  ancho: number // mm
  alto: number // mm
  grosor: number // mm
  longitud_ml?: number | null // metros (solo moldura)
  cara_frontal: boolean
  cara_trasera: boolean
  canto_superior: boolean
  canto_inferior: boolean
  canto_izquierdo: boolean
  canto_derecho: boolean
  color_hex?: string | null
}

const COLOR_LACA_ON = '#22c55e' // verde-500
const COLOR_LACA_OFF = '#e2e8f0' // slate-200
const COLOR_STROKE = '#475569' // slate-600
const COLOR_TEXT = '#334155' // slate-700

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

  // IRREGULAR: solo un placeholder
  if (tipo_pieza === 'irregular') {
    return (
      <div className="border rounded-md bg-slate-50 p-4 text-center">
        <div className="text-4xl mb-1">📐</div>
        <div className="text-xs text-muted-foreground">
          Pieza irregular — sin visualización
        </div>
      </div>
    )
  }

  // MOLDURA: perfil lineal
  if (tipo_pieza === 'moldura') {
    const lon = longitud_ml ?? 0
    return (
      <div className="border rounded-md bg-slate-50 p-3">
        <div className="text-xs font-semibold mb-2 text-slate-700">
          Perfil moldura · {lon > 0 ? `${lon.toFixed(2)} m` : 'longitud no definida'}
        </div>
        <svg viewBox="0 0 300 80" className="w-full h-auto">
          {/* Barra moldura */}
          <rect
            x="20"
            y="30"
            width="260"
            height="20"
            fill={color_hex || COLOR_LACA_ON}
            stroke={COLOR_STROKE}
            strokeWidth="1.5"
          />
          {/* Perfil lateral (sección) */}
          <rect
            x="20"
            y="55"
            width="10"
            height="15"
            fill={color_hex || COLOR_LACA_ON}
            stroke={COLOR_STROKE}
            strokeWidth="1"
          />
          {/* Medidas */}
          <text x="150" y="25" fontSize="10" fill={COLOR_TEXT} textAnchor="middle">
            {lon > 0 ? `${lon.toFixed(2)} m lineales` : '—'}
          </text>
          <text x="150" y="65" fontSize="9" fill={COLOR_TEXT} textAnchor="middle">
            {ancho > 0 && grosor > 0 ? `perfil ${ancho} × ${grosor} mm` : ''}
          </text>
          {/* Línea de lacado completo */}
          <line
            x1="20"
            y1="25"
            x2="280"
            y2="25"
            stroke={COLOR_LACA_ON}
            strokeWidth="2"
            strokeDasharray="4,2"
          />
        </svg>
        <div className="text-[10px] text-center text-muted-foreground mt-1">
          Se laca toda la superficie del perfil
        </div>
      </div>
    )
  }

  // TABLERO / FRENTE: vista frontal + perfil
  if (!ancho || !alto) {
    return (
      <div className="border rounded-md bg-slate-50 p-6 text-center text-xs text-muted-foreground">
        Introduce ancho y alto para ver la pieza
      </div>
    )
  }

  // Normalizar medidas a SVG
  const maxDim = Math.max(ancho, alto)
  const escalaFrontal = 140 / maxDim
  const wFront = ancho * escalaFrontal
  const hFront = alto * escalaFrontal

  // Perfil: usamos una escala distinta porque el grosor suele ser pequeño
  const grosorMostrado = Math.max(grosor * escalaFrontal, grosor > 0 ? 8 : 4)
  const wPerfil = grosorMostrado
  const hPerfil = hFront

  // Colores por cara
  const cFrontal = cara_frontal ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cTrasera = cara_trasera ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cCantoSup = canto_superior ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cCantoInf = canto_inferior ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cCantoIzq = canto_izquierdo ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF
  const cCantoDer = canto_derecho ? color_hex || COLOR_LACA_ON : COLOR_LACA_OFF

  // Layout: vista frontal a la izquierda, perfil a la derecha
  const svgW = 280
  const svgH = Math.max(hFront + 50, 140)
  const xFront = 20
  const yFront = 30
  const xPerfil = xFront + wFront + 40
  const yPerfil = yFront

  return (
    <div className="border rounded-md bg-slate-50 p-3">
      <div className="grid grid-cols-2 text-[10px] font-semibold text-slate-700 mb-1">
        <div className="text-center">Vista frontal</div>
        <div className="text-center">Perfil</div>
      </div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
        {/* ============ VISTA FRONTAL ============ */}

        {/* Cara frontal (fondo) */}
        <rect
          x={xFront}
          y={yFront}
          width={wFront}
          height={hFront}
          fill={cFrontal}
          stroke={COLOR_STROKE}
          strokeWidth="1.5"
        />

        {/* Línea borde canto superior (grueso si está lacado) */}
        <line
          x1={xFront}
          y1={yFront}
          x2={xFront + wFront}
          y2={yFront}
          stroke={cCantoSup === COLOR_LACA_OFF ? COLOR_STROKE : cCantoSup}
          strokeWidth={canto_superior ? 4 : 1.5}
        />
        {/* Canto inferior */}
        <line
          x1={xFront}
          y1={yFront + hFront}
          x2={xFront + wFront}
          y2={yFront + hFront}
          stroke={cCantoInf === COLOR_LACA_OFF ? COLOR_STROKE : cCantoInf}
          strokeWidth={canto_inferior ? 4 : 1.5}
        />
        {/* Canto izquierdo */}
        <line
          x1={xFront}
          y1={yFront}
          x2={xFront}
          y2={yFront + hFront}
          stroke={cCantoIzq === COLOR_LACA_OFF ? COLOR_STROKE : cCantoIzq}
          strokeWidth={canto_izquierdo ? 4 : 1.5}
        />
        {/* Canto derecho */}
        <line
          x1={xFront + wFront}
          y1={yFront}
          x2={xFront + wFront}
          y2={yFront + hFront}
          stroke={cCantoDer === COLOR_LACA_OFF ? COLOR_STROKE : cCantoDer}
          strokeWidth={canto_derecho ? 4 : 1.5}
        />

        {/* Medidas frontal */}
        <text
          x={xFront + wFront / 2}
          y={yFront - 5}
          fontSize="9"
          fill={COLOR_TEXT}
          textAnchor="middle"
        >
          {ancho} mm
        </text>
        <text
          x={xFront - 5}
          y={yFront + hFront / 2}
          fontSize="9"
          fill={COLOR_TEXT}
          textAnchor="end"
          dominantBaseline="middle"
        >
          {alto}
        </text>
        <text
          x={xFront - 5}
          y={yFront + hFront / 2 + 10}
          fontSize="9"
          fill={COLOR_TEXT}
          textAnchor="end"
          dominantBaseline="middle"
        >
          mm
        </text>

        {/* Etiqueta "Frontal" */}
        <text
          x={xFront + wFront / 2}
          y={yFront + hFront + 15}
          fontSize="9"
          fill={cara_frontal ? '#15803d' : '#94a3b8'}
          textAnchor="middle"
        >
          {cara_frontal ? '✓ Frontal lacada' : 'Frontal sin lacar'}
        </text>

        {/* ============ VISTA PERFIL ============ */}

        {/* Cara trasera (lado del perfil) */}
        <rect
          x={xPerfil}
          y={yPerfil}
          width={wPerfil}
          height={hPerfil}
          fill={cTrasera === COLOR_LACA_OFF ? '#f1f5f9' : cTrasera}
          stroke={COLOR_STROKE}
          strokeWidth="1.5"
        />

        {/* Canto sup del perfil (representa canto superior visto de lado) */}
        <line
          x1={xPerfil}
          y1={yPerfil}
          x2={xPerfil + wPerfil}
          y2={yPerfil}
          stroke={cCantoSup === COLOR_LACA_OFF ? COLOR_STROKE : cCantoSup}
          strokeWidth={canto_superior ? 4 : 1.5}
        />
        {/* Canto inf del perfil */}
        <line
          x1={xPerfil}
          y1={yPerfil + hPerfil}
          x2={xPerfil + wPerfil}
          y2={yPerfil + hPerfil}
          stroke={cCantoInf === COLOR_LACA_OFF ? COLOR_STROKE : cCantoInf}
          strokeWidth={canto_inferior ? 4 : 1.5}
        />
        {/* Línea frontal en perfil (lado izquierdo del rectángulo) */}
        <line
          x1={xPerfil}
          y1={yPerfil}
          x2={xPerfil}
          y2={yPerfil + hPerfil}
          stroke={cFrontal === COLOR_LACA_OFF ? COLOR_STROKE : cFrontal}
          strokeWidth={cara_frontal ? 4 : 1.5}
        />
        {/* Línea trasera en perfil (lado derecho del rectángulo) */}
        <line
          x1={xPerfil + wPerfil}
          y1={yPerfil}
          x2={xPerfil + wPerfil}
          y2={yPerfil + hPerfil}
          stroke={cTrasera === COLOR_LACA_OFF ? COLOR_STROKE : cTrasera}
          strokeWidth={cara_trasera ? 4 : 1.5}
        />

        {/* Medida grosor */}
        <text
          x={xPerfil + wPerfil / 2}
          y={yPerfil - 5}
          fontSize="9"
          fill={COLOR_TEXT}
          textAnchor="middle"
        >
          {grosor} mm
        </text>
        <text
          x={xPerfil + wPerfil + 6}
          y={yPerfil + hPerfil / 2}
          fontSize="9"
          fill={COLOR_TEXT}
          dominantBaseline="middle"
        >
          {alto}
        </text>

        {/* Etiqueta "Trasera" */}
        <text
          x={xPerfil + wPerfil / 2}
          y={yPerfil + hPerfil + 15}
          fontSize="9"
          fill={cara_trasera ? '#15803d' : '#94a3b8'}
          textAnchor="middle"
        >
          {cara_trasera ? '✓ Trasera lacada' : 'Trasera sin lacar'}
        </text>
      </svg>

      {/* Leyenda */}
      <div className="flex gap-3 justify-center text-[10px] mt-2 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: color_hex || COLOR_LACA_ON }} />
          Se laca
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: COLOR_LACA_OFF }} />
          Sin lacar
        </span>
        {grosor > 0 && grosor <= 19 && (
          <span className="text-amber-700">⚠ Grosor ≤ 19mm: los cantos no suman superficie</span>
        )}
        {grosor > 19 && (canto_superior || canto_inferior || canto_izquierdo || canto_derecho) && (
          <span className="text-green-700">✓ Cantos contabilizados en superficie</span>
        )}
      </div>
    </div>
  )
}
