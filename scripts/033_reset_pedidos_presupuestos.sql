-- =====================================================================
-- 033_reset_pedidos_presupuestos.sql
-- =====================================================================
--
-- Borra TODOS los presupuestos y pedidos (y sus piezas, tareas, reservas,
-- albaranes, movimientos). Conserva:
--   · clientes
--   · catálogos (productos, materiales, colores, tratamientos, tarifas,
--     categorías, procesos, config_tiempos_proceso)
--   · configuración (configuracion_empresa, operarios, ubicaciones, carros)
--   · fichajes (por si ya hay registros de horario)
--   · referencias_cliente (piezas recurrentes por cliente)
--
-- Mario está en pruebas y ha dado vía libre a limpiar presupuestos/pedidos
-- el 25-abr-2026. TRUNCATE CASCADE sigue las FK automáticamente; lo que NO
-- esté conectado a presupuestos/pedidos queda intacto.
--
-- Cómo ejecutar: Supabase → SQL Editor → New Query → pegar → Run.
--
-- Riesgo: DESTRUCTIVO. No tiene rollback (los datos se pierden).
-- =====================================================================

BEGIN;

-- 1) Borrar transaccional de producción que cuelga de piezas/pedidos
TRUNCATE TABLE
  public.movimientos_pieza,
  public.movimientos_stock,
  public.operarios_tareas_candidatos,
  public.ajustes_rendimiento_pendientes,
  public.incidencias_tarea,
  public.historial_tiempos_proceso,
  public.tareas_produccion,
  public.piezas,
  public.reservas_stock,
  public.lineas_albaran,
  public.albaranes,
  public.lotes,
  public.pagos,
  public.historial_pagos,
  public.avisos_cliente,
  public.fases_produccion,
  public.planificacion,
  public.capacidad_diaria,
  public.lineas_pedido,
  public.pedidos,
  public.lineas_presupuesto,
  public.presupuestos
  RESTART IDENTITY CASCADE;

-- 2) Resetear el contador de secuencias (pedido, presupuesto, pieza, albaran, lote)
--    para que el próximo número empiece en 0001.
TRUNCATE TABLE public.secuencias;

-- 3) Dejar stock_reservado_kg a 0 (porque las reservas ya no existen)
UPDATE public.materiales SET stock_reservado_kg = 0 WHERE stock_reservado_kg > 0;

COMMIT;

-- ---------------------------------------------------------------------
-- VERIFICACIÓN (ejecutar en otra query tras el COMMIT)
-- ---------------------------------------------------------------------
-- SELECT 'clientes' AS t, count(*) FROM public.clientes
-- UNION ALL SELECT 'referencias_cliente', count(*) FROM public.referencias_cliente
-- UNION ALL SELECT 'materiales', count(*) FROM public.materiales
-- UNION ALL SELECT 'operarios', count(*) FROM public.operarios
-- UNION ALL SELECT 'ubicaciones', count(*) FROM public.ubicaciones
-- UNION ALL SELECT 'presupuestos', count(*) FROM public.presupuestos           -- 0
-- UNION ALL SELECT 'lineas_presupuesto', count(*) FROM public.lineas_presupuesto -- 0
-- UNION ALL SELECT 'pedidos', count(*) FROM public.pedidos                     -- 0
-- UNION ALL SELECT 'lineas_pedido', count(*) FROM public.lineas_pedido         -- 0
-- UNION ALL SELECT 'piezas', count(*) FROM public.piezas                       -- 0
-- UNION ALL SELECT 'tareas', count(*) FROM public.tareas_produccion            -- 0
-- UNION ALL SELECT 'albaranes', count(*) FROM public.albaranes                 -- 0
-- UNION ALL SELECT 'reservas_stock', count(*) FROM public.reservas_stock       -- 0
-- UNION ALL SELECT 'secuencias', count(*) FROM public.secuencias               -- 0
-- ORDER BY t;

-- ---------------------------------------------------------------------
-- ROLLBACK POSTERIOR — imposible tras COMMIT
-- ---------------------------------------------------------------------
-- TRUNCATE no registra rows en WAL de forma que permita UNDO. Los datos
-- se pierden para siempre. Si hiciera falta restaurar, usa un backup
-- previo desde Supabase (Dashboard → Database → Backups).
