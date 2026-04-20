# Scripts SQL de TURIVAL

Orden de ejecución para **instalación limpia** en un servidor PostgreSQL nuevo con Supabase:

| Orden | Script | Qué hace |
|---|---|---|
| 1 | `001_create_schema.sql` | Tablas principales: clientes, productos, colores, tratamientos, tarifas, presupuestos, lineas_presupuesto, pedidos, albaranes, piezas, OCR docs... |
| 2 | `002_create_rls.sql` | Políticas Row Level Security para todas las tablas principales |
| 3 | `003_seed_data.sql` | Datos iniciales: profiles, handle_new_user trigger, dashboard básico |
| 4 | `004_procesos_y_produccion.sql` | **NUEVO**: Tablas de procesos (catálogo, por producto, tareas), niveles complejidad, carros, empleados, secuencias, referencias cliente |
| 5 | `005_seed_procesos.sql` | **NUEVO**: 9 procesos base + 3 niveles complejidad + 3 carros ejemplo |
| 6 | `006_seed_colores_ncs.sql` | 272 colores NCS iniciales |
| 7 | `007_seed_tratamientos_tarifas.sql` | 12 tratamientos + 14 tarifas base |
| 8 | `008_functions.sql` | **NUEVO**: Funciones BD: `generar_numero_secuencial`, `get_next_sequence`, `calcular_superficie_m2` |
| 9 | `009_motor_v4.sql` | **NUEVO**: Motor de cálculo v4: metro lineal + tipos de pieza (tablero/frente/moldura/irregular) |
| 10 | `010_configuracion_empresa.sql` | **NUEVO**: Tabla singleton config empresa + RLS bucket Storage empresa-assets |
| 11 | `011_share_token_presupuestos.sql` | **NUEVO**: Link público `/p/[token]` sin auth para enviar presupuestos a clientes |

## Pasos previos al 010

Antes de ejecutar `010_configuracion_empresa.sql`, **crear el bucket Storage** desde la UI de Supabase:

1. Storage → **New bucket**
2. Name: `empresa-assets`
3. Public bucket: ✅ ON
4. File size limit: `5 MB`
5. Allowed MIME types: `image/png, image/jpeg, image/svg+xml, image/webp`
6. Save

## Cómo ejecutar

### En Supabase (producción actual)

Los scripts se pegan uno a uno en **SQL Editor → New Query → Run**. Todos son idempotentes (seguros ejecutar múltiples veces).

### En servidor propio (futura migración)

```bash
# Desde psql
psql -U postgres -d turival -f scripts/001_create_schema.sql
psql -U postgres -d turival -f scripts/002_create_rls.sql
psql -U postgres -d turival -f scripts/003_seed_data.sql
psql -U postgres -d turival -f scripts/004_procesos_y_produccion.sql
psql -U postgres -d turival -f scripts/005_seed_procesos.sql
psql -U postgres -d turival -f scripts/006_seed_colores_ncs.sql
psql -U postgres -d turival -f scripts/007_seed_tratamientos_tarifas.sql
psql -U postgres -d turival -f scripts/008_functions.sql
psql -U postgres -d turival -f scripts/009_motor_v4.sql
psql -U postgres -d turival -f scripts/010_configuracion_empresa.sql
psql -U postgres -d turival -f scripts/011_share_token_presupuestos.sql
```

## Pendiente (próxima iteración)

- **`012_capa2_v2_procesos_aprendizaje.sql`** — Capa 2 v2: campos `opcional` + `depende_de_secuencia` en procesos_producto, tabla `historial_tiempos_proceso`, tabla `incidencias_tarea`, campo `material_disponible` + `fecha_llegada_material`, función `recalcular_tiempos_pedido`
