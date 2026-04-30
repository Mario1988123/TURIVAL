-- ============================================================
-- 041_rls_enable_all.sql  (defensivo, ignora tablas inexistentes)
-- ------------------------------------------------------------
-- Soluciona los errores del Supabase Database Advisor:
--   - policy_exists_rls_disabled (policies sin RLS activada)
--   - rls_disabled_in_public (tablas public sin RLS)
--
-- Estrategia mono-empresa Turiaval:
--   - Para tablas con policies definidas → solo activar RLS.
--   - Para tablas sin policies → crear policy permisiva auth.uid() IS NOT NULL.
--
-- Defensivo: cada operacion verifica si la tabla existe antes de tocarla.
-- Asi puede ejecutarse en proyectos donde algunas tablas (lotes_produccion,
-- carros, empleados, tareas_produccion, procesos_*) no se han creado todavia.
--
-- ROLLBACK: scripts/041_rls_enable_all_rollback.sql
-- ============================================================

BEGIN;

-- ---------- 1) ENABLE RLS en todas las tablas, si existen ----------
DO $$
DECLARE
  tablas text[] := ARRAY[
    'acabados','albaranes','capacidad_diaria','clientes','colores',
    'fases_produccion','historial_pagos','lineas_albaran','lineas_pedido',
    'lineas_presupuesto','lotes','notificaciones','ocr_documentos','pagos',
    'pedidos','piezas','planificacion','plantillas_notificacion','presupuestos',
    'productos','profiles','referencias_cliente','secuencias','tarifas','tratamientos',
    -- Las que pueden no existir (modulo produccion):
    'carros','empleados','lotes_produccion','procesos_catalogo','procesos_producto','tareas_produccion'
  ];
  nombre_tabla text;
BEGIN
  FOREACH nombre_tabla IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name = nombre_tabla
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nombre_tabla);
    ELSE
      RAISE NOTICE 'Tabla public.% no existe, se omite ENABLE RLS.', nombre_tabla;
    END IF;
  END LOOP;
END $$;

-- ---------- 2) Policy permisiva basica para tablas sin policies ----------
DO $$
DECLARE
  tablas text[] := ARRAY['carros','empleados','lotes_produccion','procesos_catalogo','procesos_producto','tareas_produccion'];
  nombre_tabla text;
BEGIN
  FOREACH nombre_tabla IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name = nombre_tabla
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename = nombre_tabla
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I_all_auth ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
          nombre_tabla, nombre_tabla
        );
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- VERIFICACION (ejecutar despues, deberia listar 0 filas en public)
-- ============================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname='public' AND rowsecurity=false
-- ORDER BY tablename;
