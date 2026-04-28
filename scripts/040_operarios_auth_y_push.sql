-- =====================================================================
-- 040_operarios_auth_y_push.sql
-- =====================================================================
-- 1) Vincular operarios con auth.users (cada operario que vaya a
--    fichar desde la app necesita un usuario propio).
-- 2) Tabla push_subscriptions: endpoints Web Push de los navegadores
--    de cada operario (tablet, móvil...) para mandar avisos de
--    fichaje.
-- 3) Tabla recordatorios_fichaje_log: idempotencia, no mandar el
--    mismo aviso 2 veces.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='operarios' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.operarios ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_operarios_user_id ON public.operarios (user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operario_id uuid REFERENCES public.operarios(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  recibe_email boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_push_user ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_push_operario ON public.push_subscriptions (operario_id);

CREATE TABLE IF NOT EXISTS public.recordatorios_fichaje_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id uuid NOT NULL REFERENCES public.operarios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('aviso_entrada','aviso_salida')),
  minutos_antes int NOT NULL,
  enviado_en timestamptz NOT NULL DEFAULT now(),
  canal text NOT NULL CHECK (canal IN ('push','email','ambos')),
  exito boolean NOT NULL DEFAULT true,
  detalle text,
  UNIQUE (operario_id, fecha, tipo, minutos_antes)
);
CREATE INDEX IF NOT EXISTS idx_recordatorios_log ON public.recordatorios_fichaje_log (fecha);

NOTIFY pgrst, 'reload schema';
