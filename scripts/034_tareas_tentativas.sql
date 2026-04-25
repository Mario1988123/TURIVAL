-- =====================================================================
-- 034_tareas_tentativas.sql
-- =====================================================================
--
-- Anade el flag `tentativa` a `tareas_produccion`. Lo usa el flujo de
-- "Reservar horas desde presupuesto": las tareas creadas a partir de
-- un presupuesto NO confirmado se guardan con tentativa=true y se
-- pintan difuminadas en el Gantt para que Mario sepa que hay que
-- validarlas (al convertir presupuesto -> pedido se pasa a false).
--
-- Idempotente: usa DO block + IF NOT EXISTS.
--
-- Cambios:
--   1) Nueva columna tentativa boolean default false
--   2) Indice por (tentativa) para filtrar rapido
--   3) Comentario explicativo en la columna
--   4) NOTIFY pgrst para refrescar el cache de PostgREST
--
-- Riesgo: bajo. El default es false, asi que tareas existentes pasan
-- a "no tentativa" (= confirmadas), que es el comportamiento actual.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tareas_produccion'
      AND column_name = 'tentativa'
  ) THEN
    ALTER TABLE public.tareas_produccion
      ADD COLUMN tentativa boolean NOT NULL DEFAULT false;

    COMMENT ON COLUMN public.tareas_produccion.tentativa IS
      'true si la tarea proviene de una reserva desde presupuesto sin confirmar. Se pinta difuminada en el Gantt y al convertir presupuesto -> pedido se pasa a false.';

    CREATE INDEX IF NOT EXISTS idx_tareas_produccion_tentativa
      ON public.tareas_produccion (tentativa)
      WHERE tentativa = true;
  END IF;
END $$;

-- Refrescar cache de PostgREST para que el campo sea consultable via API.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------
-- ALTER TABLE public.tareas_produccion DROP COLUMN IF EXISTS tentativa;
-- DROP INDEX IF EXISTS idx_tareas_produccion_tentativa;
-- NOTIFY pgrst, 'reload schema';
