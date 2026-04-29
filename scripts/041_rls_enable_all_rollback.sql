-- ============================================================
-- 041_rls_enable_all_rollback.sql
-- ------------------------------------------------------------
-- Rollback del script 041_rls_enable_all.sql.
-- Desactiva RLS en todas las tablas afectadas y borra las policies
-- permisivas creadas para tablas que no tenían ninguna.
--
-- USAR SOLO si tras ejecutar el 041 la app empieza a fallar con
-- errores de "row-level security policy violation" desde rutas
-- que antes funcionaban. Antes de revertir, revisa los logs de
-- Vercel para identificar QUÉ query falla y considera ajustar
-- las policies en lugar de revertir.
-- ============================================================

BEGIN;

-- ---------- Borrar policies permisivas creadas en el 041 ----------
DROP POLICY IF EXISTS carros_all_auth            ON public.carros;
DROP POLICY IF EXISTS empleados_all_auth         ON public.empleados;
DROP POLICY IF EXISTS lotes_produccion_all_auth  ON public.lotes_produccion;
DROP POLICY IF EXISTS procesos_catalogo_all_auth ON public.procesos_catalogo;
DROP POLICY IF EXISTS procesos_producto_all_auth ON public.procesos_producto;
DROP POLICY IF EXISTS tareas_produccion_all_auth ON public.tareas_produccion;

-- ---------- DISABLE RLS en todas las tablas afectadas ----------
ALTER TABLE public.acabados                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.albaranes               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacidad_diaria        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.carros                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.colores                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fases_produccion        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_pagos         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_albaran          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_pedido           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_presupuesto      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_produccion        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_documentos          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.piezas                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.planificacion           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_notificacion DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.procesos_catalogo       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.procesos_producto       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.referencias_cliente     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.secuencias              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_produccion       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos            DISABLE ROW LEVEL SECURITY;

COMMIT;
