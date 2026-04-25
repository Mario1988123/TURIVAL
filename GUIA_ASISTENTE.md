# Guía del Asistente TURIVAL

Asistente integrado en el ERP que entiende **voz**, **texto** y **fotos** de
hojas de pedido, sin enviar nada a servicios externos. **100% gratis**: no usa
LLM, no consume API de pago, todo corre en el navegador y en tu Supabase.

---

## ¿Cómo se abre?

Tienes **dos accesos** al mismo asistente:

1. **Botón "Presupuesto rápido"** en el dashboard (tarjeta azul arriba). Pulsa
   *Voz* o *Foto / OCR* y se abre el panel.
2. **Botón flotante** circular abajo a la derecha (icono robot), disponible
   en cualquier módulo.

Cuando se abre por primera vez, carga el diccionario desde tu base de datos.
Tarda 1–3 segundos. Verás algo como:
> `(83c · 274m · 12ref)` — 83 clientes, 274 materiales, 12 referencias.

---

## Modo VOZ

1. Pulsa el icono del **micrófono**.
2. Habla con frases naturales en español.
3. El asistente transcribe en directo (lo ves en amarillo).
4. Al terminar, pulsa **enviar** o pulsa el micro otra vez para parar.

**Funciona en Chrome, Edge y Safari**. En Firefox no hay reconocimiento de
voz; usa el campo de texto.

---

## Modo TEXTO

Escribe el comando directamente en la caja y pulsa Enter. Útil cuando estás
en un sitio ruidoso o no quieres hablar.

---

## Modo FOTO / OCR

1. Pulsa el icono de **cámara**.
2. Selecciona una foto de la hoja de pedido (o haz una nueva con el móvil).
3. El asistente lee el texto con Tesseract.js (OCR local en español).
4. Al terminar el OCR (verás el progreso 0–100%), pasa el texto reconocido al
   parser y crea el presupuesto.

> **Pensado para clientes recurrentes**. Si tienes guardadas las piezas como
> *referencias_cliente* (ver más abajo), el OCR las reconoce solo con el
> nombre o el código que el cliente escribe. Lo que no reconozca queda como
> *línea pendiente* en el presupuesto, en lugar de bloquear todo.

---

## Comandos que entiende

### Crear presupuesto
- *"Presupuesto para TURMALINA, tablón 200 por 50, RAL 9003, doble fondeado"*
- *"Para MAGAMA, puerta cocina"* — si tienes esa pieza guardada como
  referencia recurrente del cliente MAGAMA, reusará todos sus datos.
- *"Cliente varios, panel 100x60 lacado RAL 9010"* — usa el cliente
  llamado "VARIOS" si lo tienes creado.
- *"Hazme un presupuesto de 5 zócalos 30 metros lineales lacado mate"*

### Añadir línea (próximamente con presupuesto en contexto)
- *"Añade tres puertas 60×80 RAL 9003"*

### Consultar
- *"Muéstrame pedidos urgentes"* / *"Qué pedidos van mal de plazo"* /
  *"Qué hay sin reservar"*

### Reorganizar (próximamente)
- *"Reorganiza priorizando PED-26-0042"*

### Cancelar
- *"Cancela"* / *"Olvida eso"*

---

## Diccionario que entiende (extraído de tu BD)

El asistente NO usa IA. Asocia palabras a tablas con un diccionario que se
construye al abrirse leyendo:

| Tabla | Qué busca | Ejemplo |
|---|---|---|
| `clientes` | razón social, nombre comercial | *"TURMALINA"*, *"sialor de relojería"* |
| `categorias_pieza` | nombre + sinónimos | *"tablón"*, *"zócalo"*, *"puerta cocina"* |
| `materiales` (lacado) | nombre, código RAL | *"RAL 9003"*, *"blanco mate"* |
| `materiales` (fondo) | nombre | *"fondo blanco"*, *"fondo negro"* |
| `referencias_cliente` | referencia_cliente, referencia_interna, nombre_pieza | *"PUERTA-COCINA-A1"*, *"frente cajón"* |
| `procesos_catalogo` | sinónimos hardcoded | ver abajo |

### Sinónimos de procesos

Todos estos términos se convierten al código interno correcto:

- **LIJADO**: lijado, lija, lijar, lijada(s), lijado fino
- **FONDO**: fondo, fondear, fondeado, fondo blanco, fondo negro,
  imprimación, sellador
- **LIJADO_2**: doble lijado, segundo lijado, lijado 2, relijado
- **FONDEADO_2**: doble fondeado, doble fondo, segundo fondo, refondeado
- **LACADO**: lacado, lacar, pintado, pintura, pintar, esmaltado, esmalte
- **TERMINACION**: terminación, acabado, pulido, matizado, mate, brillante, satinado
- **RECEPCION**: recepción, entrada
- **PICKING**: picking, preparación, embalaje, empaquetado
- **COMPROB_MATERIAL**: comprobación, comprobar material, verificar material, inspección

### Variantes de número y dimensiones

- *"200 por 50"* / *"200x50"* / *"200 x 50 x 19"* → ancho × alto × grosor en mm
- *"30 metros lineales"* / *"30 ml"* → longitud en metros lineales
- *"5 unidades"*, *"tres tablones"* → cantidad
- Números literales (uno, dos, tres, ... cincuenta) reconocidos.

### Categorías reconocidas

tablón, zócalo, puerta, panel, cajón, frente, moldura, listón, mueble,
irregular. Variaciones con/sin tilde, plural/singular.

---

## Referencias de cliente: la clave del OCR

Si TURMALINA siempre te pide la misma puerta de cocina, créala UNA vez
como referencia y dale un nombre que ellos reconozcan:

1. Ve a `/dashboard/clientes/<id>` → sección "Piezas recurrentes".
2. Crea una referencia:
   - **Referencia cliente**: el código que ELLOS usan (ej. `PUERTA-A1`,
     `MAGAMA-COCINA-BLANCA`).
   - **Referencia interna**: el código TUYO interno (ej. `PC-2024-001`).
   - **Nombre pieza**: descripción humana (ej. `puerta cocina blanca`).
   - Resto de campos: dimensiones, procesos, color, etc. (lo que sueles hacer).

A partir de ahí:

- Por **voz**: *"Para TURMALINA, puerta cocina"* → reusa la referencia.
- Por **OCR**: si la hoja de pedido contiene `PUERTA-A1` o el nombre, lo
  detecta y enlaza automáticamente.

> **Tip de Mario**: el cliente puede escribir cosas raras en la hoja
> ("PUERTA Cocina Mod A1"). El parser normaliza tildes, espacios y
> mayúsculas, así que aunque venga escrito a mano y el OCR lo lea con
> ruido (`PUERTA-A1.`), seguirá matcheando.

---

## Qué pasa cuando el asistente NO entiende algo

Diseñado para **no bloquearse**: si reconoce el cliente pero una línea no
encaja en ninguna referencia ni tiene dimensiones claras, crea el
presupuesto igualmente y marca esa línea como **PENDIENTE REVISAR**
(precio 0€, descripción del texto bruto). Mario abre el presupuesto y
completa.

Esto es especialmente útil con OCR: si la foto pierde dimensiones de una
línea pero las otras 5 están claras, no fuerza a re-tomar la foto entera.

En las observaciones internas del presupuesto queda registrado:
> `[Asistente] 2 linea(s) pendiente(s) de revisar. Origen: "..."`

---

## Limitaciones conocidas (v1)

- Voz: no funciona offline, requiere conexión para Web Speech API.
- OCR: precisión depende de calidad de foto, contraste y caligrafía. Letra
  manuscrita compleja puede dar problemas.
- "Añadir línea" todavía es stub (necesita presupuesto en contexto).
- "Para cuándo estaría" todavía es stub (use el botón *Recomendar fecha*
  del presupuesto/pedido).
- Reorganización automática del Gantt todavía es stub.

---

## Ejemplos completos

### Por voz, cliente nuevo
> *"Presupuesto para Carpintería del Sur, tres puertas 60×80×19, RAL 9001,
> doble fondeado y lacado mate"*

→ Si "Carpintería del Sur" existe en `clientes`, crea presupuesto con 1 línea:
3 puertas, dimensiones, fondo, doble fondeado, lacado, terminación mate.

### Por foto, cliente recurrente
> Subo foto de hoja de TURMALINA con `PUERTA-A1 x 5`, `ZOCALO-B2 30 ml RAL 9010`.

→ OCR extrae el texto, parser detecta cliente TURMALINA, encuentra
referencias `PUERTA-A1` y `ZOCALO-B2`, crea presupuesto con 2 líneas
heredando todos los datos (dimensiones, procesos, color) de las referencias.

### Con datos parciales (OCR malo)
> Foto borrosa, OCR extrae *"MAGAMA puerta cocina ?? por 80 RAL 9003"*

→ Detecta cliente MAGAMA, detecta categoría puerta, detecta RAL 9003. Como
falta el ancho, crea la línea como **PENDIENTE REVISAR** y avisa: *"1
linea(s) pendiente(s) de revisar"*. Mario abre y completa el ancho.

---

## Privacidad

Tu voz y tus fotos NUNCA salen del navegador.

- **Voz**: Web Speech API del navegador. En Chrome usa servidores de Google
  internamente para reconocer (es la única caja negra). Si te preocupa, hay
  opción a futuro de usar Whisper.cpp local.
- **OCR**: Tesseract.js corre 100% en el navegador. La foto nunca se sube.
- **Comandos**: el parser y el diccionario son código JavaScript local.
- **Acciones**: las llamadas a Supabase (crear presupuesto, etc.) van a TU
  Supabase con tus credenciales, igual que el resto del ERP.

---

## Mantenimiento

- Si añades clientes/materiales/referencias nuevas, el diccionario se cachea
  5 minutos. Cierra y vuelve a abrir el asistente para refrescar.
- El diccionario y parser viven en `lib/motor/asistente-voz/` (código puro,
  sin UI, fácil de testear).
- La UI vive en `components/asistente/asistente-voz.tsx`.

---

*Capa 9 — TURIVAL · sin LLM · sin coste · 100% local*
