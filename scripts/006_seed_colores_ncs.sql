-- =====================================================
-- TURIAVAL CRM - MIGRACIÓN 006
-- Carga de colores NCS — Blancos, Grises, Neutros y Negros
-- Fecha: 19 de abril de 2026
--
-- QUÉ HACE:
--   Inserta ~70 colores NCS de la gama neutra (N = neutro).
--   Estos son los más usados en lacados de interiores:
--   blancos puros, blancos cálidos, grises claros, medios, oscuros y negros.
--   ON CONFLICT no duplica si ya existen.
--
-- CÓMO EJECUTARLO:
--   Supabase (proyecto oakkoouczwmipomacewh) → SQL Editor → pegar → Run
--
-- NOTA: ejecutar en el proyecto TURIVAL correcto (oakkoouczwmipomacewh),
--   NO en el proyecto viejo (inonpeqturtyrxixaowz).
-- =====================================================

INSERT INTO colores (codigo, nombre, tipo, hex_aproximado, sobrecoste, activo) VALUES

  -- =====================================================
  -- NCS BLANCOS PUROS (S 0300-N a S 0502-N)
  -- Los más blancos del sistema NCS
  -- =====================================================
  ('NCS S 0300-N', 'Blanco puro NCS',           'NCS', '#F5F5F0', 0, true),
  ('NCS S 0500-N', 'Blanco NCS',                'NCS', '#F0F0EB', 0, true),
  ('NCS S 0502-Y', 'Blanco cálido',             'NCS', '#F2F0E6', 0, true),
  ('NCS S 0502-G', 'Blanco verdoso',            'NCS', '#EFF2ED', 0, true),
  ('NCS S 0502-B', 'Blanco azulado',            'NCS', '#EDF0F2', 0, true),
  ('NCS S 0502-R', 'Blanco rosado',             'NCS', '#F2EDEE', 0, true),
  ('NCS S 0500-N', 'Blanco neutro NCS',         'NCS', '#EFEFE9', 0, true),

  -- =====================================================
  -- NCS BLANCOS ROTOS Y HUESO (S 0804 a S 1002)
  -- Los típicos "blanco roto" que se piden mucho
  -- =====================================================
  ('NCS S 0804-Y30R', 'Blanco hueso cálido',    'NCS', '#EDE5D4', 0, true),
  ('NCS S 0804-Y50R', 'Blanco hueso',           'NCS', '#EDE3D6', 0, true),
  ('NCS S 0804-G80Y', 'Blanco arena suave',     'NCS', '#EAE6D2', 0, true),
  ('NCS S 1002-Y', 'Blanco antiguo cálido',     'NCS', '#E6E2D2', 0, true),
  ('NCS S 1002-G', 'Blanco antiguo verdoso',    'NCS', '#E2E5DA', 0, true),
  ('NCS S 1002-B', 'Blanco antiguo azulado',    'NCS', '#E0E3E5', 0, true),
  ('NCS S 1002-R', 'Blanco antiguo rosado',     'NCS', '#E5E0DE', 0, true),
  ('NCS S 1005-Y20R', 'Marfil NCS',             'NCS', '#E3DCCB', 0, true),
  ('NCS S 1005-Y50R', 'Crema claro',            'NCS', '#E3DACF', 0, true),
  ('NCS S 1005-G80Y', 'Arena claro',            'NCS', '#E0DFC9', 0, true),

  -- =====================================================
  -- NCS GRISES MUY CLAROS (S 1000-N a S 1502-N)
  -- =====================================================
  ('NCS S 1000-N', 'Gris muy claro NCS',        'NCS', '#E5E5E0', 0, true),
  ('NCS S 1500-N', 'Gris perla NCS',            'NCS', '#D8D8D3', 0, true),
  ('NCS S 1502-Y', 'Gris perla cálido',         'NCS', '#D9D7CB', 0, true),
  ('NCS S 1502-G', 'Gris perla verdoso',        'NCS', '#D4D8D1', 0, true),
  ('NCS S 1502-B', 'Gris perla azulado',        'NCS', '#D3D6D8', 0, true),
  ('NCS S 1502-R', 'Gris perla rosado',         'NCS', '#D8D4D3', 0, true),

  -- =====================================================
  -- NCS GRISES CLAROS (S 2000-N a S 2502-N)
  -- =====================================================
  ('NCS S 2000-N', 'Gris claro NCS',            'NCS', '#CBCBC6', 0, true),
  ('NCS S 2500-N', 'Gris plata NCS',            'NCS', '#BDBDB8', 0, true),
  ('NCS S 2002-Y', 'Gris claro cálido',         'NCS', '#C5C3B5', 0, true),
  ('NCS S 2002-G', 'Gris claro verdoso',        'NCS', '#BFC4BB', 0, true),
  ('NCS S 2002-B', 'Gris claro azulado',        'NCS', '#BDC1C4', 0, true),
  ('NCS S 2002-R', 'Gris claro rosado',         'NCS', '#C4BFBD', 0, true),
  ('NCS S 2005-Y20R', 'Gris arena claro',       'NCS', '#C2BDA9', 0, true),

  -- =====================================================
  -- NCS GRISES MEDIOS (S 3000-N a S 3502-N)
  -- =====================================================
  ('NCS S 3000-N', 'Gris medio NCS',            'NCS', '#B0B0AB', 0, true),
  ('NCS S 3500-N', 'Gris medio oscuro NCS',     'NCS', '#9E9E99', 0, true),
  ('NCS S 3002-Y', 'Gris medio cálido',         'NCS', '#ACA99A', 0, true),
  ('NCS S 3002-G', 'Gris medio verdoso',        'NCS', '#A5AAA0', 0, true),
  ('NCS S 3002-B', 'Gris medio azulado',        'NCS', '#A3A7AA', 0, true),
  ('NCS S 3002-R', 'Gris medio rosado',         'NCS', '#AAA4A2', 0, true),
  ('NCS S 3005-Y20R', 'Gris arena medio',       'NCS', '#A8A28E', 0, true),

  -- =====================================================
  -- NCS GRISES OSCUROS (S 4000-N a S 5000-N)
  -- =====================================================
  ('NCS S 4000-N', 'Gris oscuro NCS',           'NCS', '#969691', 0, true),
  ('NCS S 4500-N', 'Gris pizarra claro',        'NCS', '#858580', 0, true),
  ('NCS S 4502-Y', 'Gris oscuro cálido',        'NCS', '#908D7F', 0, true),
  ('NCS S 4502-G', 'Gris oscuro verdoso',       'NCS', '#8A8F86', 0, true),
  ('NCS S 4502-B', 'Gris oscuro azulado',       'NCS', '#888C8F', 0, true),
  ('NCS S 5000-N', 'Gris intenso NCS',          'NCS', '#7B7B76', 0, true),
  ('NCS S 5500-N', 'Gris carbón claro',         'NCS', '#6B6B66', 0, true),
  ('NCS S 5502-Y', 'Gris intenso cálido',       'NCS', '#767363', 0, true),
  ('NCS S 5502-G', 'Gris intenso verdoso',      'NCS', '#6F746B', 0, true),
  ('NCS S 5502-B', 'Gris intenso azulado',      'NCS', '#6D7174', 0, true),

  -- =====================================================
  -- NCS GRISES MUY OSCUROS (S 6000-N a S 7000-N)
  -- =====================================================
  ('NCS S 6000-N', 'Gris grafito NCS',          'NCS', '#656560', 0, true),
  ('NCS S 6500-N', 'Gris antracita NCS',        'NCS', '#565651', 0, true),
  ('NCS S 6502-Y', 'Gris grafito cálido',       'NCS', '#605D4F', 0, true),
  ('NCS S 6502-B', 'Gris grafito azulado',      'NCS', '#565A5D', 0, true),
  ('NCS S 7000-N', 'Gris muy oscuro NCS',       'NCS', '#4D4D48', 0, true),
  ('NCS S 7500-N', 'Gris oscuro profundo',      'NCS', '#3F3F3A', 0, true),
  ('NCS S 7502-Y', 'Gris pardo oscuro',         'NCS', '#4A4739', 0, true),
  ('NCS S 7502-B', 'Gris acero oscuro',         'NCS', '#424649', 0, true),

  -- =====================================================
  -- NCS CASI NEGROS Y NEGROS (S 8000-N a S 9000-N)
  -- =====================================================
  ('NCS S 8000-N', 'Gris negruzco NCS',         'NCS', '#363631', 0, true),
  ('NCS S 8500-N', 'Casi negro NCS',            'NCS', '#2A2A25', 0, true),
  ('NCS S 8502-Y', 'Negro cálido NCS',          'NCS', '#302D22', 0, true),
  ('NCS S 8502-B', 'Negro azulado NCS',         'NCS', '#282C2F', 0, true),
  ('NCS S 9000-N', 'Negro NCS',                 'NCS', '#1A1A17', 0, true)

ON CONFLICT (codigo) DO NOTHING;


-- =====================================================
-- VERIFICACIÓN
-- =====================================================
DO $$
DECLARE
  v_total INTEGER;
  v_ral INTEGER;
  v_ncs INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM colores;
  SELECT COUNT(*) INTO v_ral FROM colores WHERE tipo = 'RAL';
  SELECT COUNT(*) INTO v_ncs FROM colores WHERE tipo = 'NCS';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'MIGRACIÓN 006 - NCS NEUTROS COMPLETADA';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Colores RAL:     %', v_ral;
  RAISE NOTICE 'Colores NCS:     %', v_ncs;
  RAISE NOTICE 'Total colores:   %', v_total;
  RAISE NOTICE '===========================================';
END $$;


-- =====================================================
-- 🔴 ROLLBACK
-- =====================================================
/*
DELETE FROM colores WHERE tipo = 'NCS' AND codigo LIKE 'NCS S %';
*/
