-- ============================================================
-- 044_ajuste_admin_y_especialidades.sql
-- ------------------------------------------------------------
-- Dos cosas:
--
-- 1) Garantizar que mario.ortigueira@me.com es admin formal en
--    usuario_perfiles. Algun reset anterior lo dejo como operario.
--
-- 2) Ajustar el catalogo de especialidades del script 043 a la
--    lista real del taller Turiaval:
--       lijador, fondeador, lacador, masillador, finalizado,
--       auxiliar (picking), encargado (recepcion + todos procesos)
--    Quitar las que no se usan (pintor genérico, montador, embalador).
--
-- ROLLBACK: scripts/044_ajuste_admin_y_especialidades_rollback.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1) MARIO ADMIN FORMAL
-- ============================================================
INSERT INTO public.usuario_perfiles (user_id, rol, nombre, email, modulos_permitidos, activo)
SELECT id, 'admin', 'Mario', email, ARRAY['*'], true
FROM auth.users
WHERE email = 'mario.ortigueira@me.com'
ON CONFLICT (user_id) DO UPDATE SET
  rol = 'admin',
  modulos_permitidos = ARRAY['*'],
  activo = true,
  nombre = 'Mario';

-- ============================================================
-- 2) AJUSTE CATALOGO DE ESPECIALIDADES
-- ============================================================

-- 2a) Renombrar 'pintor' → 'lacador' si existia con ese slug
--     (en el 043 lo llamamos "Pintor / Lacador" con slug pintor).
UPDATE public.especialidades
SET slug = 'lacador', nombre = 'Lacador', color = '#a855f7', orden = 30
WHERE slug = 'pintor';

-- 2b) Eliminar las que ya no aplican. Primero quitamos asignaciones
--     huerfanas si alguien las tenia.
DELETE FROM public.operario_especialidades
WHERE especialidad_id IN (
  SELECT id FROM public.especialidades WHERE slug IN ('montador','embalador')
);
DELETE FROM public.especialidades WHERE slug IN ('montador','embalador');

-- 2c) Insertar/actualizar la lista definitiva del taller.
--     ON CONFLICT (slug) → UPDATE: idempotente.
INSERT INTO public.especialidades (slug, nombre, color, orden) VALUES
  ('lijador',     'Lijador',           '#2563eb', 10),
  ('masillador',  'Masillador',        '#0d9488', 20),
  ('fondeador',   'Fondeador',         '#dc2626', 30),
  ('lacador',     'Lacador',           '#a855f7', 40),
  ('finalizado',  'Finalizado',        '#f59e0b', 50),
  ('auxiliar',    'Auxiliar (picking)','#64748b', 60),
  ('encargado',   'Encargado',         '#059669', 70)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  color  = EXCLUDED.color,
  orden  = EXCLUDED.orden,
  activo = true;

COMMIT;

-- ============================================================
-- VERIFICACION (debe listar a Mario como admin y las 7 especialidades)
-- ============================================================
SELECT email, rol, modulos_permitidos FROM public.usuario_perfiles
WHERE email = 'mario.ortigueira@me.com';

SELECT slug, nombre, color, orden FROM public.especialidades
WHERE activo = true ORDER BY orden;
