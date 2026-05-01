-- ============================================================
-- 048_horario_pausas_y_seed_default.sql
-- ------------------------------------------------------------
-- 1) Añade columna `pausas` jsonb a horarios_operario (multiples
--    pausas por dia, formato [{hora_inicio, minutos}, ...]).
-- 2) Siembra horario por defecto del taller para todos los operarios
--    activos (L-V, 7:00-16:00 con almuerzo 10:00-10:30 y comida
--    14:00-15:00). Idempotente.
--
-- ROLLBACK: scripts/048_horario_pausas_y_seed_default_rollback.sql
-- ============================================================

BEGIN;

-- ---------- 1) Columna pausas jsonb ----------
ALTER TABLE public.horarios_operario
  ADD COLUMN IF NOT EXISTS pausas jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.horarios_operario.pausas IS
  'Array de pausas del dia: [{"hora_inicio":"10:00","minutos":30}, ...]. El motor del planificador las suma al reloj de la tarea pero no las imputa al tiempo de pieza.';

-- ---------- 2) Seed horario default (7:00-16:00, dos pausas) ----------
-- Para cada operario activo, insertar 5 filas (L-V) con el horario default.
-- ON CONFLICT (operario_id, dia_semana) DO NOTHING → idempotente: no toca
-- los horarios que ya hubiera.

INSERT INTO public.horarios_operario (
  operario_id, dia_semana, hora_entrada, hora_salida,
  pausa_inicio, pausa_fin, pausas, horas_teoricas, activo
)
SELECT
  o.id,
  d,
  '07:00'::time,
  '16:00'::time,
  '14:00'::time,                              -- pausa_inicio (legacy, comida)
  '15:00'::time,                              -- pausa_fin (legacy)
  '[
    {"hora_inicio":"10:00","minutos":30},
    {"hora_inicio":"14:00","minutos":60}
  ]'::jsonb,
  7.5,                                        -- 9h jornada - 1.5h pausas
  true
FROM public.operarios o
CROSS JOIN generate_series(1, 5) AS d
WHERE o.activo = true
ON CONFLICT (operario_id, dia_semana) DO NOTHING;

COMMIT;

-- ============================================================
-- VERIFICACION
-- ============================================================
-- SELECT o.nombre, h.dia_semana, h.hora_entrada, h.hora_salida, h.pausas
-- FROM public.horarios_operario h
-- JOIN public.operarios o ON o.id = h.operario_id
-- ORDER BY o.nombre, h.dia_semana;
