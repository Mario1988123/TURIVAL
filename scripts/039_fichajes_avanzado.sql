-- =====================================================================
-- 039_fichajes_avanzado.sql — Modulo fichajes completo (Sesame-like)
-- =====================================================================
-- Tablas nuevas:
--   horarios_operario       horario teorico semanal por operario
--   festivos                calendario de festividades
--   ausencias               vacaciones, baja, permiso, festivo trabajado, etc.
--   documentos_operario     nominas, justificantes, tickets, etc.
--   fichajes_ajustes        log de ajustes manuales por admin
--
-- Extensiones a fichajes existente:
--   ajustado_por uuid (admin que tocó el fichaje)
--   ajustado_en timestamptz
--   motivo_ajuste text
-- =====================================================================

-- 1) Extender fichajes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fichajes' AND column_name='ajustado_por') THEN
    ALTER TABLE public.fichajes ADD COLUMN ajustado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fichajes' AND column_name='ajustado_en') THEN
    ALTER TABLE public.fichajes ADD COLUMN ajustado_en timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fichajes' AND column_name='motivo_ajuste') THEN
    ALTER TABLE public.fichajes ADD COLUMN motivo_ajuste text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fichajes' AND column_name='auto_generado') THEN
    ALTER TABLE public.fichajes ADD COLUMN auto_generado boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2) Horarios teoricos por operario (semanal)
CREATE TABLE IF NOT EXISTS public.horarios_operario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id uuid NOT NULL REFERENCES public.operarios(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom 6=Sab
  hora_entrada time NOT NULL,
  hora_salida time NOT NULL,
  pausa_inicio time,
  pausa_fin time,
  horas_teoricas numeric(4,2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operario_id, dia_semana)
);
CREATE INDEX IF NOT EXISTS idx_horarios_operario ON public.horarios_operario (operario_id);

-- 3) Calendario de festivos
CREATE TABLE IF NOT EXISTS public.festivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL UNIQUE,
  nombre text NOT NULL,
  ambito text NOT NULL DEFAULT 'nacional' CHECK (ambito IN ('nacional','autonomico','local','empresa')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_festivos_fecha ON public.festivos (fecha);

-- 4) Ausencias / permisos
CREATE TABLE IF NOT EXISTS public.ausencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id uuid NOT NULL REFERENCES public.operarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'vacaciones','permiso_retribuido','permiso_no_retribuido',
    'baja_medica','accidente_laboral','asuntos_propios',
    'festivo_trabajado','compensacion_festivo','formacion','otros'
  )),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  horas_compensables numeric(5,2),
  notas text,
  aprobada boolean NOT NULL DEFAULT false,
  aprobada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobada_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ausencias_operario ON public.ausencias (operario_id);
CREATE INDEX IF NOT EXISTS idx_ausencias_rango ON public.ausencias (fecha_inicio, fecha_fin);

-- 5) Documentos del operario
CREATE TABLE IF NOT EXISTS public.documentos_operario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id uuid NOT NULL REFERENCES public.operarios(id) ON DELETE CASCADE,
  categoria text NOT NULL CHECK (categoria IN (
    'nomina','justificante_medico','contrato','baja_alta_ss',
    'ticket_dieta','formacion','otros'
  )),
  nombre text NOT NULL,
  storage_path text NOT NULL,        -- ruta dentro de Supabase Storage
  mime_type text,
  tamano_bytes bigint,
  fecha_documento date,
  notas text,
  subido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_operario ON public.documentos_operario (operario_id);

-- 6) Bucket Storage para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-operarios', 'documentos-operarios', false)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
