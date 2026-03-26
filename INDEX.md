# 📑 ÍNDICE DEL PROYECTO - FinePath ERP

## 🎯 DOCUMENTACIÓN (Empieza aquí)

### 1. **EXECUTIVE_SUMMARY.md** ⭐ AQUÍ PRIMERO
- Resumen en una página
- Qué se ha construido
- Stack tecnológico
- Capacidades empresariales

### 2. **SETUP.md**
- Guía paso a paso de 6 pasos
- Configuración de Supabase
- Variables de entorno
- Troubleshooting

### 3. **DATABASE_SETUP.md**
- SQL completo para ejecutar en Supabase
- Paso 2: Crear esquema (22 tablas)
- Paso 3: Habilitar RLS
- Paso 4: Verificación

### 4. **README_ERP.md**
- Documentación técnica completa
- Arquitectura de BD
- Uso de servicios
- Estructura del código

### 5. **PROGRESS.md**
- Resumen de lo completado
- Estadísticas del proyecto
- Próximas fases
- Roadmap

---

## 🔧 CÓDIGO BACKEND

### Servicios (lib/services/)

```
presupuestos.ts (250 líneas)
├── calcularLinea()           # Motor de cálculo individual
├── calcularPresupuesto()     # Totales de presupuesto
├── crearPresupuesto()        # Crear con líneas
└── Docstring: "Motor de tarifación real"

piezas.ts (270 líneas)
├── generarQRData()           # Genera URL con QR
├── crearPieza()              # Crea pieza + QR
├── crearFasesProduccion()    # 9 fases automáticas
├── obtenerTrazabilidad()     # Histórico completo
└── completarFase()           # Marca fase como hecha

ocr.ts (240 líneas)
├── extraerTextoOCR()         # Tesseract.js
├── parsearDatosOCR()         # Extrae referencias, colores
├── procesarDocumentoOCR()    # Flujo completo
├── validarYCrearPedidoDesdeOCR()
└── obtenerOCRPendientes()    # Bandeja de validación

documentos.ts (260 líneas)
├── crearAlbaran()            # Documento de entrega
├── obtenerDatosEtiquetaQR()  # Para imprimir
├── obtenerDatosAlbaranImprimible()
├── marcarAlbaranImpreso()    # Estado
└── marcarAlbaranEntregado()  # Con firma cliente

clientes.ts (255 líneas)
├── crearCliente()            # CRUD
├── listarClientes()          # Con filtros
├── obtenerReferenciasCliente()
├── cambiarTipoCliente()      # precliente → activo → recurrente
└── obtenerEstadisticasCliente()

catalogo.ts (385 líneas)
├── PRODUCTOS CRUD
├── COLORES CRUD
├── TRATAMIENTOS CRUD
├── ACABADOS CRUD
├── TARIFAS CRUD
└── obtenerCatalogoPrecio()   # Catálogo completo

supabase/client.ts            # Cliente browser
supabase/server.ts            # Cliente servidor
supabase/proxy.ts             # Session handling
supabase/hooks.ts             # Hooks React

index.ts                       # Exportaciones
```

### Tipos (lib/types/)

```
erp.ts (342 líneas)
├── Profile                   # Usuario
├── Cliente                   # Cliente con tipos
├── Producto, Color, Tratamiento, Acabado, Tarifa
├── Presupuesto, LineaPresupuesto
├── Pedido, Lote, Pieza, FaseProduccion
├── Albaran, LineaAlbaran
├── Pago, HistorialPagos
├── OCRDocumento
└── Secuencia

24 interfaces TypeScript completas
```

---

## 🎨 FRONTEND

### Páginas (app/dashboard/)

```
layout.tsx (183 líneas)
├── Sidebar con navegación
├── Header con fecha
├── Main content area
└── Menu items: Dashboard, Presupuestos, Pedidos, etc.

page.tsx (319 líneas) - Dashboard
├── 4 tarjetas de estadísticas
├── Presupuestos pendientes
├── Pedidos en producción
├── Piezas completadas hoy
└── Acciones rápidas

clientes/page.tsx (243 líneas)
├── Búsqueda y filtros
├── Tabla de clientes
├── Paginación
└── Acciones rápidas

catalogo/page.tsx (357 líneas)
├── 5 tabs: Productos, Colores, Tratamientos, Acabados, Tarifas
├── Tablas con datos
├── Botones para crear nuevos
└── Vistas con estado activo/inactivo
```

### Autenticación

```
auth/login/page.tsx            # Página de login
auth/sign-up/page.tsx          # Registro
auth/sign-up-success/page.tsx  # Confirmación
auth/error/page.tsx            # Manejo de errores

app/page.tsx                   # Redirección raíz
middleware.ts                  # Protección de rutas
```

### Componentes Usados

- shadcn/ui: Button, Card, Badge, Input, Table, Tabs, DropdownMenu
- Lucide React: 30+ iconos
- Tailwind CSS v4: Grid, Flexbox, Responsive

---

## ⚙️ CONFIGURACIÓN

```
package.json
├── Dependencies: Next.js 16, React 19.2, Supabase, Tesseract, QRCode
├── DevDependencies: TypeScript, Tailwind, PostCSS
└── Scripts: dev, build, start, lint

tsconfig.json                  # TypeScript config
next.config.mjs                # Next.js config
tailwind.config.js             # Tailwind v4
postcss.config.js              # PostCSS

.env.local (usuario crea)
├── NEXT_PUBLIC_SUPABASE_URL
├── NEXT_PUBLIC_SUPABASE_ANON_KEY
├── NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
├── SUPABASE_SERVICE_ROLE_KEY
└── NEXT_PUBLIC_APP_URL

middleware.ts                  # Sesiones y protección
lib/supabase/client.ts         # Cliente browser
lib/supabase/server.ts         # Cliente servidor
lib/supabase/proxy.ts          # Session proxy
lib/supabase/hooks.ts          # Hooks React
```

---

## 📦 BASE DE DATOS

### 22 Tablas PostgreSQL

**Datos Maestros**
1. profiles - Usuarios y roles
2. clientes - Cartera de clientes
3. productos - Tipos de pieza
4. colores - Catálogo de colores
5. tratamientos - Tipos de tratamientos
6. acabados - Combinaciones
7. tarifas - Precios y costes

**Referencias**
8. referencias_cliente - Códigos internos
9. secuencias - Numeración automática
10. capacidad_diaria - Disponibilidad

**Documentos**
11. presupuestos - Cotizaciones
12. lineas_presupuesto - Líneas con cálculo
13. pedidos - Órdenes
14. albaranes - Documentos de entrega
15. lineas_albaran - Ítems por albarán

**Producción**
16. lotes - Agrupaciones
17. piezas - Piezas con QR
18. fases_produccion - 9 fases por pieza

**Pagos**
19. pagos - Registros
20. historial_pagos - Auditoría

**OCR**
21. ocr_documentos - Documentos escaneados

**Notificaciones**
22. secuencias - Numeración

---

## 🚀 FLUJOS DE USUARIO

### Crear Presupuesto
```
Dashboard → Nuevo Presupuesto
  → Seleccionar Cliente
  → Agregar Líneas
    → Modo (m²/pieza)
    → Dimensiones
    → Caras seleccionadas
    → Tarifa
    → Precio Mínimo
    → Suplemento
  → Aplicar Descuento/IVA
  → Enviar a Cliente
```

### Crear Pedido desde Presupuesto
```
Presupuesto (aceptado)
  → Convertir a Pedido
  → Sistema crea Piezas automáticas
  → Asigna a Lotes por color
  → Crea 9 Fases de producción
  → Genera Códigos QR únicos
```

### Procesar OCR
```
Subir Documento (imagen/PDF)
  → Tesseract extrae texto
  → Sistema parsea:
    - Referencias cliente
    - Cantidades
    - Colores (RAL, NCS)
    - Dimensiones
  → Bandeja de Validación
  → Usuario revisa y confirma
  → Crear Pedido automáticamente
```

### Generar Albarán
```
Pedido (en_produccion → terminado)
  → Crear Albarán
  → Sistema agrupa piezas
  → Generar vista imprimible
  → Imprimir etiqueta QR + albarán
  → Marcar como entregado
```

---

## 📋 VERIFICACIÓN RÁPIDA

Para verificar que todo está funcional:

### ✅ Backend
1. `pnpm dev` - Sin errores
2. POST `/api/presupuestos` - Crea presupuesto
3. GET `/api/clientes` - Lista clientes
4. BD Supabase - 22 tablas visibles

### ✅ Frontend
1. `/` → Redirige a login
2. `/auth/login` → Formulario funcional
3. `/auth/sign-up` → Registro funcional
4. `/dashboard` → Dashboard con datos
5. `/dashboard/clientes` → Listado de clientes
6. `/dashboard/catalogo` → Catálogos

### ✅ Lógica
1. `calcularLinea()` - Devuelve superficie m²
2. `crearPieza()` - Genera QR unique
3. `procesarDocumentoOCR()` - Extrae datos
4. `crearPresupuesto()` - Calcula totales

---

## 🎓 Cómo Entender el Código

### Para Desarrolladores React
- `/app/dashboard/` - Componentes de UI
- `lib/hooks.ts` - Hooks personalizados
- `lib/types/erp.ts` - Tipos para data

### Para Desarrolladores Backend
- `lib/services/` - Toda la lógica
- `lib/types/erp.ts` - Contratos de datos
- `DATABASE_SETUP.md` - Schema de BD

### Para Product Managers
- `EXECUTIVE_SUMMARY.md` - Capacidades
- `README_ERP.md` - Flujos de usuario
- Documentación inline en servicios

---

## 🔗 Navegación Rápida

| Necesito... | Voy a... |
|-------------|----------|
| Empezar rápido | SETUP.md |
| Entender qué se hizo | EXECUTIVE_SUMMARY.md |
| Configurar BD | DATABASE_SETUP.md |
| Documentación técnica | README_ERP.md |
| Ver el progreso | PROGRESS.md |
| Cambiar presupuesto | lib/services/presupuestos.ts |
| Agregar tabla | DATABASE_SETUP.md + lib/types/erp.ts |
| Crear UI | app/dashboard/ (copiar componente existente) |

---

## 📞 Soporte por Categoría

**No puedo conectar a BD**
→ Verificar SETUP.md Paso 2 y 3
→ Verificar .env.local
→ Revisar DATABASE_SETUP.md

**Cálculos incorrectos**
→ Revisar lib/services/presupuestos.ts
→ Tests en CalculoLineaInput interface

**Necesito agregar tabla**
→ DATABASE_SETUP.md (SQL)
→ lib/types/erp.ts (TypeScript)
→ lib/services/ (CRUD)

**Interfaz no funciona**
→ Revisar app/dashboard/
→ Comprobar componentes de shadcn/ui
→ Verificar servicios en lib/services/

---

**Índice versión**: 1.0  
**Última actualización**: Marzo 2026  
**Proyecto**: FinePath ERP 0.2.0

¡Navega con este índice para entender la estructura completa! 🗺️
