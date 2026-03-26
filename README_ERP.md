# ERP/CRM FinePath - Sistema Empresarial para Lacados

## 📋 Descripción General

**FinePath** es una solución ERP/CRM completa y empresarial para empresas de lacados y acabados. Prioriza modelo de datos robusto, lógica de negocio real, trazabilidad completa, y documentos imprimibles.

### Stack Tecnológico
- **Frontend:** Next.js 16 + React 19.2 + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth)
- **Funcionalidades especializadas:** OCR (Tesseract.js), QR (qrcode), Impresión térmica

---

## 🚀 Inicio Rápido

### 1. Setup de Supabase (OBLIGATORIO)

Antes de ejecutar la app, debes crear la BD en Supabase:

**Abre `DATABASE_SETUP.md`** para las instrucciones completas de SQL.

**Pasos:**
1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Copia y ejecuta el SQL en SQL Editor
4. Los 22 scripts creados automáticamente activarán RLS

### 2. Instalar Dependencias

```bash
pnpm install
```

Se instalarán automáticamente:
- `@supabase/supabase-js` - Cliente BD
- `@supabase/ssr` - Session management
- `tesseract.js` - OCR gratuito
- `qrcode` - Generación de códigos QR

### 3. Variables de Entorno

Crea `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback

# Para producción
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# URL de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Ejecutar en Desarrollo

```bash
pnpm dev
```

La app estará disponible en `http://localhost:3000`

---

## 📁 Estructura del Proyecto

### Arquitectura Base de Datos (22 Tablas)

**Datos Maestros:**
- `profiles` - Usuarios y roles (admin, usuario, operario)
- `clientes` - Clientes con estados: precliente, cliente_activo, cliente_recurrente
- `productos` - Tipos de piezas/artículos
- `colores` - Catálogo de colores RAL, NCS, referencias
- `tratamientos` - Tipos de tratamientos (folio, fondo, etc.)
- `acabados` - Combinaciones color + tratamiento
- `tarifas` - Precios por m² o por pieza, con mínimos y suplementos

**Referencias y Configuración:**
- `referencias_cliente` - Códigos internos por cliente (para OCR)
- `secuencias` - Numeración de presupuestos, pedidos, piezas, lotes, albaranes
- `capacidad_diaria` - Disponibilidad de producción por día

**Documentos Comerciales:**
- `presupuestos` - Cotizaciones con líneas y cálculo de margen
- `lineas_presupuesto` - Líneas con cálculo de superficie, precio mínimo, suplementos
- `pedidos` - Órdenes de trabajo (origen: presupuesto, OCR, manual)
- `albaranes` - Documentos de entrega
- `lineas_albaran` - Ítems por albarán

**Producción y Trazabilidad:**
- `lotes` - Agrupaciones de piezas por color/tratamiento
- `piezas` - Piezas individuales con código único, QR y trazabilidad
- `fases_produccion` - Checklist de fases: recepción → lijado → fondo → lacado → secado → manipulado → terminación → empaquetado → listo_entrega

**Pagos y Facturación:**
- `pagos` - Registros de pagos
- `historial_pagos` - Auditoría de cambios

**OCR y Integración:**
- `ocr_documentos` - Documentos escaneados pendientes de validación
- `notificaciones` - Sistema de notificaciones (opcional)

### Carpetas del Proyecto

```
app/
├── dashboard/               # Panel principal
│   ├── layout.tsx          # Layout con navegación
│   └── page.tsx            # Dashboard con estadísticas
├── presupuestos/           # Gestión de presupuestos
├── pedidos/                # Gestión de pedidos
├── produccion/             # Control de piezas y fases
├── albaranes/              # Documentos imprimibles
├── trazabilidad/           # Página pública de trazabilidad QR
├── auth/                   # Login, sign-up, callbacks
└── page.tsx                # Página raíz (redirección)

lib/
├── supabase/
│   ├── client.ts           # Cliente Supabase (browser)
│   ├── server.ts           # Cliente Supabase (server)
│   ├── proxy.ts            # Session handling
│   └── hooks.ts            # Hooks personalizados
├── services/
│   ├── presupuestos.ts     # Motor de cálculo de presupuestos
│   ├── piezas.ts           # Gestión de piezas y QR
│   ├── ocr.ts              # OCR y procesamiento
│   ├── documentos.ts       # Albaranes y etiquetas
│   └── index.ts            # Exportaciones
└── types/
    └── erp.ts              # Types TypeScript completos

scripts/
├── 001_create_schema.sql   # Creación de tablas
├── 002_create_rls.sql      # Row Level Security
└── 003_seed_data.sql       # Datos de ejemplo (opcional)

DATABASE_SETUP.md            # Instrucciones SQL completas
```

---

## 🎯 Motor de Cálculo de Presupuestos

Implementado en `lib/services/presupuestos.ts`

### Características Principales

1. **Cálculo de Superficie por Caras Seleccionadas**
   - Cara frontal y trasera (cara_frontal, cara_trasera)
   - Cantos (canto_superior, canto_inferior, canto_izquierdo, canto_derecho)
   - Cálculo automático en m²

2. **Modos de Precio**
   - Por m²: `precio_m2 × superficie_m2`
   - Por pieza: `precio_pieza × cantidad`

3. **Precio Mínimo por Línea**
   - Si el cálculo es menor que `precio_minimo`, se aplica el mínimo

4. **Suplementos Manuales**
   - Suma adicional configurable por línea
   - Ideal para extras no anticipados

5. **Totales Automáticos**
   - Subtotal de líneas
   - Descuento por porcentaje o importe
   - IVA configurable (default: 21%)
   - Total final

### Ejemplo de Uso

```typescript
import { crearPresupuesto, calcularLinea } from '@/lib/services'

// Opción 1: Calcular una línea
const calculo = calcularLinea({
  modo_precio: 'm2',
  cantidad: 2,
  ancho: 1000,     // mm
  alto: 500,       // mm
  cara_frontal: true,
  cara_trasera: true,
  canto_superior: true,
  canto_inferior: true,
  canto_izquierdo: false,
  canto_derecho: false,
  precio_m2: 50,
  precio_minimo: 100,
  suplemento_manual: 20,
})

// calculo.superficie_m2: 3.2004 m²
// calculo.precio_unitario: 160.02
// calculo.total_linea: 180.02

// Opción 2: Crear presupuesto completo
const { presupuesto, lineas } = await crearPresupuesto(
  cliente_id,
  [{ /* líneas */ }],
  'Observaciones comerciales'
)
```

---

## 🏷️ Trazabilidad y QR

### Flujo Completo

1. **Crear Pieza**
   ```typescript
   const pieza = await crearPieza({
     pedido_id,
     cliente_id,
     referencia_cliente: 'REF-001',
     ancho: 1000,
     alto: 500,
     // ...
   })
   // Genera automáticamente:
   // - Código único: PIE-2026-00001
   // - QR Data: https://tuapp.com/trace/PIE-2026-00001?pedido=PED-2026-0001&lote=LOT-2026-0001
   ```

2. **Fases de Producción Automáticas**
   ```typescript
   await crearFasesProduccion(pieza_id)
   // Crea 9 fases: recepción, lijado, fondo, lacado, secado, manipulado, terminación, empaquetado, listo_entrega
   ```

3. **Marcar Fases Completadas**
   ```typescript
   await completarFase(fase_id, operario_id, duracion_minutos, observaciones)
   ```

4. **Consultar Trazabilidad (Página Pública)**
   - URL: `/trace/PIE-2026-00001`
   - Muestra: cliente, pedido, lote, estado actual, fases completadas

---

## 📄 Documentos Imprimibles

### Etiquetas QR

Para imprimir en etiquetas de 50x50mm (térmica):

```typescript
import QRCode from 'qrcode'
import { obtenerDatosEtiquetaQR } from '@/lib/services'

const datos = await obtenerDatosEtiquetaQR(pieza_id)

// Generar QR
await QRCode.toFile(
  'etiqueta.png',
  datos.qr_data,
  { width: 200 }
)
```

### Albaranes

Vista limpia lista para impresora térmica de 80mm:

```typescript
import { obtenerDatosAlbaranImprimible, marcarAlbaranImpreso } from '@/lib/services'

const datos = await obtenerDatosAlbaranImprimible(albaran_id)
// Renderizar en componente <AlbaranPrintable data={datos} />
await marcarAlbaranImpreso(albaran_id)
```

---

## 📸 OCR para Pedidos Recurrentes

### Flujo

1. **Subir Imagen**
   ```typescript
   const documento = await procesarDocumentoOCR(cliente_id, archivo_url)
   // Extrae texto automáticamente con Tesseract.js
   ```

2. **Validar en Interfaz**
   - Bandeja de OCR pendientes en `/ocr`
   - Usuario revisa y corrige datos extraídos

3. **Crear Pedido desde OCR**
   ```typescript
   const pedido = await validarYCrearPedidoDesdeOCR(
     ocr_id,
     cliente_id,
     lineas_confirmadas_por_usuario
   )
   ```

---

## 👥 Roles y Permisos (RLS)

**Admins:**
- Acceso total a todo

**Usuarios:**
- Ver clientes y presupuestos propios
- Crear presupuestos y pedidos
- Ver albaranes

**Operarios:**
- Ver piezas asignadas
- Actualizar estado de fases
- Consultar trazabilidad

---

## 📊 Próximos Pasos Implementados en el Plan

### Phase 2: Interfaces de Presupuestos
- Listado de presupuestos con filtros
- Crear/editar presupuesto
- Cálculo dinámico en UI
- Vista previa imprimible

### Phase 3: Gestión de Pedidos
- Convertir presupuesto a pedido
- Listar pedidos con estado
- Asignar piezas a lotes

### Phase 4: Producción
- Panel de producción por fase
- Actualizar estado de piezas
- Gráfico de capacidad diaria

### Phase 5: Albaranes
- Crear albarán desde pedido
- Vista previa imprimible
- Generar PDF

### Phase 6: Trazabilidad Pública
- Página pública `/trace/:codigo_pieza`
- Mostrar historial de fases
- Código QR escaneado

### Phase 7: OCR
- Interfaz de carga de documentos
- Bandeja de validación
- Crear pedidos desde OCR

### Phase 8: Clientes
- CRUD de clientes
- Referencias por cliente
- Historial de pedidos

### Phase 9: Informes
- Ventas por periodo
- Producción completada
- KPIs de margen

---

## 🔒 Seguridad

- ✅ RLS habilitado en todas las tablas
- ✅ Autenticación nativa de Supabase
- ✅ Roles: admin, usuario, operario
- ✅ Sesiones HTTPS-only
- ✅ Validación de entrada (Zod)

---

## 📞 Soporte

- Documentación SQL: `DATABASE_SETUP.md`
- Tipos completos: `lib/types/erp.ts`
- Servicios: `lib/services/`

---

**Versión:** 1.0.0  
**Última actualización:** Marzo 2026
