-- =====================================================================
-- 036_procesos_tiempos_personalizados.sql
-- =====================================================================
--
-- OPCIONAL. Mario puede ejecutarlo si quiere una columna dedicada para
-- guardar tiempos personalizados por proceso. Mientras tanto, el codigo
-- usa lineas_presupuesto.extras.procesos_tiempos (jsonb que ya existe).
--
-- Idempotente. NOTIFY pgrst al final.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lineas_presupuesto' AND column_name='procesos_tiempos'
  ) THEN
    ALTER TABLE public.lineas_presupuesto ADD COLUMN procesos_tiempos jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lineas_pedido' AND column_name='procesos_tiempos'
  ) THEN
    ALTER TABLE public.lineas_pedido ADD COLUMN procesos_tiempos jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.lineas_presupuesto.procesos_tiempos IS
  'JSON array: [{codigo, tiempo_base_min, tiempo_por_m2_min}]. Si null, usar defaults.';
COMMENT ON COLUMN public.lineas_pedido.procesos_tiempos IS
  'Snapshot copiado desde lineas_presupuesto al confirmar pedido.';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------
-- ALTER TABLE public.lineas_presupuesto DROP COLUMN IF EXISTS procesos_tiempos;
-- ALTER TABLE public.lineas_pedido DROP COLUMN IF EXISTS procesos_tiempos;
-- NOTIFY pgrst, 'reload schema';
