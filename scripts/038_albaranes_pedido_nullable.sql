-- =====================================================================
-- 038_albaranes_pedido_nullable.sql
-- =====================================================================
--
-- Mario punto bug: al crear albaran de RECEPCION (cliente nos trae
-- piezas) no hay pedido todavia. Hace falta que albaranes.pedido_id
-- pueda ser null.
--
-- Solo afecta a albaranes con tipo='recepcion'. Los de entrega siguen
-- exigiendo pedido por la lógica de servicio.
-- =====================================================================

ALTER TABLE public.albaranes
  ALTER COLUMN pedido_id DROP NOT NULL;

COMMENT ON COLUMN public.albaranes.pedido_id IS
  'NULL solo permitido para albaranes de tipo=recepcion sin pedido vinculado todavia. Los de entrega siempre llevan pedido.';

NOTIFY pgrst, 'reload schema';

-- ROLLBACK
-- ALTER TABLE public.albaranes ALTER COLUMN pedido_id SET NOT NULL;
