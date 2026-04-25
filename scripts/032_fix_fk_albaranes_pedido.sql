-- =====================================================================
-- 032_fix_fk_albaranes_pedido.sql
-- =====================================================================
--
-- Añade la FK albaranes.pedido_id → pedidos.id que faltaba en el schema.
-- Síntoma: /albaranes devolvía error "no se ha podido cargar albaranes"
-- porque la query usaba embed `pedido:pedidos(...)` y PostgREST necesita
-- una FK declarada para resolver el embed.
--
-- Workaround mientras no se ejecute: lib/services/albaranes.ts hace join
-- manual en JS (dos queries). Una vez aplicado este script, se puede
-- volver a embed anidado (no obligatorio: el join manual es igual de
-- correcto y una query adicional cabe de sobra).
--
-- Riesgo: BAJO. Solo añade una restricción FK. No modifica datos.
-- =====================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'albaranes_pedido_id_fkey'
  ) THEN
    ALTER TABLE public.albaranes
      ADD CONSTRAINT albaranes_pedido_id_fkey
      FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Verificación
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid='public.albaranes'::regclass AND contype='f';

-- Rollback
-- ALTER TABLE public.albaranes DROP CONSTRAINT IF EXISTS albaranes_pedido_id_fkey;
