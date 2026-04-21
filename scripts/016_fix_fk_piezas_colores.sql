-- ============================================================
-- SCRIPT 016 — FIX FK piezas.color_id y piezas.tratamiento_id
-- ============================================================
-- Motivo: PostgREST (API de Supabase) necesita FK declarada para
-- resolver joins embebidos como:
--   supabase.from('piezas').select('*, color:colores(...)').
-- Sin la FK da error "Could not find a relationship between
-- 'piezas' and 'colores' in the schema cache".
--
-- El script 014 dejó estas columnas como UUID "sueltos" por diseño
-- snapshot, pero se puede conseguir el mismo efecto con ON DELETE
-- SET NULL, que además es el patrón que ya usa lineas_pedido.
--
-- Riesgo: bajo. Idempotente. Limpia huérfanos a NULL antes de añadir
-- la FK para que el ADD CONSTRAINT no pueda fallar por datos inválidos.
-- ============================================================


-- ============ 1. LIMPIAR HUÉRFANOS (defensivo) ============
-- Si alguna pieza tiene color_id que no existe en colores, lo
-- ponemos a NULL. Así el ADD CONSTRAINT no puede fallar.

UPDATE piezas
SET color_id = NULL
WHERE color_id IS NOT NULL
  AND color_id NOT IN (SELECT id FROM colores);

UPDATE piezas
SET tratamiento_id = NULL
WHERE tratamiento_id IS NOT NULL
  AND tratamiento_id NOT IN (SELECT id FROM tratamientos);


-- ============ 2. AÑADIR FK A piezas.color_id ============
ALTER TABLE piezas
  DROP CONSTRAINT IF EXISTS piezas_color_id_fkey;

ALTER TABLE piezas
  ADD CONSTRAINT piezas_color_id_fkey
  FOREIGN KEY (color_id) REFERENCES colores(id) ON DELETE SET NULL;


-- ============ 3. AÑADIR FK A piezas.tratamiento_id ============
ALTER TABLE piezas
  DROP CONSTRAINT IF EXISTS piezas_tratamiento_id_fkey;

ALTER TABLE piezas
  ADD CONSTRAINT piezas_tratamiento_id_fkey
  FOREIGN KEY (tratamiento_id) REFERENCES tratamientos(id) ON DELETE SET NULL;


-- ============ FIN 016 ============


-- ============================================================
-- ROLLBACK (no ejecutar salvo revertir)
-- ============================================================
-- ALTER TABLE piezas DROP CONSTRAINT IF EXISTS piezas_color_id_fkey;
-- ALTER TABLE piezas DROP CONSTRAINT IF EXISTS piezas_tratamiento_id_fkey;
--
-- Nota: los valores quedan como estaban antes. No se pierde nada.
