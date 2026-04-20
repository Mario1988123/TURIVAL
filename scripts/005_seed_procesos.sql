-- =====================================================================
-- 005 — SEED DATA: procesos base y niveles de complejidad
-- =====================================================================
-- Inserta los 9 procesos maestros de Turiaval y los 3 niveles de
-- complejidad iniciales. Idempotente (ON CONFLICT DO NOTHING).
-- NOTA: los 9 procesos aquí son los "genéricos" iniciales que v0
-- generó. En la Capa 2 v2 (script 012) se alinean con los nombres
-- reales del negocio de Mario.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NIVELES DE COMPLEJIDAD (simple / media / compleja)
-- ---------------------------------------------------------------------
INSERT INTO niveles_complejidad (codigo, nombre, multiplicador, descripcion, orden, activo) VALUES
  ('SIMPLE',   'Simple',   0.80, 'Pieza sencilla sin detalles especiales',     1, TRUE),
  ('MEDIA',    'Media',    1.00, 'Pieza con complejidad estándar',              2, TRUE),
  ('COMPLEJA', 'Compleja', 1.30, 'Pieza con detalles, tallado o repintado',    3, TRUE)
ON CONFLICT (codigo) DO NOTHING;


-- ---------------------------------------------------------------------
-- 2. PROCESOS CATÁLOGO (9 procesos maestros)
-- ---------------------------------------------------------------------
-- Orden típico: 1=Recepción, 2=Lijado, 3=Fondo, 4=Lacado, 5=Secado,
-- 6=Manipulado, 7=Terminación, 8=Empaquetado, 9=Listo entrega
-- ---------------------------------------------------------------------
INSERT INTO procesos_catalogo 
  (codigo, nombre, orden_tipico, color_gantt, permite_repetir, es_tiempo_espera, requiere_operario, descripcion, activo) 
VALUES
  ('RECEPCION',     'Recepción',      1, '#64748b', FALSE, FALSE, TRUE,  'Recepción y comprobación de piezas del cliente',              TRUE),
  ('LIJADO',        'Lijado',         2, '#f59e0b', TRUE,  FALSE, TRUE,  'Lijado de superficies',                                       TRUE),
  ('FONDO',         'Fondo',          3, '#eab308', TRUE,  FALSE, TRUE,  'Aplicación de capa de fondo',                                 TRUE),
  ('LACADO',        'Lacado',         4, '#3b82f6', TRUE,  FALSE, TRUE,  'Aplicación de lacado final',                                  TRUE),
  ('SECADO',        'Secado',         5, '#06b6d4', FALSE, TRUE,  FALSE, 'Tiempo de secado entre capas o final',                        TRUE),
  ('MANIPULADO',    'Manipulado',     6, '#8b5cf6', TRUE,  FALSE, TRUE,  'Manipulación post-lacado (herrajes, ensamblajes)',            TRUE),
  ('TERMINACION',   'Terminación',    7, '#10b981', FALSE, FALSE, TRUE,  'Acabados finales y repaso',                                   TRUE),
  ('EMPAQUETADO',   'Empaquetado',    8, '#22c55e', FALSE, FALSE, TRUE,  'Protección y embalaje para envío',                            TRUE),
  ('LISTO_ENTREGA', 'Listo entrega',  9, '#16a34a', FALSE, FALSE, FALSE, 'Pieza lista para entrega al cliente',                         TRUE)
ON CONFLICT (codigo) DO NOTHING;


-- ---------------------------------------------------------------------
-- 3. CARROS (3 carros de ejemplo)
-- ---------------------------------------------------------------------
INSERT INTO carros (codigo, nombre, capacidad_piezas, capacidad_m2, activo) VALUES
  ('CARRO-01', 'Carro 1', 20, 15, TRUE),
  ('CARRO-02', 'Carro 2', 20, 15, TRUE),
  ('CARRO-03', 'Carro 3', 20, 15, TRUE)
ON CONFLICT (codigo) DO NOTHING;
