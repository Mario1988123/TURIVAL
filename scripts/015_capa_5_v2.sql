-- ============================================================
-- SCRIPT 015 v2 — CAPA 5 PRODUCCIÓN + TRAZABILIDAD
-- ============================================================
-- Versión sin PL/pgSQL. SQL plano e idempotente:
-- se puede reejecutar aunque el 015 original haya aplicado
-- parte de los cambios (usa IF NOT EXISTS / IF EXISTS).
--
-- Si al ejecutar sigue fallando algún paso concreto, el resto
-- está escrito de forma que los pasos posteriores aún pueden
-- aplicarse ejecutándolos sueltos.
-- ============================================================


-- ============ 1. TABLA OPERARIOS ============
CREATE TABLE IF NOT EXISTS operarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  rol         text,
  color       text NOT NULL DEFAULT '#64748b',
  activo      boolean NOT NULL DEFAULT true,
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operarios_activo ON operarios(activo);
CREATE INDEX IF NOT EXISTS idx_operarios_rol    ON operarios(rol);


-- ============ 2. PIVOTE OPERARIOS_TAREAS_CANDIDATOS ============
CREATE TABLE IF NOT EXISTS operarios_tareas_candidatos (
  tarea_id     uuid NOT NULL REFERENCES tareas_produccion(id) ON DELETE CASCADE,
  operario_id  uuid NOT NULL REFERENCES operarios(id)         ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tarea_id, operario_id)
);
CREATE INDEX IF NOT EXISTS idx_otc_tarea    ON operarios_tareas_candidatos(tarea_id);
CREATE INDEX IF NOT EXISTS idx_otc_operario ON operarios_tareas_candidatos(operario_id);


-- ============ 3. CAMPOS NUEVOS EN PROCESOS_CATALOGO ============
ALTER TABLE procesos_catalogo
  ADD COLUMN IF NOT EXISTS abreviatura            text,
  ADD COLUMN IF NOT EXISTS requiere_secado        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiempo_secado_minutos  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rol_operario_requerido text;


-- ============ 4. OVERRIDE EN PROCESOS_PRODUCTO ============
ALTER TABLE procesos_producto
  ADD COLUMN IF NOT EXISTS tiempo_secado_minutos_override integer;


-- ============ 5. CAMPOS NUEVOS EN TAREAS_PRODUCCION ============
ALTER TABLE tareas_produccion
  ADD COLUMN IF NOT EXISTS fecha_fin_secado                   timestamptz,
  ADD COLUMN IF NOT EXISTS forzado_seco                       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS minutos_secado_pendiente_al_forzar integer;


-- ============ 6. AMPLIAR CHECK ESTADO EN TAREAS_PRODUCCION ============
-- Se eliminan los dos nombres de constraint más probables que Postgres
-- o nuestros scripts previos pueden haber usado. IF EXISTS evita error
-- si alguno no existe. Después se añade el CHECK definitivo.
ALTER TABLE tareas_produccion
  DROP CONSTRAINT IF EXISTS tareas_produccion_estado_check;
ALTER TABLE tareas_produccion
  DROP CONSTRAINT IF EXISTS tareas_produccion_check;

ALTER TABLE tareas_produccion
  ADD CONSTRAINT tareas_produccion_estado_check
  CHECK (estado IN (
    'pendiente','en_cola','en_progreso','en_secado',
    'completada','incidencia','anulada'
  ));


-- ============ 7. TRIGGER updated_at EN OPERARIOS ============
-- Se recrea de forma idempotente (DROP + CREATE sin variables).
DROP TRIGGER IF EXISTS trg_operarios_updated_at ON operarios;
CREATE TRIGGER trg_operarios_updated_at
  BEFORE UPDATE ON operarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============ 8. RLS ============
ALTER TABLE operarios                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE operarios_tareas_candidatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_all_operarios ON operarios;
CREATE POLICY auth_all_operarios
  ON operarios FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all_operarios_tareas_candidatos ON operarios_tareas_candidatos;
CREATE POLICY auth_all_operarios_tareas_candidatos
  ON operarios_tareas_candidatos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ============ 9. SEEDS: ABREVIATURAS ============
UPDATE procesos_catalogo SET abreviatura='C'  WHERE codigo='COMPROB_MATERIAL';
UPDATE procesos_catalogo SET abreviatura='L'  WHERE codigo='LIJADO';
UPDATE procesos_catalogo SET abreviatura='F'  WHERE codigo='FONDO';
UPDATE procesos_catalogo SET abreviatura='L2' WHERE codigo='LIJADO_2';
UPDATE procesos_catalogo SET abreviatura='F2' WHERE codigo='FONDEADO_2';
UPDATE procesos_catalogo SET abreviatura='La' WHERE codigo='LACADO';
UPDATE procesos_catalogo SET abreviatura='T'  WHERE codigo='TERMINACION';
UPDATE procesos_catalogo SET abreviatura='R'  WHERE codigo='RECEPCION';
UPDATE procesos_catalogo SET abreviatura='P'  WHERE codigo='PICKING';


-- ============ 10. SEEDS: TIEMPOS DE SECADO ============
UPDATE procesos_catalogo
SET requiere_secado = true, tiempo_secado_minutos = 240
WHERE codigo IN ('FONDO','FONDEADO_2');

UPDATE procesos_catalogo
SET requiere_secado = true, tiempo_secado_minutos = 480
WHERE codigo = 'LACADO';


-- ============ 11. SEEDS: ROLES SUGERIDOS POR PROCESO ============
UPDATE procesos_catalogo SET rol_operario_requerido='Lijador'
  WHERE codigo IN ('LIJADO','LIJADO_2');
UPDATE procesos_catalogo SET rol_operario_requerido='Fondeador'
  WHERE codigo IN ('FONDO','FONDEADO_2');
UPDATE procesos_catalogo SET rol_operario_requerido='Lacador'
  WHERE codigo='LACADO';
UPDATE procesos_catalogo SET rol_operario_requerido='Oficina'
  WHERE codigo IN ('COMPROB_MATERIAL','RECEPCION');
UPDATE procesos_catalogo SET rol_operario_requerido='Taller'
  WHERE codigo IN ('TERMINACION','PICKING');


-- ============ 12. FUNCIÓN AUXILIAR SIMPLE (sin DECLARE) ============
-- LANGUAGE sql pura — no afecta al bug del SQL Editor.
CREATE OR REPLACE FUNCTION get_operarios_por_rol(p_rol text)
RETURNS TABLE(operario_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT id AS operario_id
  FROM operarios
  WHERE activo = true
    AND rol = p_rol;
$$;


-- ============ FIN DEL SCRIPT 015 v2 ============


-- ============================================================
-- ROLLBACK (NO EJECUTAR salvo revertir)
-- ============================================================
-- DROP FUNCTION IF EXISTS get_operarios_por_rol(text);
--
-- ALTER TABLE tareas_produccion DROP CONSTRAINT IF EXISTS tareas_produccion_estado_check;
-- ALTER TABLE tareas_produccion
--   ADD CONSTRAINT tareas_produccion_estado_check
--   CHECK (estado IN ('pendiente','en_cola','en_progreso','completada','incidencia','anulada'));
--
-- ALTER TABLE tareas_produccion
--   DROP COLUMN IF EXISTS minutos_secado_pendiente_al_forzar,
--   DROP COLUMN IF EXISTS forzado_seco,
--   DROP COLUMN IF EXISTS fecha_fin_secado;
--
-- ALTER TABLE procesos_producto DROP COLUMN IF EXISTS tiempo_secado_minutos_override;
--
-- ALTER TABLE procesos_catalogo
--   DROP COLUMN IF EXISTS rol_operario_requerido,
--   DROP COLUMN IF EXISTS tiempo_secado_minutos,
--   DROP COLUMN IF EXISTS requiere_secado,
--   DROP COLUMN IF EXISTS abreviatura;
--
-- DROP TABLE IF EXISTS operarios_tareas_candidatos;
-- DROP TABLE IF EXISTS operarios CASCADE;
