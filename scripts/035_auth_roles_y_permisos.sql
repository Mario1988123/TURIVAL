-- =====================================================================
-- 035_auth_roles_y_permisos.sql
-- =====================================================================
--
-- Sistema de ROLES y PERMISOS POR MODULO. Pedido por Mario el 25-abr.
--
-- Concepto:
--   - Cada usuario de auth.users tiene un perfil en `usuario_perfiles`
--     con un rol (admin / operario / cliente) y la lista de modulos
--     que puede ver.
--   - Los admin pueden ver todo y crear otros admin.
--   - Los operarios ven solo los modulos que el admin les active.
--   - Los clientes entran via token (no tocan estas tablas) y solo
--     ven el detalle de SUS piezas (ya cubierto por /p/[token]).
--
-- Tablas:
--   1) usuario_perfiles: user_id (FK a auth.users), rol, nombre,
--                        modulos_permitidos (text[]), created_by
--
-- Modulos disponibles (slug fijo, debe coincidir con la sidebar):
--   dashboard, presupuestos, pedidos, planificador, produccion,
--   agenda, albaranes, etiquetas, fichajes, materiales, productos,
--   tarifas, tratamientos, trazabilidad, informes, configuracion
--
-- RLS: por ahora NO activamos RLS estricto (Mario esta solo y el
-- frontend ya filtra por rol). Cuando entren operarios reales se
-- añade en script posterior.
--
-- Idempotente: usa IF NOT EXISTS y ON CONFLICT.
-- =====================================================================

BEGIN;

-- 1) Tabla usuario_perfiles
CREATE TABLE IF NOT EXISTS public.usuario_perfiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('admin', 'operario', 'cliente')),
  nombre text,
  email text,
  modulos_permitidos text[] NOT NULL DEFAULT ARRAY[]::text[],
  activo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuario_perfiles_rol
  ON public.usuario_perfiles (rol);

CREATE INDEX IF NOT EXISTS idx_usuario_perfiles_activo
  ON public.usuario_perfiles (activo) WHERE activo = true;

-- 2) Trigger para updated_at
CREATE OR REPLACE FUNCTION public.touch_usuario_perfiles()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_usuario_perfiles ON public.usuario_perfiles;
CREATE TRIGGER trg_touch_usuario_perfiles
  BEFORE UPDATE ON public.usuario_perfiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_usuario_perfiles();

-- 3) Funcion auxiliar: obtener_rol_usuario
-- Devuelve { rol, modulos_permitidos } para el usuario actual.
-- Si no hay perfil registrado, devuelve null (frontend redirige).
CREATE OR REPLACE FUNCTION public.obtener_perfil_actual()
RETURNS TABLE(
  user_id uuid,
  rol text,
  nombre text,
  email text,
  modulos_permitidos text[],
  activo boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT user_id, rol, nombre, email, modulos_permitidos, activo
  FROM public.usuario_perfiles
  WHERE user_id = auth.uid()
    AND activo = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.obtener_perfil_actual() TO authenticated;

-- 4) Funcion: crear_perfil_para_usuario (la usa /api/admin/crear-usuario)
-- Solo admins pueden llamarla. Crea o actualiza el perfil de un user_id
-- ya creado en auth.users (Mario crea el user en Supabase Auth y
-- luego le asigna rol con esta funcion).
CREATE OR REPLACE FUNCTION public.asignar_rol_usuario(
  p_user_id uuid,
  p_rol text,
  p_nombre text,
  p_email text,
  p_modulos text[]
)
RETURNS public.usuario_perfiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_rol text;
  v_resultado public.usuario_perfiles;
BEGIN
  -- Validar que quien llama es admin
  SELECT rol INTO v_caller_rol
  FROM public.usuario_perfiles
  WHERE user_id = auth.uid() AND activo = true;

  IF v_caller_rol IS NULL OR v_caller_rol != 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden asignar roles';
  END IF;

  -- Validar rol permitido
  IF p_rol NOT IN ('admin', 'operario', 'cliente') THEN
    RAISE EXCEPTION 'Rol invalido: %', p_rol;
  END IF;

  -- Upsert
  INSERT INTO public.usuario_perfiles (
    user_id, rol, nombre, email, modulos_permitidos, created_by, activo
  ) VALUES (
    p_user_id, p_rol, p_nombre, p_email, p_modulos, auth.uid(), true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    rol = EXCLUDED.rol,
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    modulos_permitidos = EXCLUDED.modulos_permitidos,
    activo = true
  RETURNING * INTO v_resultado;

  RETURN v_resultado;
END $$;

GRANT EXECUTE ON FUNCTION public.asignar_rol_usuario(uuid, text, text, text, text[]) TO authenticated;

-- 5) Funcion: listar_perfiles (admin only)
CREATE OR REPLACE FUNCTION public.listar_perfiles_admin()
RETURNS SETOF public.usuario_perfiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_rol text;
BEGIN
  SELECT rol INTO v_caller_rol
  FROM public.usuario_perfiles
  WHERE user_id = auth.uid() AND activo = true;
  IF v_caller_rol IS NULL OR v_caller_rol != 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede listar perfiles';
  END IF;
  RETURN QUERY SELECT * FROM public.usuario_perfiles ORDER BY created_at DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.listar_perfiles_admin() TO authenticated;

-- 6) BOOTSTRAP del primer admin (Mario)
-- Hay que crear primero el usuario en Supabase Auth (Authentication ->
-- Add user) con email mario.ortigueira@me.com y password Mario.:123,
-- y luego ejecutar el siguiente bloque MANUALMENTE despues de obtener
-- el user_id desde auth.users:
--
--   INSERT INTO public.usuario_perfiles (user_id, rol, nombre, email, modulos_permitidos)
--   VALUES (
--     (SELECT id FROM auth.users WHERE email = 'mario.ortigueira@me.com'),
--     'admin',
--     'Mario Ortigueira',
--     'mario.ortigueira@me.com',
--     ARRAY['*']
--   ) ON CONFLICT (user_id) DO UPDATE SET rol = 'admin', modulos_permitidos = ARRAY['*'];

COMMIT;

-- Refrescar cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.listar_perfiles_admin();
-- DROP FUNCTION IF EXISTS public.asignar_rol_usuario(uuid, text, text, text, text[]);
-- DROP FUNCTION IF EXISTS public.obtener_perfil_actual();
-- DROP TRIGGER IF EXISTS trg_touch_usuario_perfiles ON public.usuario_perfiles;
-- DROP FUNCTION IF EXISTS public.touch_usuario_perfiles();
-- DROP TABLE IF EXISTS public.usuario_perfiles;
-- NOTIFY pgrst, 'reload schema';
