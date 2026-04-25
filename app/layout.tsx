import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: 'Turiaval — ERP Lacados',
    template: '%s · Turiaval',
  },
  description: 'Sistema de gestion empresarial para Turiaval, lacados industriales en Valencia. Presupuestos, pedidos, produccion, planificacion Gantt, trazabilidad y albaranes.',
  applicationName: 'Turiaval',
  authors: [{ name: 'Turiaval' }],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
