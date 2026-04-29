-- ============================================================
-- 043_especialidades_operario.sql
-- ------------------------------------------------------------
-- Sistema de ESPECIALIDADES de operario (lijador, fondeador, pintor...).
--
-- El campo `operarios.rol` actual solo permite UNA especialidad por
-- operario. Mario quiere que un operario pueda tener VARIAS (ej: Pepe
-- es lijador Y fondeador) para poder ser candidato en varias tareas.
--
-- Estructura:
--   - especialidades: catalogo de especialidades disponibles.
--   - operario_especialidades: pivote N:M.
--   - operarios.rol queda como "rol primario" (retrocompat) — opcional.
--
-- ROLLBACK: scripts/043_especialidades_operario_rollback.sql
-- ============================================================

BEGIN;

-- ---------- 1) Tabla catalogo de especialidades ----------
CREATE TABLE IF NOT EXISTS public.especialidades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  color       text NOT NULL DEFAULT '#64748b',
  orden       integer NOT NULL DEFAULT 0,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_especialidades_activo ON public.especialidades(activo);

-- Seeds basicos para Turiaval (Mario podra editar / añadir mas)
INSERT INTO public.especialidades (slug, nombre, color, orden) VALUES
  ('lijador',     'Lijador',     '#2563eb', 10),
  ('masillador',  'Masillador',  '#0d9488', 20),
  ('fondeador',   'Fondeador',   '#dc2626', 30),
  ('pintor',      'Pintor / Lacador', '#a855f7', 40),
  ('montador',    'Montador',    '#f59e0b', 50),
  ('embalador',   'Embalador',   '#64748b', 60)
ON CONFLICT (slug) DO NOTHING;

-- ---------- 2) Tabla pivote operario_especialidades ----------
CREATE TABLE IF NOT EXISTS public.operario_especialidades (
  operario_id      uuid NOT NULL REFERENCES public.operarios(id)        ON DELETE CASCADE,
  especialidad_id  uuid NOT NULL REFERENCES public.especialidades(id)   ON DELETE RESTRICT,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operario_id, especialidad_id)
);

CREATE INDEX IF NOT EXISTS idx_oe_operario      ON public.operario_especialidades(operario_id);
CREATE INDEX IF NOT EXISTS idx_oe_especialidad  ON public.operario_especialidades(especialidad_id);

-- ---------- 3) Migracion suave del campo operarios.rol ----------
-- Si operarios.rol coincide (case-insensitive) con un slug/nombre del
-- catalogo, lo añadimos al pivote. NO borramos operarios.rol (queda como
-- rol primario / retrocompat).
INSERT INTO public.operario_especialidades (operario_id, especialidad_id)
SELECT o.id, e.id
FROM public.operarios o
JOIN public.especialidades e
  ON lower(o.rol) IN (e.slug, lower(e.nombre))
WHERE o.rol IS NOT NULL
ON CONFLICT (operario_id, especialidad_id) DO NOTHING;

-- ---------- 4) RLS ----------
ALTER TABLE public.especialidades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operario_especialidades   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS especialidades_select_all  ON public.especialidades;
DROP POLICY IF EXISTS especialidades_modify_auth ON public.especialidades;
CREATE POLICY especialidades_select_all  ON public.especialidades FOR SELECT TO authenticated USING (true);
CREATE POLICY especialidades_modify_auth ON public.especialidades FOR ALL    TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS oe_select_all  ON public.operario_especialidades;
DROP POLICY IF EXISTS oe_modify_auth ON public.operario_especialidades;
CREATE POLICY oe_select_all  ON public.operario_especialidades FOR SELECT TO authenticated USING (true);
CREATE POLICY oe_modify_auth ON public.operario_especialidades FOR ALL    TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;
