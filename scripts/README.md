# Scripts SQL de TURIVAL

## Dos caminos de instalación

### A) Instalación limpia en BD nueva (recomendado para migrar)

Usa **`000_schema_completo.sql`** y listo. Es un snapshot completo del Supabase actual (45 tablas + constraints + índices + funciones + RLS + políticas + semillas de catálogos + 272 colores NCS/RAL + 275 materiales + configuración).

```bash
psql -U postgres -d turival -f scripts/000_schema_completo.sql
```

Ventajas:
- Un solo archivo, estado final.
- Idempotente (CREATE IF NOT EXISTS, DO blocks, ON CONFLICT DO NOTHING).
- Extraído del schema real, no reconstruido a mano.

Requisito en Postgres nativo (no-Supabase): crear primero los objetos que Supabase tiene por defecto:
```sql
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE ROLE authenticated;
CREATE ROLE anon;
```

### B) Historial incremental (el orden en que se fueron aplicando en Supabase)

Útil para ver la evolución, no para instalar desde cero (mejor usar A).

| Orden | Script | Qué hace |
|---|---|---|
| 1 | `001_create_schema.sql` | Tablas principales base |
| 2 | `002_create_rls.sql` | Políticas Row Level Security |
| 3 | `003_seed_data.sql` | Profiles + handle_new_user trigger |
| 4 | `004_procesos_y_produccion.sql` | Procesos, complejidad, carros, empleados, secuencias |
| 5 | `005_seed_procesos.sql` | 9 procesos + 3 niveles complejidad + carros |
| 6 | `006_seed_colores_ncs.sql` | 272 colores NCS (⚠️ tabla `colores` hoy es `colores_legacy`) |
| 7 | `007_seed_tratamientos_tarifas.sql` | 12 tratamientos + 14 tarifas |
| 8 | `008_functions.sql` | `generar_numero_secuencial`, `get_next_sequence`, `calcular_superficie_m2` |
| 9 | `009_motor_v4.sql` | Motor v4: metro lineal + tipos de pieza |
| 10 | `010_configuracion_empresa.sql` | Singleton config empresa + bucket Storage |
| 11 | `011_share_token_presupuestos.sql` | Link público `/p/[token]` |
| 12 | `012_capa2v2_procesos_aprendizaje.sql` | Capa 2 v2: opcional, depende_de_secuencia, historial |
| 14 | `014_capa_4_pedidos.sql` | Capa 4 pedidos |
| 15 | `015_capa_5_v2.sql` | Capa 5 producción v2 |
| 16 | `016_fix_fk_piezas_colores.sql` | Fix FK piezas-colores |
| 17 | `017_trazabilidad_publica.sql` | RPC obtener_pieza_publica (bug de `FROM colores` corregido en 030) |
| 18 | `018_cleanup_y_categorias_pieza.sql` | Cleanup + categorias_pieza |
| 19 | `019_proveedores_y_materiales.sql` | Tablas proveedores + materiales |
| 20 | `020_ampliar_tablas_existentes.sql` | Amplía columnas en tablas existentes |
| 21 | `021_stock_y_movimientos.sql` | Stock + movimientos_stock + reservas |
| 22 | `022_ampliar_configuracion_empresa.sql` | Ratios, coste minuto, margen, etc. |
| 23 | `023_ampliar_check_modo_precio.sql` | CHECK de modo_precio ampliado |
| 29 | `029_reset_y_fix_secuencias.sql` | TRUNCATE CASCADE + función `generar_numero_secuencial` case-insensitive |
| **030** | **`030_fix_rpc_pieza_publica_colores.sql`** | **Fix RPC obtener_pieza_publica: `FROM colores` → `FROM materiales WHERE tipo='lacado'`** |
| **031** | **`031_tabla_fichajes.sql`** | **⏳ PENDIENTE EJECUTAR — crea tabla fichajes + amplía operarios para botones Descanso/Reanudar del Planificador** |

Nota: 013, 024–028 nunca fueron versionados como archivo pero su efecto está recogido en `000_schema_completo.sql`.

## Pendientes (acción de Mario)

- [x] **030** ejecutado en Supabase el 24-abr-2026 ✅
- [ ] **031** — ejecutar cuando se quieran activar los botones Descanso/Reanudar del Planificador y, en el futuro, el módulo de fichaje individual por operario.

## Pasos previos al 010

Antes de ejecutar `010_configuracion_empresa.sql` en una instalación limpia, **crear el bucket Storage** desde la UI de Supabase:

1. Storage → **New bucket**
2. Name: `empresa-assets`
3. Public bucket: ✅ ON
4. File size limit: `5 MB`
5. Allowed MIME types: `image/png, image/jpeg, image/svg+xml, image/webp`
6. Save

## Cómo ejecutar

### En Supabase

Los scripts se pegan uno a uno en **SQL Editor → New Query → Run**. Todos son idempotentes.

### En servidor propio (migración)

Usa el camino A:
```bash
psql -U postgres -d turival -f scripts/000_schema_completo.sql
```
