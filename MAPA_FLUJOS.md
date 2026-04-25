# Mapa de flujos — TURIVAL

Cómo se mueve un trabajo desde que entra hasta que sale, con todas las
ramificaciones reales del sistema. Pensado para entenderlo de un vistazo
y para detectar qué pieza tocar cuando algo no pasa de un estado a otro.

## Convenciones

- `→` paso secuencial.
- `┄┄` paso paralelo (no bloquea).
- `⟂` opcional.
- `🅢` requiere SQL ejecutado.
- `🅐` requiere admin / login.
- `📱` disponible también en versión móvil `/m`.
- `🤖` el asistente puede dispararlo.
- `🔓` ruta pública (sin login).

---

## Flujo 1 — De cliente a entrega (camino feliz)

```
[CLIENTE pide]
       │
       ▼
[1. CREAR PRESUPUESTO]   ← /presupuestos/nuevo  o  🤖 asistente voz/foto
   ├─ tipo manual / personalizada / referencia recurrente
   ├─ procesos marcados por defecto (Mario deselecciona)
   ├─ guarda en `presupuestos` + `lineas_presupuesto`
   └─ estado: BORRADOR
       │
       ▼ (Mario revisa y envía)
[2. ENVIAR PRESUPUESTO]  ← /presupuestos/[id]
   ├─ Email (mailto o SMTP IONOS)        ┄┄  WhatsApp
   ├─ Link público /p/[token] 🔓
   ⟂  Reservar horas tentativas en Gantt → tareas con `tentativa=true` 🅢034
   └─ estado: ENVIADO
       │
       ▼ (cliente acepta)
[3. CONVERTIR EN PEDIDO]  ← botón "Convertir a pedido"
   ├─ pide ubicación inicial
   ├─ chain: convertirPresupuestoAPedido → confirmarPedido → arrancarProduccion
   ├─ si había reserva tentativa: la libera (script en cola)
   ├─ crea `pedidos`, `lineas_pedido`, `piezas`, `tareas_produccion`
   └─ estado pedido: EN_PRODUCCION
       │
       ▼
[4. PLANIFICAR]  ← /planificador
   ├─ autogenerar (rango auto-extensible 14→30→90d)
   ├─ banner "X pedidos sin reservar hueco" → botón Reservar hueco por pedido
   ├─ drag&drop manual (snap proporcional al zoom)
   └─ ⟂ reorganizar Gantt para priorizar PED-X
       │
       ▼
[5. ETIQUETAR]  ← /etiquetas/pedido/[id]
   ├─ selector de impresora (Zebra, Dymo, Brother, Avery)
   ├─ QR / Code128 / texto solo
   └─ imprimir (paso paralelo a producción)
       │
       ▼
[6. PRODUCIR]  ← /produccion (kanban) ó 📱 /m/operario/[id]
   ├─ operario ficha entrada
   ├─ inicia tarea → en_progreso
   ├─ completa → en_secado (si proceso requiere) o completada
   ├─ piezas atraviesan procesos en orden (LIJADO → FONDO → ... → PICKING)
   └─ trazabilidad pública /t/[qr] 🔓
       │
       ▼
[7. ALBARÁN]  ← /albaranes
   ├─ generar entrega parcial o total
   └─ imprimir
       │
       ▼
[8. ENTREGA + COBRO]
   └─ pedido COMPLETADO
```

---

## Flujo 2 — Entra una hoja en papel (clientes recurrentes) 🤖

```
[Hoja de pedido en papel]
       │
       ▼
[Foto desde /dashboard "Presupuesto rápido" → cámara]
       │
       ▼
[Pre-procesado: redimensión + escala grises + contraste 1.5]
       │
       ▼
[Tesseract.js OCR en español, 100% local en navegador]
       │
       ▼
[Detectar "CLIENTE: X" en cabecera → aplicar a todas las líneas]
       │
       ▼
[Dividir por saltos de línea → cada una al parser]
       │
       ▼
[Parser asocia palabras a BD via diccionario dinámico]
   ├─ cliente conocido?     → cliente_id
   ├─ es referencia_cliente? → referencia_id (hereda dimensiones, procesos, color)
   ├─ "tablon 200x50"?       → categoría + dims
   ├─ "RAL 9003"?           → material_lacado_id
   ├─ "doble fondeado"?     → procesos_codigos: [..., FONDEADO_2]
   └─ ¿falta info?          → línea PENDIENTE REVISAR (precio 0)
       │
       ▼
[Crear presupuesto v2 borrador]
   └─ obs.internas: "[Asistente] origen: ...  / X líneas pendientes"
       │
       ▼
[Mario revisa /presupuestos/[id]]
   └─ completa pendientes y/o lo envía al cliente
```

---

## Flujo 3 — Decir un presupuesto por voz 🤖

```
[Mario en oficina con manos libres]
       │
       ▼
[Click "Presupuesto rápido" → micro]
       │
       ▼
[Web Speech API transcribe en directo]
       │ "presupuesto para TURMALINA, puerta cocina, RAL 9003, doble fondeado"
       ▼
[Parser detecta]
   ├─ cliente: TURMALINA (encontrado en `clientes`)
   ├─ referencia "puerta cocina" del cliente → reusa todo
   └─ procesos extra: doble fondeado
       │
       ▼
[Crear presupuesto + (opcional) "guardar como referencia recurrente"]
       │
       ▼
[Asistente lee resultado en voz: "presupuesto PRES-26-X creado..."]
```

---

## Flujo 4 — Operario en taller 📱

```
[/m] (selector operario, sin login)
       │
       ▼
[/m/operario/[id]]
       │
       ▼
[Estado actual: fuera / dentro / en pausa]
       │
       ├─ Botón Entrada (verde gigante)
       ├─ Botón Pausa / Reanudar
       ├─ Botón Salida
       │
       ▼
[Ver tareas hoy + próximos días, ordenadas por hora]
       │
       ▼
[Pulsar tarea → bottom-sheet]
       │
       ├─ pendiente/en_cola → Iniciar (requiere fichado dentro)
       ├─ en_progreso       → Completar
       └─ en_secado         → Forzar seco
```

---

## Flujo 5 — Reorganizar Gantt para meter pedido urgente

```
[Llega pedido urgente PED-X]
       │
       ▼
[/pedidos/X → "Reorganizar Gantt"]   o   🤖 "reorganiza priorizando PED-X"
       │
       ▼
[Motor calcula propuesta]
   ├─ tareas de PED-X adelantadas (verde)
   └─ tareas de pedidos holgados >2d desplazadas (ámbar)
   ├─ respeta SECUENCIA de procesos por pieza
   └─ respeta ROL de operario compatible
       │
       ▼
[Dialog muestra "adelanto Xd Yh / desplazamiento Zd Wh"]
       │
       ▼
[Mario confirma → Promise.all de updates]
       │
       ▼
[/planificador refresca con nueva planificación]
```

---

## Flujo 6 — Cliente externo sin login 🔓

### 6a. Acceso a un presupuesto concreto
```
[Email/WhatsApp con link]
       │
       ▼
[/p/[token]] — vista presupuesto imprimible + botón "aceptar"
```

### 6b. Acceso al portal con todos los pedidos del cliente
```
[Mario manda /c/[token]]   (token = share_token de cualquier presupuesto suyo)
       │
       ▼
[/c/[token]]
   ├─ todos los pedidos del cliente con estado y fecha entrega
   └─ todos los presupuestos con link al PDF
```

### 6c. Trazabilidad pieza por QR
```
[Cliente escanea QR de la etiqueta]
       │
       ▼
[/t/[qr]] → estado de esa pieza concreta
```

---

## Flujo 7 — Auth con roles 🅐 🅢035

```
[Mario crea usuario en Supabase Auth Dashboard]
       │
       ▼
[Mario va a /configuracion/usuarios]
       │
       ▼
[Asignar rol]
   ├─ admin     → acceso a todo (modulos_permitidos = ['*'])
   ├─ operario  → solo módulos seleccionados (checklist)
   └─ cliente   → vista /cliente con sus pedidos (email vinculado)
       │
       ▼
[Sidebar filtra entradas según `usuario_perfiles.modulos_permitidos`]
```

---

## Flujo 8 — Notificaciones (8 tipos al vuelo)

```
[Cada 90 segundos]
       │
       ▼
[obtenerResumenNotificaciones() → 5 queries Supabase]
       │
       ├─ pedido_urgente:        entrega < 3d en producción
       ├─ tarea_demora:          >2× tiempo estimado en progreso
       ├─ pieza_lista_secado:    secado terminado
       ├─ presupuesto_pendiente: enviado +7d sin respuesta
       ├─ fecha_sin_reservar:    pedido con plazo pero tareas sin planificar
       ├─ solape_operario:       dos tareas del mismo operario que se pisan
       ├─ dia_holgado:           <25% ocupación → oportunidad comercial
       └─ retraso_planificado:   (futuro)
       │
       ▼
[Campanita header + badge rojo si hay alta]
[Panel completo /notificaciones con secciones por tipo]
```

---

## Capas técnicas (referencia rápida)

```
┌─────────────────────────────────────────────────────┐
│  UI — app/* (rutas Next.js App Router)              │
│  ↓ usa                                              │
│  Components — components/*                          │
│  ↓ usa                                              │
│  Server Actions — lib/actions/*                     │
│  ↓ envuelve                                         │
│  Services — lib/services/*  (lee/escribe Supabase)  │
│  ↓ usa para cálculos                                │
│  Motor puro — lib/motor/*  (sin Supabase, testable) │
│  ↓                                                  │
│  Supabase (PostgreSQL + Auth + Storage)             │
│  scripts/*.sql para migraciones                     │
└─────────────────────────────────────────────────────┘
```

### Motor puro testeable
- `motor/planificador.ts` — Gantt, autogenerar, violaciones
- `motor/reorganizador.ts` — propuestas para priorizar pedido
- `motor/coste.ts` — cálculo de precio
- `motor/superficie.ts` — m², ml, pieza
- `motor/etiquetas.ts` — código compacto QR/Code128
- `motor/asistente-voz/parser.ts` + `diccionario.ts` — comandos sin LLM
- `motor/procesos-defaults.ts` — orden y tiempos por defecto

Tests: `pnpm test` ejecuta `tests/motor-planificador.test.mjs` (8 casos).

---

## Estados clave

| Entidad | Estados |
|---|---|
| Presupuesto | borrador → enviado → aceptado / rechazado / caducado |
| Pedido | borrador → en_produccion → completado / cancelado |
| Tarea | pendiente → en_cola → en_progreso → en_secado → completada / anulada |
| Pieza | pendiente → en_proceso → completada |
| Operario (fichaje) | fuera → dentro → en_pausa → dentro → fuera |
| Tarea tentativa | tentativa=true (difuminada) → tentativa=false (firme al confirmar pedido) |

---

## Donde tocar si algo no avanza

- **Presupuesto no genera piezas** → confirmarPedido() en `lib/services/pedidos.ts` (camino dual A/B)
- **Tareas no aparecen en Gantt** → `obtenerVistaPlanificador` en `lib/services/planificador.ts`
- **Reorganizar no propone nada** → `lib/motor/reorganizador.ts` (heurística esDesplazable)
- **OCR no detecta cliente** → `detectarClienteEnCabecera` en `components/asistente/asistente-voz.tsx`
- **Voz dice "no entendí"** → `parsearComandoVoz` en `lib/motor/asistente-voz/parser.ts` muestra qué pista falla
- **Sidebar no muestra módulo** → `MENU_ITEMS.moduloSlug` debe coincidir con `usuario_perfiles.modulos_permitidos`
- **Notificaciones falsas** → `lib/services/notificaciones.ts` umbrales (DIAS_URGENTE=3, etc.)

---

*Documento vivo. Actualizar cuando se añada un flujo nuevo.*
