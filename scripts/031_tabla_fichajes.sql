-- =====================================================================
-- 031_tabla_fichajes.sql
-- =====================================================================
--
-- Crea la tabla `fichajes` para:
--   1. Botones "Descanso personal / Reanudar" del Planificador (global).
--   2. Futuro módulo de fichaje individual por operario (con cuenta).
--
-- Tipos cubiertos:
--   - 'descanso_global_inicio' / 'descanso_global_fin': el taller pausa.
--     Cuando se reanuda, el Gantt puede desplazar las tareas del día.
--   - 'entrada' / 'salida': fichaje individual por operario.
--   - 'pausa_inicio' / 'pausa_fin': pausas individuales (ej. café, comida).
--   - 'tarea_inicio' / 'tarea_fin': opcional, para log fino por tarea.
--
-- Ampliación de operarios para fichaje individual:
--   - profile_id → vincula con la cuenta auth.users (via profiles)
--   - horas_dia + hora_entrada_default + hora_salida_default
--   (opcional; se puede dejar NULL y usar defaults de configuracion_empresa)
--
-- Riesgo: BAJO. Solo CREATE TABLE y ALTER TABLE ADD COLUMN (no destructivo).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Tabla fichajes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fichajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id uuid,
  tipo text NOT NULL,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  duracion_minutos numeric,
  tarea_id uuid,
  notas text,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Constraints y FKs (idempotentes via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fichajes_tipo_check') THEN
    ALTER TABLE public.fichajes ADD CONSTRAINT fichajes_tipo_check
      CHECK (tipo IN (
        'entrada', 'salida',
        'pausa_inicio', 'pausa_fin',
        'descanso_global_inicio', 'descanso_global_fin',
        'tarea_inicio', 'tarea_fin'
      ));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fichajes_operario_id_fkey') THEN
    ALTER TABLE public.fichajes
      ADD CONSTRAINT fichajes_operario_id_fkey
      FOREIGN KEY (operario_id) REFERENCES public.operarios(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fichajes_tarea_id_fkey') THEN
    ALTER TABLE public.fichajes
      ADD CONSTRAINT fichajes_tarea_id_fkey
      FOREIGN KEY (tarea_id) REFERENCES public.tareas_produccion(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_fichajes_operario ON public.fichajes (operario_id);
CREATE INDEX IF NOT EXISTS idx_fichajes_tipo ON public.fichajes (tipo);
CREATE INDEX IF NOT EXISTS idx_fichajes_ocurrido ON public.fichajes (ocurrido_en DESC);

-- RLS
ALTER TABLE public.fichajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fichajes_all ON public.fichajes;
CREATE POLICY fichajes_all ON public.fichajes
  AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 2) Columnas en operarios para fichaje individual (opcional)
-- ---------------------------------------------------------------------
ALTER TABLE public.operarios
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS horas_dia numeric(3,1),
  ADD COLUMN IF NOT EXISTS hora_entrada_default time,
  ADD COLUMN IF NOT EXISTS hora_salida_default time;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operarios_profile_id_fkey') THEN
    ALTER TABLE public.operarios
      ADD CONSTRAINT operarios_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------
-- VERIFICACIÓN
-- ---------------------------------------------------------------------
-- SELECT count(*) FROM public.fichajes;                             -- 0
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='operarios' AND column_name IN (
--     'profile_id','horas_dia','hora_entrada_default','hora_salida_default'
--   );                                                              -- 4 filas


-- ---------------------------------------------------------------------
-- ROLLBACK (si algo va mal)
-- ---------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.fichajes CASCADE;
-- ALTER TABLE public.operarios
--   DROP COLUMN IF EXISTS profile_id,
--   DROP COLUMN IF EXISTS horas_dia,
--   DROP COLUMN IF EXISTS hora_entrada_default,
--   DROP COLUMN IF EXISTS hora_salida_default;
