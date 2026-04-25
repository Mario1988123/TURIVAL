import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Turiaval — Móvil taller',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

/**
 * Layout movil dedicado para operarios. Sin sidebar, sin header,
 * pantalla completa con botones grandes para taller. Ideal para
 * tablet/movil colgado al lado de la maquina.
 */
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 antialiased">
      {children}
    </div>
  )
}
