-- =====================================================================
-- 010 — CONFIGURACIÓN EMPRESA (singleton) + STORAGE LOGO
-- =====================================================================
-- Crea:
--   · Tabla configuracion_empresa (fila única id=1) con datos fiscales
--     y logo_url apuntando al bucket Storage "empresa-assets"
--   · Policies RLS para el bucket Storage empresa-assets
-- NOTA: el bucket 'empresa-assets' se crea desde la UI de Supabase
-- Storage (marcar como Public), estos SQL solo crean las policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLA configuracion_empresa (singleton id=1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion_empresa (
  id INTEGER PRIMARY KEY DEFAULT 1,
  razon_social TEXT,
  nombre_comercial TEXT,
  cif_nif TEXT,
  direccion TEXT,
  codigo_postal TEXT,
  ciudad TEXT,
  provincia TEXT,
  pais TEXT DEFAULT 'España',
  telefono TEXT,
  email TEXT,
  web TEXT,
  iban TEXT,
  logo_url TEXT,
  texto_pie_presupuesto TEXT,
  condiciones_pago_default TEXT DEFAULT 'Pago a 30 días fecha factura',
  iva_default NUMERIC DEFAULT 21,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT only_one_row CHECK (id = 1)
);

COMMENT ON TABLE configuracion_empresa IS 
  'Configuración global de la empresa emisora (singleton, siempre 1 fila)';
COMMENT ON COLUMN configuracion_empresa.logo_url IS 
  'URL pública del logo subido a Supabase Storage bucket empresa-assets';

-- Insertar fila singleton si no existe
INSERT INTO configuracion_empresa (id, razon_social, nombre_comercial, cif_nif)
VALUES (1, 'TURIAVAL S.L. (por configurar)', 'Turiaval', 'B00000000')
ON CONFLICT (id) DO NOTHING;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_configuracion_empresa_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_configuracion_empresa_updated ON configuracion_empresa;
CREATE TRIGGER trg_configuracion_empresa_updated
  BEFORE UPDATE ON configuracion_empresa
  FOR EACH ROW
  EXECUTE FUNCTION update_configuracion_empresa_timestamp();


-- ---------------------------------------------------------------------
-- 2. RLS tabla configuracion_empresa
-- ---------------------------------------------------------------------
ALTER TABLE configuracion_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_empresa_select" ON configuracion_empresa;
CREATE POLICY "config_empresa_select" ON configuracion_empresa
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "config_empresa_update" ON configuracion_empresa;
CREATE POLICY "config_empresa_update" ON configuracion_empresa
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "config_empresa_insert" ON configuracion_empresa;
CREATE POLICY "config_empresa_insert" ON configuracion_empresa
  FOR INSERT TO authenticated WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 3. STORAGE: políticas para bucket 'empresa-assets'
-- ---------------------------------------------------------------------
-- REQUISITO PREVIO: crear el bucket desde Supabase UI:
--   Storage → New bucket → name=empresa-assets → Public ON
--   Allowed MIME types: image/png, image/jpeg, image/svg+xml, image/webp
--   File size limit: 5 MB
-- ---------------------------------------------------------------------

-- Leer públicamente (necesario para que el logo aparezca en PDF público)
DROP POLICY IF EXISTS "empresa_assets_select" ON storage.objects;
CREATE POLICY "empresa_assets_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'empresa-assets');

-- Subir logo: solo autenticados
DROP POLICY IF EXISTS "empresa_assets_insert" ON storage.objects;
CREATE POLICY "empresa_assets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'empresa-assets');

-- Sobrescribir logo: solo autenticados
DROP POLICY IF EXISTS "empresa_assets_update" ON storage.objects;
CREATE POLICY "empresa_assets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'empresa-assets');

-- Borrar logo: solo autenticados
DROP POLICY IF EXISTS "empresa_assets_delete" ON storage.objects;
CREATE POLICY "empresa_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'empresa-assets');
