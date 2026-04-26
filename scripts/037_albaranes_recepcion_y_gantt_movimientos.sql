-- =====================================================================
-- 037_albaranes_recepcion_y_gantt_movimientos.sql
-- =====================================================================
--
-- Refuerzo punto 33 Mario:
--  1. Tipo de albaran (entrega | recepcion). Los de recepcion
--     registran piezas que el cliente nos deja en taller.
--  2. Tabla gantt_movimientos: histórico de cambios en planificación
--     (quién movió qué, cuándo, de dónde a dónde).
--
-- Idempotente.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='albaranes' AND column_name='tipo'
  ) THEN
    ALTER TABLE public.albaranes
      ADD COLUMN tipo text NOT NULL DEFAULT 'entrega'
        CHECK (tipo IN ('entrega', 'recepcion'));
  END IF;
END $$;

COMMENT ON COLUMN public.albaranes.tipo IS
  'entrega = nosotros entregamos al cliente. recepcion = el cliente nos trae piezas.';

CREATE TABLE IF NOT EXISTS public.gantt_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id uuid NOT NULL REFERENCES public.tareas_produccion(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_anterior timestamptz,
  fecha_nueva timestamptz,
  operario_anterior_id uuid REFERENCES public.operarios(id) ON DELETE SET NULL,
  operario_nuevo_id uuid REFERENCES public.operarios(id) ON DELETE SET NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gantt_movimientos_tarea ON public.gantt_movimientos (tarea_id);
CREATE INDEX IF NOT EXISTS idx_gantt_movimientos_fecha ON public.gantt_movimientos (created_at DESC);

NOTIFY pgrst, 'reload schema';
