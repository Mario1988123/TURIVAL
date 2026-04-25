/**
 * Logo Turiaval — SVG inline reutilizable.
 *
 * Diseno: cuadrado redondeado con gradiente azul-cian, letra "T" en
 * blanco y una "gota de barniz" simbolica en la esquina (alegoria de
 * lacado). Limpio para favicon, sidebar, login.
 *
 * Uso:
 *   <TuriavalLogo size={48} />
 *   <TuriavalLogo size={32} className="rounded-xl shadow-lg" />
 */

interface Props {
  size?: number
  className?: string
  /** Si true, sin sombra ni borde — para usar dentro de otra superficie. */
  liso?: boolean
}

export function TuriavalLogo({ size = 40, className = '', liso = false }: Props) {
  const id = `tv-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`${liso ? '' : 'shadow-md shadow-blue-500/30'} ${className}`}
      aria-label="Turiaval"
      role="img"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1d4ed8" />
          <stop offset="0.55" stopColor="#2563eb" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={`${id}-brillo`} x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#${id}-bg)`} />
      <rect x="2" y="2" width="60" height="30" rx="14" fill={`url(#${id}-brillo)`} />
      {/* Letra T limpia y centrada */}
      <path d="M14 18 H50 V26 H36 V47 H28 V26 H14 Z" fill="white" />
      {/* Gota de barniz */}
      <circle cx="48.5" cy="19.5" r="3.2" fill="#ffffff" />
      <circle cx="48.5" cy="19.5" r="1.3" fill="#06b6d4" />
    </svg>
  )
}

export default TuriavalLogo
