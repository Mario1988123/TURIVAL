-- =====================================================
-- TURIAVAL CRM - MIGRACIÓN 007
-- Carga de tratamientos + tarifas base
-- Fecha: 19 de abril de 2026
--
-- QUÉ HACE:
--   1. Inserta los tratamientos reales de Turiaval
--   2. Inserta tarifas base para los 6 productos existentes
--
-- EJECUTAR EN: Supabase proyecto oakkoouczwmipomacewh (TURIVAL)
-- =====================================================


-- =====================================================
-- TRATAMIENTOS
-- Son los TIPOS DE SERVICIO que ofreces al cliente.
-- No confundir con procesos (pasos físicos del taller).
-- El multiplicador afecta al precio del presupuesto.
-- =====================================================

INSERT INTO tratamientos (nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo) VALUES
  -- Lacados (el servicio principal)
  ('Lacado estándar',        'Proceso completo: lijado + fondo + lijado + fondo + lacado + secado. El servicio más habitual.',  1.0, 120, true),
  ('Lacado con doble fondo', 'Dos manos de fondo con lijado intermedio para acabado premium.',                                 1.2, 150, true),
  ('Lacado sin fondo',       'Lacado directo sobre pieza ya preparada o relacado.',                                            0.7,  40, true),
  ('Lacado poliuretano',     'Acabado de alta resistencia con pintura poliuretano.',                                           1.5, 140, true),
  ('Lacado texturizado',     'Acabado con textura especial (rugoso, piel naranja, etc.).',                                     1.4, 130, true),

  -- Servicios parciales
  ('Imprimación / Fondo',    'Solo aplicación de fondo sellador, sin lacado final.',                                           0.5,  60, true),
  ('Relacado / Repaso',      'Segunda capa o repaso sobre lacado existente.',                                                  0.6,  50, true),
  ('Lijado solo',            'Solo servicio de lijado, sin fondo ni lacado.',                                                  0.3,  30, true),

  -- Servicios especiales
  ('Lacado bicolor',         'Dos colores en la misma pieza (requiere enmascarado).',                                          1.8, 200, true),
  ('Lacado degradado',       'Transición suave entre dos colores.',                                                            2.0, 240, true),
  ('Acabado mate total',     'Lacado con acabado mate <10 de brillo.',                                                         1.1, 130, true),
  ('Acabado alto brillo',    'Lacado con pulido para brillo espejo.',                                                          1.6, 180, true)
ON CONFLICT DO NOTHING;


-- =====================================================
-- TARIFAS BASE
-- Precios por defecto para los 6 productos existentes.
-- Se usan al crear presupuestos.
-- Mario puede editarlos desde la UI cuando la pantalla esté lista.
--
-- Referencia de producto_id (del seed original):
--   11111111... = Tablero MDF
--   22222222... = Tablero DM
--   33333333... = Puerta
--   44444444... = Frente cajón
--   55555555... = Moldura
--   66666666... = Pieza especial
-- =====================================================

INSERT INTO tarifas (nombre, producto_id, modo_precio, precio_m2, precio_pieza, precio_minimo, activo) VALUES
  -- Tableros (por m²)
  ('Tablero MDF - Lacado estándar',
    '11111111-1111-1111-1111-111111111111', 'm2', 28.00, NULL, 18.00, true),
  ('Tablero MDF - Lacado poliuretano',
    '11111111-1111-1111-1111-111111111111', 'm2', 42.00, NULL, 25.00, true),
  ('Tablero DM - Lacado estándar',
    '22222222-2222-2222-2222-222222222222', 'm2', 25.00, NULL, 15.00, true),
  ('Tablero DM - Lacado poliuretano',
    '22222222-2222-2222-2222-222222222222', 'm2', 38.00, NULL, 22.00, true),

  -- Puertas (por pieza)
  ('Puerta - Lacado estándar',
    '33333333-3333-3333-3333-333333333333', 'pieza', NULL, 55.00, 55.00, true),
  ('Puerta - Lacado poliuretano',
    '33333333-3333-3333-3333-333333333333', 'pieza', NULL, 80.00, 80.00, true),
  ('Puerta - Solo imprimación',
    '33333333-3333-3333-3333-333333333333', 'pieza', NULL, 30.00, 30.00, true),

  -- Frentes de cajón (por pieza)
  ('Frente cajón - Lacado estándar',
    '44444444-4444-4444-4444-444444444444', 'pieza', NULL, 14.00, 10.00, true),
  ('Frente cajón - Lacado poliuretano',
    '44444444-4444-4444-4444-444444444444', 'pieza', NULL, 20.00, 14.00, true),

  -- Molduras (por m²)
  ('Moldura - Lacado estándar',
    '55555555-5555-5555-5555-555555555555', 'm2', 38.00, NULL, 22.00, true),
  ('Moldura - Lacado texturizado',
    '55555555-5555-5555-5555-555555555555', 'm2', 50.00, NULL, 30.00, true),

  -- Piezas especiales (ambos modos disponibles)
  ('Pieza especial - Lacado estándar',
    '66666666-6666-6666-6666-666666666666', 'ambos', 35.00, 30.00, 25.00, true),
  ('Pieza especial - Lacado poliuretano',
    '66666666-6666-6666-6666-666666666666', 'ambos', 50.00, 45.00, 35.00, true),
  ('Pieza especial - Lacado bicolor',
    '66666666-6666-6666-6666-666666666666', 'ambos', 65.00, 55.00, 45.00, true)
ON CONFLICT DO NOTHING;


-- =====================================================
-- VERIFICACIÓN
-- =====================================================
DO $$
DECLARE
  v_trat INTEGER;
  v_tarif INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_trat FROM tratamientos;
  SELECT COUNT(*) INTO v_tarif FROM tarifas;
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'MIGRACIÓN 007 COMPLETADA';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Tratamientos: %', v_trat;
  RAISE NOTICE 'Tarifas:      %', v_tarif;
  RAISE NOTICE '===========================================';
END $$;


-- =====================================================
-- 🔴 ROLLBACK
-- =====================================================
/*
DELETE FROM tarifas;
DELETE FROM tratamientos;
*/
