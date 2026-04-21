-- =====================================================================
-- 022_ampliar_configuracion_empresa.sql
-- R1 del rediseño ERP TURIVAL — paso 5/5
-- =====================================================================
-- QUÉ HACE:
--   Amplía configuracion_empresa con los parámetros globales del ERP:
--     - Rendimientos kg/m² por defecto (lacado y fondo)
--     - Ratios de mezcla (cata y disolvente, separados lacado/fondo)
--     - Coste €/min operario + jornada horas
--     - Margen objetivo %
--     - Ancho mínimo de pistola (cm) — también se usa como ancho del ml
--     - Referencias a materiales catalizador y disolvente por defecto
--
--   Los valores default que dejo:
--     rendimiento_lacado_kg_m2   = 0.12   ← orientativo industria
--     rendimiento_fondo_kg_m2    = 0.15   ← orientativo industria
--     ratio_cata_lacado          = 8      ← 8:1 que me dijiste
--     ratio_dis_lacado           = 4      ← 4:1 que me dijiste
--     ratio_cata_fondo           = 12     ← 12:1 que me dijiste
--     ratio_dis_fondo            = 6      ← 6:1 que me dijiste
--     coste_minuto_operario      = 0.40   ← 0,4€/min que me dijiste
--     jornada_horas              = 8      ← 8h que me dijiste
--     margen_objetivo_porcentaje = 30     ← 30% que me dijiste
--     ancho_minimo_pistola_cm    = 15     ← 15cm que me dijiste
--
--   Los rendimientos los ajustas desde /configuracion en R3 cuando
--   tengas los valores reales que usas en taller.
--
-- ROLLBACK:
--   ALTER TABLE configuracion_empresa
--     DROP COLUMN IF EXISTS rendimiento_lacado_kg_m2,
--     DROP COLUMN IF EXISTS rendimiento_fondo_kg_m2,
--     (etc.)
-- =====================================================================

BEGIN;

ALTER TABLE configuracion_empresa
  -- Rendimientos kg/m² (defaults globales; materiales pueden sobrescribir)
  ADD COLUMN IF NOT EXISTS rendimiento_lacado_kg_m2   numeric NOT NULL DEFAULT 0.12,
  ADD COLUMN IF NOT EXISTS rendimiento_fondo_kg_m2    numeric NOT NULL DEFAULT 0.15,

  -- Ratios de mezcla (X:1 → X partes pintura/fondo por 1 parte componente)
  ADD COLUMN IF NOT EXISTS ratio_cata_lacado          numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS ratio_dis_lacado           numeric NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS ratio_cata_fondo           numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS ratio_dis_fondo            numeric NOT NULL DEFAULT 6,

  -- Coste humano
  ADD COLUMN IF NOT EXISTS coste_minuto_operario      numeric NOT NULL DEFAULT 0.40,
  ADD COLUMN IF NOT EXISTS jornada_horas              numeric NOT NULL DEFAULT 8,

  -- Venta
  ADD COLUMN IF NOT EXISTS margen_objetivo_porcentaje numeric NOT NULL DEFAULT 30,

  -- Motor superficie (ancho mínimo pistola = también ancho del ml)
  ADD COLUMN IF NOT EXISTS ancho_minimo_pistola_cm    numeric NOT NULL DEFAULT 15,

  -- Referencias a materiales default (se auto-asignan abajo a los
  -- placeholders creados en 019)
  ADD COLUMN IF NOT EXISTS material_catalizador_default_id uuid
    REFERENCES materiales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_disolvente_default_id  uuid
    REFERENCES materiales(id) ON DELETE SET NULL;

-- Asignar automáticamente los placeholders como default globales.
-- Si Mario ya los había configurado (no son NULL), no se sobrescribe.
UPDATE configuracion_empresa
   SET material_catalizador_default_id = (
         SELECT id FROM materiales
          WHERE tipo='catalizador' AND codigo='CATA-DEFAULT'
          LIMIT 1),
       material_disolvente_default_id  = (
         SELECT id FROM materiales
          WHERE tipo='disolvente'  AND codigo='DIS-DEFAULT'
          LIMIT 1),
       updated_at = now()
 WHERE id = 1
   AND material_catalizador_default_id IS NULL
   AND material_disolvente_default_id  IS NULL;

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- SELECT
--   rendimiento_lacado_kg_m2, rendimiento_fondo_kg_m2,
--   ratio_cata_lacado, ratio_dis_lacado,
--   ratio_cata_fondo, ratio_dis_fondo,
--   coste_minuto_operario, jornada_horas,
--   margen_objetivo_porcentaje, ancho_minimo_pistola_cm
-- FROM configuracion_empresa WHERE id = 1;
--
-- Debe mostrar:
--   0.12, 0.15, 8, 4, 12, 6, 0.40, 8, 30, 15
--
-- SELECT
--   m_cata.nombre AS catalizador_default,
--   m_dis.nombre  AS disolvente_default
-- FROM configuracion_empresa c
-- LEFT JOIN materiales m_cata ON m_cata.id = c.material_catalizador_default_id
-- LEFT JOIN materiales m_dis  ON m_dis.id  = c.material_disolvente_default_id
-- WHERE c.id = 1;
-- Debe mostrar: "Catalizador por defecto" / "Disolvente por defecto".
-- =====================================================================
