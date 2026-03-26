# 🚀 GUÍA DE SETUP - FinePath ERP

## Paso 1: Configurar Supabase

### 1.1 Crear Proyecto
1. Ve a https://supabase.com/dashboard
2. Crea un nuevo proyecto o usa uno existente
3. Copia `Project URL` y `Anon Key` del dashboard

### 1.2 Ejecutar SQL (CRÍTICO)

1. En el dashboard, ve a **SQL Editor**
2. Haz clic en **+ New Query**
3. Abre el archivo `DATABASE_SETUP.md` en este proyecto
4. Copia **TODO** el SQL de la sección "Paso 2: Crear el Esquema"
5. Pégalo en el editor de SQL
6. Haz clic en **Execute**

Espera a que termine. Verás:
```
✓ 22 tablas creadas
✓ Índices creados
✓ Secuencias inicializadas
```

### 1.3 Habilitar RLS (Row Level Security)

1. Crea otra **+ New Query**
2. Copia **TODO** el SQL de la sección "Paso 3: Habilitar Row Level Security"
3. Ejecuta

---

## Paso 2: Configurar Variables de Entorno

### 2.1 Obtener Credenciales

En el dashboard de Supabase:
- Settings → API
- Copia `Project URL`
- Copia `anon public`
- Copia `service_role secret` (guárdalo seguro)

### 2.2 Crear `.env.local`

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# Supabase - OBLIGATORIO
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback

# Para producción (mantén seguro)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# URL de la app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Paso 3: Instalar Dependencias

```bash
cd tu-proyecto
pnpm install
```

Esto instala:
- Supabase client
- OCR (Tesseract.js)
- QR (qrcode)
- Y todas las dependencias del proyecto

---

## Paso 4: Ejecutar en Desarrollo

```bash
pnpm dev
```

Verás:
```
> next dev
  ▲ Next.js 16.2.0
  - Local:        http://localhost:3000
```

Abre http://localhost:3000 en el navegador.

---

## Paso 5: Crear Tu Primer Usuario

### 5.1 Ir a Sign Up
- URL: http://localhost:3000/auth/sign-up
- Completa el formulario

### 5.2 Confirmar Email (Desarrollo)

En desarrollo, Supabase NO envía emails reales.

**Para bypass:**
1. Ve a tu dashboard Supabase → Authentication → Users
2. Haz clic en el usuario que creaste
3. En "Email", marca "Confirm email address"

### 5.3 Login

- URL: http://localhost:3000/auth/login
- Usuario: El email que registraste
- Contraseña: La que estableciste

---

## Paso 6: Acceder al Dashboard

Tras login, verás:
- Sidebar con navegación
- Dashboard con estadísticas
- Botones de acciones rápidas

---

## Estructuras de Datos Clave

### Crear un Presupuesto

```typescript
import { crearPresupuesto } from '@/lib/services'

const { presupuesto, lineas } = await crearPresupuesto(
  cliente_id,
  [
    {
      producto_id: '...',
      cantidad: 1,
      modo_precio: 'm2',
      ancho: 1000,  // mm
      alto: 500,    // mm
      cara_frontal: true,
      cara_trasera: false,
      precio_m2: 50,
      precio_minimo: 150,
      suplemento_manual: 0,
    }
  ],
  'Observaciones'
)
```

**Resultado:**
- `presupuesto.numero`: "PRES-2026-0001"
- `presupuesto.total`: Cálculo automático
- `lineas[0].superficie_m2`: 1.0 m²
- `lineas[0].total_linea`: 150 € (aplica mínimo)

### Crear una Pieza con Trazabilidad

```typescript
import { crearPieza, crearFasesProduccion } from '@/lib/services'

const pieza = await crearPieza({
  pedido_id: '...',
  cliente_id: '...',
  referencia_cliente: 'REF-001',
  ancho: 1000,
  alto: 500,
})

// Automáticamente:
// - pieza.codigo = "PIE-2026-00001"
// - pieza.qr_data = "https://tuapp.com/trace/PIE-2026-00001?pedido=PED-2026-0001"

// Crear fases de producción
await crearFasesProduccion(pieza.id)
// Crea 9 fases automáticamente
```

### Procesar OCR

```typescript
import { procesarDocumentoOCR } from '@/lib/services'

const documento = await procesarDocumentoOCR(
  cliente_id,
  'https://bucket.example.com/documento.pdf'
)

// documento.texto_extraido: texto completo extraído
// documento.datos_extraidos: referencias, cantidades, colores
// documento.estado: 'procesado' (esperando validación)
```

---

## Troubleshooting

### ❌ "SUPABASE_URL not found"
- Verifica que `.env.local` existe
- Comprueba que `NEXT_PUBLIC_SUPABASE_URL` está correcto
- Reinicia: Ctrl+C en terminal y `pnpm dev` again

### ❌ "No auth.users table"
- No has ejecutado el SQL de `DATABASE_SETUP.md`
- Abre SQL Editor de Supabase y ejecuta Step 2 y Step 3

### ❌ "Can't login"
- ¿Email confirmado en dashboard de Supabase? (en desarrollo tienes que hacerlo manual)
- Verifica contraseña

### ❌ "Permissions denied"
- RLS no habilitado
- Ejecuta Step 3 del `DATABASE_SETUP.md`

---

## Estructura de Carpetas Después del Setup

```
tu-proyecto/
├── .env.local              ← Variables de entorno
├── DATABASE_SETUP.md       ← SQL para ejecutar en Supabase
├── README_ERP.md           ← Documentación completa
├── SETUP.md                ← Este archivo
├── app/
│   ├── dashboard/
│   ├── auth/
│   ├── page.tsx
│   └── layout.tsx
├── lib/
│   ├── supabase/           ← Clientes
│   ├── services/           ← Lógica de negocio
│   └── types/              ← TypeScript types
└── pnpm-lock.yaml
```

---

## Próximas Acciones

Una vez completes el setup, puedes:

1. **Crear clientes** en el CRUD (fase 8 del roadmap)
2. **Crear presupuestos** en `/presupuestos/crear`
3. **Convertir a pedidos** desde presupuestos
4. **Gestionar producción** en panel de producción
5. **Generar albaranes** imprimibles

---

## Soporte Rápido

- **Documentación técnica:** `README_ERP.md`
- **SQL Schema:** `DATABASE_SETUP.md`
- **Tipos:** `lib/types/erp.ts`
- **Servicios:** `lib/services/index.ts`

---

**¡Listo para comenzar!** 🎉
