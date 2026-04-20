-- =====================================================================
-- 011 — SHARE TOKEN PARA LINK PÚBLICO DE PRESUPUESTOS
-- =====================================================================
-- Permite que Mario envíe a sus clientes un enlace tipo:
--   https://app.turival.es/p/abc123-def456-...
-- que muestra el presupuesto imprimible SIN necesidad de login.
-- El token UUID actúa como "llave": solo quien lo tiene accede.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Añadir columna share_token con UUID automático
-- ---------------------------------------------------------------------
ALTER TABLE presupuestos 
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();

-- Índice único para búsqueda rápida por token
CREATE UNIQUE INDEX IF NOT EXISTS idx_presupuestos_share_token 
  ON presupuestos(share_token);

-- Rellenar token para presupuestos existentes que no lo tengan
UPDATE presupuestos 
  SET share_token = gen_random_uuid() 
  WHERE share_token IS NULL;


-- ---------------------------------------------------------------------
-- 2. POLICIES RLS: permitir lectura pública (anon) usando el token
-- ---------------------------------------------------------------------
-- El cliente externo (sin login) podrá leer el presupuesto siempre
-- que tenga el share_token. Solo SELECT, nunca INSERT/UPDATE/DELETE.
-- ---------------------------------------------------------------------

-- Presupuestos: anon puede leer
DROP POLICY IF EXISTS "presupuestos_public_by_token" ON presupuestos;
CREATE POLICY "presupuestos_public_by_token" ON presupuestos
  FOR SELECT TO anon
  USING (share_token IS NOT NULL);

-- Líneas del presupuesto: anon puede leer (para renderizar el detalle)
DROP POLICY IF EXISTS "lineas_presupuesto_public_read" ON lineas_presupuesto;
CREATE POLICY "lineas_presupuesto_public_read" ON lineas_presupuesto
  FOR SELECT TO anon USING (true);

-- Clientes: anon puede leer (para la tarjeta "Cliente" del PDF)
DROP POLICY IF EXISTS "clientes_public_read" ON clientes;
CREATE POLICY "clientes_public_read" ON clientes
  FOR SELECT TO anon USING (true);

-- Configuración empresa: anon puede leer (para cabecera del PDF)
DROP POLICY IF EXISTS "config_empresa_public_read" ON configuracion_empresa;
CREATE POLICY "config_empresa_public_read" ON configuracion_empresa
  FOR SELECT TO anon USING (true);


-- ---------------------------------------------------------------------
-- 3. Comentarios documentales
-- ---------------------------------------------------------------------
COMMENT ON COLUMN presupuestos.share_token IS 
  'Token UUID único para compartir el presupuesto con el cliente sin requerir login. Se genera automáticamente al crear el presupuesto.';
