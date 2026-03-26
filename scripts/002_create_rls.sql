-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE colores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tratamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acabados ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencias_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_presupuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE piezas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fases_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacidad_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE planificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE albaranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_albaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_notificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE secuencias ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES
-- =====================================================
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- =====================================================
-- CLIENTES - Todos los usuarios autenticados pueden ver y gestionar
-- =====================================================
DROP POLICY IF EXISTS "clientes_select" ON clientes;
CREATE POLICY "clientes_select" ON clientes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "clientes_insert" ON clientes;
CREATE POLICY "clientes_insert" ON clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "clientes_update" ON clientes;
CREATE POLICY "clientes_update" ON clientes FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "clientes_delete" ON clientes;
CREATE POLICY "clientes_delete" ON clientes FOR DELETE TO authenticated USING (true);

-- =====================================================
-- CATALOGOS (productos, colores, tratamientos, acabados, tarifas)
-- Todos pueden leer, todos pueden modificar
-- =====================================================

-- PRODUCTOS
DROP POLICY IF EXISTS "productos_select" ON productos;
CREATE POLICY "productos_select" ON productos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "productos_insert" ON productos;
CREATE POLICY "productos_insert" ON productos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "productos_update" ON productos;
CREATE POLICY "productos_update" ON productos FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "productos_delete" ON productos;
CREATE POLICY "productos_delete" ON productos FOR DELETE TO authenticated USING (true);

-- COLORES
DROP POLICY IF EXISTS "colores_select" ON colores;
CREATE POLICY "colores_select" ON colores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "colores_insert" ON colores;
CREATE POLICY "colores_insert" ON colores FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "colores_update" ON colores;
CREATE POLICY "colores_update" ON colores FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "colores_delete" ON colores;
CREATE POLICY "colores_delete" ON colores FOR DELETE TO authenticated USING (true);

-- TRATAMIENTOS
DROP POLICY IF EXISTS "tratamientos_select" ON tratamientos;
CREATE POLICY "tratamientos_select" ON tratamientos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tratamientos_insert" ON tratamientos;
CREATE POLICY "tratamientos_insert" ON tratamientos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "tratamientos_update" ON tratamientos;
CREATE POLICY "tratamientos_update" ON tratamientos FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "tratamientos_delete" ON tratamientos;
CREATE POLICY "tratamientos_delete" ON tratamientos FOR DELETE TO authenticated USING (true);

-- ACABADOS
DROP POLICY IF EXISTS "acabados_select" ON acabados;
CREATE POLICY "acabados_select" ON acabados FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "acabados_insert" ON acabados;
CREATE POLICY "acabados_insert" ON acabados FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "acabados_update" ON acabados;
CREATE POLICY "acabados_update" ON acabados FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "acabados_delete" ON acabados;
CREATE POLICY "acabados_delete" ON acabados FOR DELETE TO authenticated USING (true);

-- TARIFAS
DROP POLICY IF EXISTS "tarifas_select" ON tarifas;
CREATE POLICY "tarifas_select" ON tarifas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tarifas_insert" ON tarifas;
CREATE POLICY "tarifas_insert" ON tarifas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "tarifas_update" ON tarifas;
CREATE POLICY "tarifas_update" ON tarifas FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "tarifas_delete" ON tarifas;
CREATE POLICY "tarifas_delete" ON tarifas FOR DELETE TO authenticated USING (true);

-- =====================================================
-- REFERENCIAS CLIENTE
-- =====================================================
DROP POLICY IF EXISTS "referencias_cliente_select" ON referencias_cliente;
CREATE POLICY "referencias_cliente_select" ON referencias_cliente FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "referencias_cliente_insert" ON referencias_cliente;
CREATE POLICY "referencias_cliente_insert" ON referencias_cliente FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "referencias_cliente_update" ON referencias_cliente;
CREATE POLICY "referencias_cliente_update" ON referencias_cliente FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "referencias_cliente_delete" ON referencias_cliente;
CREATE POLICY "referencias_cliente_delete" ON referencias_cliente FOR DELETE TO authenticated USING (true);

-- =====================================================
-- PRESUPUESTOS Y LINEAS
-- =====================================================
DROP POLICY IF EXISTS "presupuestos_select" ON presupuestos;
CREATE POLICY "presupuestos_select" ON presupuestos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "presupuestos_insert" ON presupuestos;
CREATE POLICY "presupuestos_insert" ON presupuestos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "presupuestos_update" ON presupuestos;
CREATE POLICY "presupuestos_update" ON presupuestos FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "presupuestos_delete" ON presupuestos;
CREATE POLICY "presupuestos_delete" ON presupuestos FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "lineas_presupuesto_select" ON lineas_presupuesto;
CREATE POLICY "lineas_presupuesto_select" ON lineas_presupuesto FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "lineas_presupuesto_insert" ON lineas_presupuesto;
CREATE POLICY "lineas_presupuesto_insert" ON lineas_presupuesto FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "lineas_presupuesto_update" ON lineas_presupuesto;
CREATE POLICY "lineas_presupuesto_update" ON lineas_presupuesto FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "lineas_presupuesto_delete" ON lineas_presupuesto;
CREATE POLICY "lineas_presupuesto_delete" ON lineas_presupuesto FOR DELETE TO authenticated USING (true);

-- =====================================================
-- PEDIDOS, LOTES, PIEZAS
-- =====================================================
DROP POLICY IF EXISTS "pedidos_select" ON pedidos;
CREATE POLICY "pedidos_select" ON pedidos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pedidos_insert" ON pedidos;
CREATE POLICY "pedidos_insert" ON pedidos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "pedidos_update" ON pedidos;
CREATE POLICY "pedidos_update" ON pedidos FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "pedidos_delete" ON pedidos;
CREATE POLICY "pedidos_delete" ON pedidos FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "lotes_select" ON lotes;
CREATE POLICY "lotes_select" ON lotes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "lotes_insert" ON lotes;
CREATE POLICY "lotes_insert" ON lotes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "lotes_update" ON lotes;
CREATE POLICY "lotes_update" ON lotes FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "lotes_delete" ON lotes;
CREATE POLICY "lotes_delete" ON lotes FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "piezas_select" ON piezas;
CREATE POLICY "piezas_select" ON piezas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "piezas_insert" ON piezas;
CREATE POLICY "piezas_insert" ON piezas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "piezas_update" ON piezas;
CREATE POLICY "piezas_update" ON piezas FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "piezas_delete" ON piezas;
CREATE POLICY "piezas_delete" ON piezas FOR DELETE TO authenticated USING (true);

-- =====================================================
-- PRODUCCION
-- =====================================================
DROP POLICY IF EXISTS "fases_produccion_select" ON fases_produccion;
CREATE POLICY "fases_produccion_select" ON fases_produccion FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fases_produccion_insert" ON fases_produccion;
CREATE POLICY "fases_produccion_insert" ON fases_produccion FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "fases_produccion_update" ON fases_produccion;
CREATE POLICY "fases_produccion_update" ON fases_produccion FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "fases_produccion_delete" ON fases_produccion;
CREATE POLICY "fases_produccion_delete" ON fases_produccion FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "capacidad_diaria_select" ON capacidad_diaria;
CREATE POLICY "capacidad_diaria_select" ON capacidad_diaria FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "capacidad_diaria_insert" ON capacidad_diaria;
CREATE POLICY "capacidad_diaria_insert" ON capacidad_diaria FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "capacidad_diaria_update" ON capacidad_diaria;
CREATE POLICY "capacidad_diaria_update" ON capacidad_diaria FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "planificacion_select" ON planificacion;
CREATE POLICY "planificacion_select" ON planificacion FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "planificacion_insert" ON planificacion;
CREATE POLICY "planificacion_insert" ON planificacion FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "planificacion_update" ON planificacion;
CREATE POLICY "planificacion_update" ON planificacion FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "planificacion_delete" ON planificacion;
CREATE POLICY "planificacion_delete" ON planificacion FOR DELETE TO authenticated USING (true);

-- =====================================================
-- ALBARANES Y PAGOS
-- =====================================================
DROP POLICY IF EXISTS "albaranes_select" ON albaranes;
CREATE POLICY "albaranes_select" ON albaranes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "albaranes_insert" ON albaranes;
CREATE POLICY "albaranes_insert" ON albaranes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "albaranes_update" ON albaranes;
CREATE POLICY "albaranes_update" ON albaranes FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "albaranes_delete" ON albaranes;
CREATE POLICY "albaranes_delete" ON albaranes FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "lineas_albaran_select" ON lineas_albaran;
CREATE POLICY "lineas_albaran_select" ON lineas_albaran FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "lineas_albaran_insert" ON lineas_albaran;
CREATE POLICY "lineas_albaran_insert" ON lineas_albaran FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "lineas_albaran_update" ON lineas_albaran;
CREATE POLICY "lineas_albaran_update" ON lineas_albaran FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "lineas_albaran_delete" ON lineas_albaran;
CREATE POLICY "lineas_albaran_delete" ON lineas_albaran FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "pagos_select" ON pagos;
CREATE POLICY "pagos_select" ON pagos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pagos_insert" ON pagos;
CREATE POLICY "pagos_insert" ON pagos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pagos_update" ON pagos;
CREATE POLICY "pagos_update" ON pagos FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "pagos_delete" ON pagos;
CREATE POLICY "pagos_delete" ON pagos FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "historial_pagos_select" ON historial_pagos;
CREATE POLICY "historial_pagos_select" ON historial_pagos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "historial_pagos_insert" ON historial_pagos;
CREATE POLICY "historial_pagos_insert" ON historial_pagos FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- NOTIFICACIONES Y OCR
-- =====================================================
DROP POLICY IF EXISTS "plantillas_notificacion_select" ON plantillas_notificacion;
CREATE POLICY "plantillas_notificacion_select" ON plantillas_notificacion FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "plantillas_notificacion_insert" ON plantillas_notificacion;
CREATE POLICY "plantillas_notificacion_insert" ON plantillas_notificacion FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "plantillas_notificacion_update" ON plantillas_notificacion;
CREATE POLICY "plantillas_notificacion_update" ON plantillas_notificacion FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "notificaciones_select" ON notificaciones;
CREATE POLICY "notificaciones_select" ON notificaciones FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "notificaciones_insert" ON notificaciones;
CREATE POLICY "notificaciones_insert" ON notificaciones FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ocr_documentos_select" ON ocr_documentos;
CREATE POLICY "ocr_documentos_select" ON ocr_documentos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ocr_documentos_insert" ON ocr_documentos;
CREATE POLICY "ocr_documentos_insert" ON ocr_documentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ocr_documentos_update" ON ocr_documentos;
CREATE POLICY "ocr_documentos_update" ON ocr_documentos FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "ocr_documentos_delete" ON ocr_documentos;
CREATE POLICY "ocr_documentos_delete" ON ocr_documentos FOR DELETE TO authenticated USING (true);

-- =====================================================
-- SECUENCIAS (acceso para funciones)
-- =====================================================
DROP POLICY IF EXISTS "secuencias_select" ON secuencias;
CREATE POLICY "secuencias_select" ON secuencias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "secuencias_insert" ON secuencias;
CREATE POLICY "secuencias_insert" ON secuencias FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "secuencias_update" ON secuencias;
CREATE POLICY "secuencias_update" ON secuencias FOR UPDATE TO authenticated USING (true);
