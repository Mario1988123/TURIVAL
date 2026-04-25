# Guía de uso — TURIVAL

Manual para Mario y para cualquier persona que entre nueva al CRM.
Cubre el día a día completo: cómo crear un presupuesto, planificar
producción, gestionar fichajes, dar acceso a clientes, configurar el
asistente por voz y todo lo demás.

---

## 0. Acceso

- **URL preview Vercel**: `v0-crm-erp-saa-s-git-desarrollo-claude-vercomi.vercel.app`
- **Admin**: `mario.ortigueira@me.com` / `Mario.:123` (cámbiala al primer login real).
- **Login**: `/auth/login`
- **Si pierdes la contraseña**: Supabase Dashboard → Authentication → Users → reset password.

### Roles disponibles
| Rol | Vista | Cómo se da de alta |
|---|---|---|
| **admin** | Todo | Mario en `/configuracion/usuarios` con `modulos = ['*']` |
| **operario** | Solo módulos marcados | Mario crea perfil con checklist |
| **cliente** | Portal `/cliente` (login) o `/c/[token]` (sin login) | Email del cliente vinculado |

---

## 1. Crear un presupuesto — 4 maneras

### A. Manual desde `/presupuestos/nuevo`
1. Selecciona cliente (o crea uno).
2. Por cada línea: descripción, dimensiones, color (RAL), procesos.
3. Procesos vienen marcados por defecto — desmarca los que no apliquen.
4. Botón **Recomendar fecha** simula cuándo estaría listo.
5. Botón **Reservar horas (Gantt)** crea tareas tentativas (difuminadas) en el planificador.
6. Guarda.

### B. Por **voz** — el asistente lo crea solo
1. En `/dashboard`, pulsa **Presupuesto rápido → Voz**.
2. Habla: *"Presupuesto para TURMALINA, puerta cocina 60 por 80, RAL 9003, doble fondeado"*.
3. El asistente:
   - Busca el cliente.
   - Si tiene pieza guardada como referencia, la reutiliza.
   - Detecta dimensiones, RAL, procesos.
   - Crea presupuesto y te da el número.
4. Puedes confirmarlo en voz: el asistente lee el resultado.

### C. Por **foto** (OCR) — para hojas de papel de clientes recurrentes
1. **Presupuesto rápido → Foto / OCR** (en móvil abre la cámara).
2. El asistente lee la foto con Tesseract.js.
3. Si la hoja tiene `CLIENTE: TURMALINA` en cabecera, lo aplica a todas las líneas.
4. Cada línea de la hoja se procesa por separado (la primera crea presupuesto, el resto se añaden con "Anade…").
5. Lo que no detecte queda como **PENDIENTE REVISAR** sin precio. Revisa y completa.

> 💡 **Truco para que el OCR brille**: crea las piezas frecuentes del cliente como `referencias_cliente` (`/dashboard/clientes/[id]` → Piezas recurrentes) con el código que ELLOS escriben en sus hojas. Cuando llegue una foto con `PUERTA-A1 x 5`, la detectará y heredará dimensiones, procesos y color.

### D. A partir de **referencia recurrente**
- Cliente recurrente que pide siempre lo mismo.
- En `/presupuestos/nuevo`, al seleccionar el cliente aparecen sus referencias.
- Click → línea ya rellena.

---

## 2. Convertir presupuesto en pedido

### Una vez aceptado por el cliente
1. En `/presupuestos/[id]`, cambia estado a **aceptado**.
2. Botón **Convertir a pedido** abre dialog.
3. Selecciona ubicación inicial.
4. Pulsa **Pasar a producción** (botón grande). El sistema:
   - Crea pedido (PED-26-NNNN)
   - Crea piezas (PIE-26-NNNN, una por unidad de cada línea)
   - Crea tareas de producción según procesos
   - Cambia estado a **en_produccion**

> ⚠️ Si tenías reserva tentativa previa (botón "Reservar horas"), libérala antes de convertir o se duplican las tareas. El botón "Liberar" está al lado del de "Reservar horas".

---

## 3. Planificar producción

### `/planificador` — Gantt principal
- Vista por **operario / proceso / pedido** (selector arriba).
- **Drag&drop** para mover tareas. El snap se ajusta al zoom: 5/15/30/60 min.
- **Doble click** sobre una tarea → dialog detalle.
- **Click en cabecera de día** → modal ampliado con Gantt 15/30 min + lista detallada.

### Banners
- 🟠 **"X pedidos con fecha sin reservar"** → cada pedido tiene un botón **Reservar hueco** que llama a autogenerar para ese pedido concreto.
- 🟡 **"X presupuestos pendientes de aceptar"** → si llenas huecos antes, recalcular fechas cuando lleguen.
- 🟦 **"X operarios parados"** → carga <3h en próximos 3 días.

### Autogenerar
- Botón **Autogenerar** (estrellitas).
- Calcula propuesta. Si no caben todas las tareas en el rango pedido, **extiende automáticamente** (14→30→90 días).
- Confirma y aplica.

### Reorganizar para meter pedido urgente
1. En `/pedidos/[id]` del urgente, botón **Reorganizar Gantt** (ámbar).
2. El motor calcula:
   - Tareas adelantadas del pedido objetivo (verde)
   - Tareas desplazadas de pedidos holgados con holgura > 2 días (ámbar)
3. Confirmas → aplica.
4. Respeta secuencia de procesos y rol de operario.

---

## 4. Producción — taller

### Desde el ordenador: `/produccion`
- Kanban de tareas por estado: pendiente / en_progreso / en_secado / completada.
- Click iniciar / completar / mezcla.

### Desde móvil/tablet: `/m/operario/[id]` 📱
1. Operario abre `/m` en su móvil → selecciona su nombre.
2. Pantalla con su estado (fuera/dentro/en_pausa) y botones grandes:
   - **Entrada / Pausa / Reanudar / Salida** (fichaje).
3. Lista de tareas de hoy + próximos días.
4. Pulsa una tarea → dialog con info y botones:
   - **Iniciar tarea** (verde, requiere fichado dentro).
   - **Completar** (azul) cuando termina la parte manual.
   - **Forzar seco** si la pieza ya está seca antes de tiempo.
5. Las tareas tentativas (de presupuesto sin confirmar) aparecen con borde discontinuo y NO se pueden iniciar.

---

## 5. Etiquetas

### `/etiquetas/pedido/[id]`
1. Selecciona modelo de impresora (Zebra, Dymo, Brother, Avery — 9 presets).
2. O configura tamaño manual.
3. Tipo de código: QR (recomendado para clientes) / Code128 (lectores industriales) / Solo texto.
4. Imprimir.

### `/etiquetas/pieza/[id]`
- Para imprimir la etiqueta de una pieza concreta (desde el kanban).

---

## 6. Albaranes

1. `/albaranes` → **Nuevo**.
2. Selecciona pedido.
3. Marca piezas a entregar (parcial o total).
4. Genera (ALB-26-NNNN).
5. Imprimir.

---

## 7. Trazabilidad pública

- Cada pieza tiene un QR en su etiqueta.
- El cliente lo escanea → `/t/[qr]` → ve el estado de su pieza concreta sin login.

---

## 8. Asistente por voz / texto / foto 🤖

### Cómo abrirlo
- **Botón flotante azul** abajo-derecha (icono robot) — disponible en cualquier módulo.
- **Botón "Presupuesto rápido"** en el dashboard.

### Comandos que entiende

| Comando | Ejemplo |
|---|---|
| Crear presupuesto | *"Presupuesto para TURMALINA, tablón 200 por 50, RAL 9003, doble fondeado"* |
| Cliente recurrente | *"Para MAGAMA, puerta cocina"* (si existe esa referencia) |
| Cliente nuevo | *"Para Carpintería del Sur, panel 100×60 lacado RAL 9010"* (te ofrece crearlo) |
| Cliente varios | *"Cliente varios, listón 30 ml mate"* |
| Añadir línea | *"Anade tres zócalos 30 metros lineales"* (al último presupuesto creado) |
| Listar urgentes | *"Muéstrame pedidos urgentes"* / *"Qué va mal de plazo"* |
| Reorganizar | *"Reorganiza priorizando PED-26-0042"* |
| Cancelar | *"Cancela"* / *"Olvida eso"* |

### Voz vs texto vs foto

| Modo | Cómo se activa | Mejor para |
|---|---|---|
| **Voz** 🎤 | Botón micro | Manos libres, taller, cliente al teléfono |
| **Texto** ⌨️ | Caja de texto + Enter | Sitio ruidoso, copiar de email |
| **Foto** 📷 | Botón cámara | Hoja de pedido en papel del cliente |

### Cuando no entiende algo
El asistente te dice **qué pista falla**:
```
pistas que no encontre: cliente: ✗, categoria: ✗, dimensiones: ✗
```
Así sabes qué palabra añadir al comando.

### Toggle voz de respuesta
Botón 🔊/🔇 en la cabecera del panel: el asistente lee la respuesta o solo la escribe.

---

## 9. Notificaciones

### Campanita en header
- Badge rojo si hay prioridad alta, ámbar si solo media.
- Click → popover con resumen.
- Refresca cada 90 segundos.

### Panel completo `/notificaciones`
8 tipos detectados al vuelo:
1. **Pedidos urgentes** (entrega < 3 días)
2. **Tareas en demora** (>2× tiempo estimado)
3. **Solapes de operario** (dos tareas que se pisan)
4. **Días holgados** — *oportunidad comercial* 💡
5. **Pedidos sin reservar hueco**
6. **Piezas listas tras secado**
7. **Presupuestos sin respuesta** (+7 días)

---

## 10. Configuración

### `/configuracion`
- Datos de empresa, IVA por defecto, dirección, logo.

### `/configuracion/operarios`
- Alta de operarios. Rol: Lijador, Fondeador, Lacador, Oficina, Taller.
- Color para el Gantt.

### `/configuracion/ubicaciones`
- Almacenes/zonas del taller.

### `/configuracion/tiempos`
- `tiempo_base_min` y `tiempo_por_m2_min` por proceso y categoría.
- Si dejas la categoría en NULL → fila global (default cuando no hay específica).

### `/configuracion/usuarios` (admin)
- Asignar roles a usuarios de Supabase Auth.
- Checklist de módulos por operario.

### `/configuracion/proveedores`
- Proveedores de material (lacado/fondo/disolvente/catalizador).
- `precio_base_kg` se usa como fallback cuando el material no tiene `precio_kg_sobrescrito`.

### `/configuracion/categorias`
- Tablón, zócalo, puerta, panel, etc.
- Procesos por defecto que se aplican al crear pieza de esa categoría.

---

## 11. Cliente externo

### Opción A — Login (con email registrado)
- `/auth/login` con email del cliente.
- Va a `/cliente` y ve sus pedidos y presupuestos.
- Requiere: rol `cliente` en `usuario_perfiles` + email vinculado en `clientes`.

### Opción B — Token (sin login, recomendado)
- Mario manda link `/c/[token]` (token = `share_token` de cualquier presupuesto del cliente).
- El cliente ve TODOS sus pedidos y presupuestos sin registrarse.
- Más simple para clientes que no quieren cuenta.

### Opción C — Presupuesto único
- `/p/[token]` muestra UN presupuesto concreto, listo para imprimir o aceptar.

### Opción D — Pieza por QR
- Cliente escanea QR de etiqueta → `/t/[qr]`.

---

## 12. Imprimir / exportar

- **Presupuesto PDF**: `/presupuestos/[id]/imprimir` (estilo formal, una página).
- **Presupuesto público**: `/p/[token]` con CTA "aceptar".
- **Etiquetas**: `/etiquetas/pedido/[id]` o `/etiquetas/pieza/[id]`.
- **Albarán**: `/albaranes/[id]`.

---

## 13. Atajos útiles

| Acción | Sitio |
|---|---|
| Crear presupuesto rápido | Dashboard → Presupuesto rápido |
| Ver Gantt | Sidebar → Planificador |
| Ver pedidos urgentes | Campanita o `/notificaciones` |
| Fichar entrada/salida | `/m` desde móvil del taller |
| Ver mis pedidos (cliente) | Link `/c/[token]` recibido |
| Ver detalle pieza con QR | Escanear etiqueta |

---

## 14. Resolución de problemas frecuentes

| Síntoma | Causa habitual | Solución |
|---|---|---|
| "No encuentro cliente" en asistente | No está en BD o nombre raro | Crear desde el propio asistente o `/dashboard/clientes` |
| OCR detecta basura | Foto borrosa o letra mala | Pre-procesado ya hace lo posible. Si insiste, escribir a mano |
| Tarea no aparece en Gantt | Estado completada o anulada | Solo se muestran pendiente/en_cola/en_progreso/en_secado |
| "Pedido sin reservar hueco" no desaparece | Tareas creadas pero sin fecha | Pulsar "Reservar hueco" en el banner |
| Operario no puede iniciar tarea | No ha fichado entrada | `/m/operario/[id]` → Entrada |
| Reorganizar no propone movimientos | Pedido ya está optimizado o no hay holgados | Verificar que otros pedidos tienen holgura > 2 días |
| Sidebar incompleta | Operario sin todos los módulos asignados | Admin va a `/configuracion/usuarios` y marca |
| Voz no funciona | Firefox, falta micrófono | Usar Chrome/Edge. Permitir micro en navegador |

---

## 15. Buenas prácticas

1. **Crear referencias_cliente** para cada pieza recurrente del cliente. Multiplica la utilidad del OCR.
2. **Confirmar pedidos a tiempo** para que las tareas entren en el Gantt antes de la fecha de entrega.
3. **Asignar operarios al crear el pedido** o tras autogenerar — evita el banner de "operarios parados".
4. **Etiquetar al confirmar** y no esperar al final de la jornada.
5. **Revisar `/notificaciones` cada mañana** — los días holgados son oportunidad comercial.
6. **Hacer backup manual** antes de ejecutar SQL destructivo (script 033).
7. **Usar QR proporcional** en etiquetas pequeñas (configuración por defecto).
8. **Fichaje obligatorio** antes de iniciar cualquier tarea desde móvil.

---

## 16. Para administrador

### Reset de pruebas
- Script `033_reset_pedidos_presupuestos.sql` borra TODO lo transaccional pero conserva clientes y catálogos.
- Ejecutar en Supabase SQL Editor con cuidado. **No tiene rollback**.

### Crear admin nuevo
1. Supabase Dashboard → Authentication → Add user.
2. `/configuracion/usuarios` → Asignar rol → admin → modulos `['*']`.

### Cambiar tiempos por proceso
- `/configuracion/tiempos` → cada proceso tiene `tiempo_base_min` y `tiempo_por_m2_min`.
- El motor del Gantt usa estos valores al crear tareas nuevas.

### Logs y errores
- Vercel: `vercel logs <deployment>`.
- Supabase: Dashboard → Logs → API/Postgres.
- Frontend: Console del navegador (F12).

---

## 17. Referencias

- 📄 `MAPA_FLUJOS.md` — diagrama de flujos completo
- 📄 `AUDITORIA.md` — estado del proyecto y deuda técnica
- 📄 `GUIA_ASISTENTE.md` — manual exhaustivo del asistente
- 📁 `scripts/` — todas las migraciones SQL en orden

---

*Documento mantenido por Mario y Claude. Actualizar cuando se añada un módulo nuevo.*
