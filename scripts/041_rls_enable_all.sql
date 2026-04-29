-- ============================================================
-- 041_rls_enable_all.sql
-- ------------------------------------------------------------
-- Soluciona los errores del Supabase Database Advisor:
--   - policy_exists_rls_disabled (policies sin RLS activada)
--   - rls_disabled_in_public (tablas public sin RLS)
--
-- Estrategia mono-empresa Turiaval:
--   - Para tablas con policies definidas (la mayoría) → solo activar RLS.
--   - Para tablas sin policies (lotes_produccion, empleados, tareas_produccion,
--     procesos_producto, procesos_catalogo, carros) → crear policy permisiva
--     "authenticated puede todo" antes de activar RLS, así no rompemos la app.
--
-- Esto NO cambia el comportamiento actual: cualquier user logueado sigue
-- pudiendo leer/escribir todas las tablas operativas. Lo que GANAMOS es:
--   - Bloqueamos accesos con la anon key SIN sesión (curl con la NEXT_PUBLIC
--     anon key no funcionará).
--   - El service_role sigue saltando RLS para operaciones admin.
--
-- ROLLBACK: scripts/041_rls_enable_all_rollback.sql
-- ============================================================

BEGIN;

-- ---------- 1) Tablas que YA tienen policies → solo ENABLE ----------
ALTER TABLE public.acabados                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albaranes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacidad_diaria        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colores                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fases_produccion        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_pagos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_albaran          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_pedido           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_presupuesto      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_documentos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piezas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planificacion           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_notificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referencias_cliente     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secuencias              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos            ENABLE ROW LEVEL SECURITY;

-- ---------- 2) Tablas SIN policies → crear policy permisiva + ENABLE ----------
-- Patrón: cualquier authenticated puede SELECT/INSERT/UPDATE/DELETE.
-- Si en el futuro quieres restringir, edita estas policies.

DO $$
BEGIN
  -- carros
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='carros') THEN
    EXECUTE 'CREATE POLICY carros_all_auth ON public.carros FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  -- empleados
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='empleados') THEN
    EXECUTE 'CREATE POLICY empleados_all_auth ON public.empleados FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  -- lotes_produccion
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lotes_produccion') THEN
    EXECUTE 'CREATE POLICY lotes_produccion_all_auth ON public.lotes_produccion FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  -- procesos_catalogo
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='procesos_catalogo') THEN
    EXECUTE 'CREATE POLICY procesos_catalogo_all_auth ON public.procesos_catalogo FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  -- procesos_producto
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='procesos_producto') THEN
    EXECUTE 'CREATE POLICY procesos_producto_all_auth ON public.procesos_producto FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  -- tareas_produccion
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tareas_produccion') THEN
    EXECUTE 'CREATE POLICY tareas_produccion_all_auth ON public.tareas_produccion FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

ALTER TABLE public.carros            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_produccion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procesos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procesos_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_produccion ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================
-- VERIFICACION (ejecutar despues, deberia listar 0 filas)
-- ============================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname='public' AND rowsecurity=false
-- ORDER BY tablename;
