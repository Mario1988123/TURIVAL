// app/presupuestos/nuevo-v2/layout.tsx
// Este archivo NO envuelve con AppLayout — el layout padre
// app/presupuestos/layout.tsx ya lo hace. Envolver aquí
// provocaba doble sidebar + doble header.
// Lo dejamos como passthrough para que Next.js respete
// la estructura de rutas sin añadir nada.

export default function NuevoV2Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
