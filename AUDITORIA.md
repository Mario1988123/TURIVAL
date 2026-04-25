# Auditoría TURIVAL — 25-abr-2026

Estado del proyecto al cierre de la sesión iterativa con Mario. Pensado
para retomar mañana sabiendo qué está sólido, qué está frágil y qué
falta cerrar.

## Veredicto general

🟢 **La columna vertebral funciona end-to-end** desde presupuesto hasta
albarán: capas 1–7 cerradas, capa 8 (margen real) en uso, capa 9
(asistente IA local) operativa.

🟡 **Hay piezas a medio camino** que no rompen producción pero conviene
terminar: reservas tentativas (UI lista, backend creado pero el flujo
"convertir a pedido" no las promueve aún), bot de Slack/Telegram (no
hay), backups automáticos (no hay).

🔴 **Frágil**: cualquier cambio de schema requiere SQL manual de Mario
(no hay CI ni migrations runner), sin tests más allá del motor
planificador, sin observabilidad (errores solo aparecen en consola
del navegador).

---

## Estado por capa

### Capa 1 — Clientes ✅
- CRUD completo con paginación
- Búsqueda por razón social / nombre comercial / CIF
- Estadísticas por cliente (total facturado, número pedidos)
- Sección "Piezas recurrentes" (`referencias_cliente`) clave para OCR
- **Hueco**: el campo `email` no es obligatorio pero el portal cliente
  con login (`/cliente`) lo necesita para vincular usuario → cliente.

### Capa 2 — Catálogo ✅
- Productos, materiales (lacado/fondo), tarifas, tratamientos
- Categorías de pieza con procesos por defecto
- Selector visual de color con muestras
- **Hueco**: tarifas siguen haciendo match por nombre, no por FK. Si
  Mario renombra un color, las tarifas dejan de aplicar.

### Capa 3 — Presupuestos ✅
- Único flujo `/presupuestos/nuevo` (v2, el clásico ya redirige)
- Líneas tipo: referencia, personalizada, manual
- Procesos marcados por defecto (Mario deselecciona)
- Botón "Recomendar fecha" con simulador
- Botón "Reservar horas" → tareas tentativas en Gantt
- Email (mailto + SMTP IONOS si configurado), WhatsApp, link público
- **Hueco**: SMTP env vars sin configurar todavía.

### Capa 4 — Pedidos ✅
- Conversión presupuesto → pedido en cadena (un click)
- Estado borrador eliminado del flujo de usuario
- Una tarea por línea (no por pieza)
- Albarán + etiquetas accesibles desde detalle
- Botón "Reorganizar Gantt" para priorizar
- **Hueco**: conversión no promueve aún las tareas tentativas previas;
  las elimina y crea firmes nuevas. Funciona pero no es óptimo.

### Capa 5 — Producción ✅
- Kanban de tareas
- Vista móvil `/m/operario/[id]` con dialog de tarea
- Mezcla y consumo real con decremento de stock
- Trazabilidad pública por QR en `/t/[qr]`
- Etiquetas imprimibles con QR proporcional + selector de impresora

### Capa 6 — Planificador (Gantt) ✅
- Motor puro `lib/motor/planificador.ts` con tests
- Autogenerar con rango auto-extensible (cap 90d)
- Drag & drop con snap proporcional al zoom (5–60 min)
- Modal día ampliado con doble vista (Gantt 15/30 min + lista)
- Banners de violaciones, operarios parados, fechas sin reservar
- **Reorganizador automático** que adelanta un pedido desplazando holgados
- Pausa por operario, descanso global del taller
- Pool "sin planificar" con patrón rayado distintivo

### Capa 7 — Albaranes ✅
- Generación + impresión
- FK reparada con script 032 (Mario debe ejecutar si no lo hizo)

### Capa 8 — Margen real ✅
- Informe `/informes/margen-real` y `/informes/coste-pieza`
- Compara estimado vs real con merma %

### Capa 9 — Asistente local sin IA ✅
- Voz (Web Speech API) + texto + foto OCR (Tesseract.js)
- Diccionario dinámico desde clientes/categorías/materiales/referencias
- Parser que entiende sinónimos (fondo/fondear, doble fondeado, etc.)
- Crea presupuestos, añade líneas, lista urgentes, reorganiza Gantt
- Crea cliente al vuelo si no existe
- Lectura de respuesta por voz (toggle)
- Guardar línea como referencia recurrente

---

## SQL Scripts

| Script | Estado | Notas |
|---|---|---|
| 001-029 | ✅ Ejecutado |  |
| 030-031 | ✅ Ejecutado |  |
| 032 fix FK albaranes_pedido | ⚠️ Pendiente | Mario debe ejecutar; hay workaround JS |
| 033 reset pedidos/presupuestos | 🟡 Bajo demanda | Cuando Mario quiera limpiar pruebas |
| 034 tareas_tentativas | ✅ Ejecutado | Confirmado por Mario |
| 035 auth_roles_y_permisos | ✅ Ejecutado | Confirmado por Mario |

**Pendiente Mario**: ejecutar 032 si aún no lo hizo (no urgente, hay JS workaround).

---

## Auth y permisos

🟢 Sistema operativo:
- Tabla `usuario_perfiles` con rol (admin/operario/cliente) y `modulos_permitidos[]`.
- Funciones SQL: `obtener_perfil_actual()`, `asignar_rol_usuario()`, `listar_perfiles_admin()`.
- UI `/configuracion/usuarios` con dialog de asignar rol.
- Sidebar filtra automáticamente.

🟡 Configurar:
- Mario debe insertar la fila admin inicial en `usuario_perfiles` (snippet en script 035 línea ~166).
- Si la tabla aún no tiene admin, el sidebar se muestra entero (modo legado para no romper nada).

---

## Cobertura de tests

🟡 Solo `tests/motor-planificador.test.mjs` (8 casos, runner nativo de Node).

**Sin cobertura**:
- `motor/coste.ts` (cálculo de precio)
- `motor/superficie.ts`
- `motor/reorganizador.ts` (heurística clave, sin tests)
- `motor/asistente-voz/parser.ts`
- Servicios y server actions (necesitarían mock Supabase)

---

## Observabilidad

🔴 Cero. Ni logs centralizados, ni Sentry, ni métricas. Los errores van a:
- Console del navegador (no recoge nadie)
- Toast rojo al usuario
- Logs de Vercel (los conserva 4h en plan free)

**Recomendación corto plazo**: cuando salgas a producción real con
varios usuarios, instalar Sentry o BetterStack (free tier) y añadirle
un wrapper a las server actions.

---

## Backups

🔴 Solo backups automáticos de Supabase (plan free = 7 días).

**Recomendación**: cuando entres en producción real, programar un
`pg_dump` semanal a un bucket S3 propio.

---

## Performance

🟢 Adecuado para taller de Mario:
- Pool de clientes hasta 5.000 sin paginar
- Gantt rinde bien con ~200 tareas en pantalla
- OCR ~5–15s por foto (Tesseract.js cliente, depende de hardware)
- Diccionario del asistente cachea 5 min en memoria

🟡 Cuando llegues a 50.000+ piezas:
- `referencias_cliente` se carga entera al abrir el asistente
- `notificaciones.ts` hace 5 queries cada 90s desde la campanita
- `tareas_produccion` sin partition para histórico viejo

---

## Seguridad

🟢 Bien:
- Supabase RLS activo en tablas sensibles (script 002).
- Server actions usan `@/lib/supabase/server` con `auth.getUser()`.
- Tokens públicos para `/p/[token]`, `/t/[qr]`, `/c/[token]` no son
  predecibles (UUID v4 generados en BD).

🟡 A mejorar:
- Rol `cliente` requiere email match exacto contra `clientes.email`
  para acceder a `/cliente`. Mejor usar `cliente_id` como FK directa.
- `/m/operario/[id]` no requiere PIN ni login. Si la tablet del taller
  cae en malas manos, se pueden falsificar fichajes.
- API de Tesseract.js corre en cliente — la imagen NUNCA sale del
  navegador, así que privacidad ✅.

🔴 No hecho:
- Rate limiting en server actions (ej. crear 1.000 presupuestos en bucle).
- Auditoría de quién cambió qué (no hay tabla `audit_log`).

---

## Frontend warnings actuales

```
✅ tsc --noEmit pasa sin errores
✅ pnpm test 8/8 verde
🟡 ESLint no auditado en esta sesión (no se ha pasado lint manual)
```

---

## Pendientes vivos (priorizados)

### Bloqueantes mañana cuando revises Gantt
1. Confirmar que el rango auto-extensible (cap 90d) funciona en preview con datos reales.
2. Probar el dialog "Reorganizar Gantt" con un pedido urgente de verdad.
3. Verificar el modal del día ampliado en una jornada con muchas tareas.
4. Validar el snap proporcional con varios zoom (cambiando ANCHO_DIA_PX).

### Cosas pequeñas pendientes
- SMTP IONOS env vars (cuando Mario tenga las credenciales).
- Script 032 fix FK albaranes (no urgente).
- Borrar rama `CLAUDE-CODE` (Mario debe dar el OK).
- ESLint sweep.
- Lint de imports no usados en archivos grandes.

### Futuro medio plazo
- Backend que promueva tareas tentativas a firmes al convertir presupuesto.
- Reorganizar Gantt: que el operario pueda confirmar parcialmente (solo unas tareas).
- Notificaciones push (web push, no email) cuando hay alerta alta.
- Modo offline para operarios (PWA con service worker, sincroniza al reconectar).
- Multi-empresa (`empresa_id` + RLS por empresa) para convertir en SaaS.

### Futuro largo plazo
- Backups automáticos a S3 propio.
- Sentry / observabilidad.
- Tests de integración con mock Supabase.
- Chatbot Slack/Telegram con webhook (avisos de pedidos urgentes a Mario).

---

## Riesgos identificados

1. **Pérdida de datos por reset accidental**. El script 033 reset es
   destructivo. Está bien documentado pero un click en mal momento se
   carga todo. Considerar añadir confirmación SQL adicional.

2. **Diccionario del asistente queda desactualizado**. Cachea 5 min en
   memoria. Si Mario añade un cliente nuevo, tiene que cerrar y abrir
   el panel del asistente. Aceptable hoy, problemático con varios
   admins.

3. **OCR falla con letra manuscrita compleja**. Pre-procesado mejora
   bastante pero no es magia. Cuando una hoja viene escrita a mano y no
   cuadra, sale como línea PENDIENTE — Mario tiene que completar.

4. **Reorganización Gantt puede mover tareas en producción ya iniciadas**.
   El motor actual filtra por `inicio_planificado` pero no por estado.
   Tarea: añadir filtro `estado === 'pendiente' || 'en_cola'` antes de
   permitir desplazamiento.

5. **Multi-empresa pendiente** si quieres saltar a SaaS comercial.

---

## Métricas de la sesión

- **Commits totales esta tanda**: 13 desde `079bfb5` (selector impresora) hasta `8b9536d` (vista móvil + portal cliente).
- **Líneas de código añadidas**: ~6.000+
- **Líneas eliminadas**: ~4.400 (huérfanos)
- **Archivos nuevos en `/lib`**: 6 (services + actions + motor)
- **Rutas nuevas**:
  - `/m`, `/m/operario/[id]` (móvil operario)
  - `/c/[token]` (portal cliente sin login)
  - `/cliente` (portal cliente con login)
  - `/configuracion/usuarios`
  - `/notificaciones`
- **Componentes destacados**:
  - `AsistenteVoz` (~750 líneas)
  - `BotonReorganizarGantt`
  - `CampanitaNotificaciones`
  - `OperarioMovilCliente`
- **Scripts SQL nuevos**: 034 (tentativas) + 035 (auth roles).

---

*Auditoría redactada el 25-abr-2026 al cierre de la sesión.*
