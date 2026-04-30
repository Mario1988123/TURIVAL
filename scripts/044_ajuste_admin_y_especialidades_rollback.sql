-- ============================================================
-- 044_ajuste_admin_y_especialidades_rollback.sql
-- ------------------------------------------------------------
-- Revierte:
--   1) NO desactiva el admin de Mario (rollback no destructivo).
--   2) Vuelve al catalogo de especialidades del 043 original.
-- ============================================================

BEGIN;

-- Borrar los slugs nuevos del 044 (si no estan asignados)
DELETE FROM public.operario_especialidades
WHERE especialidad_id IN (
  SELECT id FROM public.especialidades WHERE slug IN ('finalizado','auxiliar','encargado','lacador')
);
DELETE FROM public.especialidades WHERE slug IN ('finalizado','auxiliar','encargado');

-- Volver lacador → pintor (caso no haya sido ya pintor antes)
UPDATE public.especialidades
SET slug = 'pintor', nombre = 'Pintor / Lacador', color = '#a855f7', orden = 40
WHERE slug = 'lacador';

-- Restaurar montador y embalador
INSERT INTO public.especialidades (slug, nombre, color, orden) VALUES
  ('montador',  'Montador',  '#f59e0b', 50),
  ('embalador', 'Embalador', '#64748b', 60)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
