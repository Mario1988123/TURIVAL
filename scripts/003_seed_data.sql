-- =====================================================
-- DATOS INICIALES PARA EL SISTEMA
-- =====================================================

-- Productos base
INSERT INTO productos (id, nombre, categoria, descripcion, unidad_tarificacion, activo) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tablero MDF', 'Tableros', 'Tablero de fibra de densidad media', 'm2', true),
  ('22222222-2222-2222-2222-222222222222', 'Tablero DM', 'Tableros', 'Tablero de densidad media estándar', 'm2', true),
  ('33333333-3333-3333-3333-333333333333', 'Puerta', 'Carpintería', 'Puerta de madera para lacar', 'pieza', true),
  ('44444444-4444-4444-4444-444444444444', 'Frente de cajón', 'Mobiliario', 'Frente de cajón para cocina/baño', 'pieza', true),
  ('55555555-5555-5555-5555-555555555555', 'Moldura', 'Molduras', 'Moldura decorativa', 'm2', true),
  ('66666666-6666-6666-6666-666666666666', 'Pieza especial', 'Varios', 'Piezas con geometría especial', 'pieza', true)
ON CONFLICT DO NOTHING;

-- Colores RAL comunes
INSERT INTO colores (id, codigo, nombre, tipo, hex_aproximado, sobrecoste, activo) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'RAL 9010', 'Blanco puro', 'RAL', '#F1F0EA', 0, true),
  ('c0000001-0000-0000-0000-000000000002', 'RAL 9016', 'Blanco tráfico', 'RAL', '#F7F9EF', 0, true),
  ('c0000001-0000-0000-0000-000000000003', 'RAL 9003', 'Blanco señales', 'RAL', '#ECECE7', 0, true),
  ('c0000001-0000-0000-0000-000000000004', 'RAL 7016', 'Gris antracita', 'RAL', '#383E42', 0, true),
  ('c0000001-0000-0000-0000-000000000005', 'RAL 7021', 'Gris negruzco', 'RAL', '#2E3234', 0, true),
  ('c0000001-0000-0000-0000-000000000006', 'RAL 7035', 'Gris claro', 'RAL', '#CBD0CC', 0, true),
  ('c0000001-0000-0000-0000-000000000007', 'RAL 1015', 'Marfil claro', 'RAL', '#E6D2B5', 0, true),
  ('c0000001-0000-0000-0000-000000000008', 'RAL 5015', 'Azul cielo', 'RAL', '#007CB0', 5, true),
  ('c0000001-0000-0000-0000-000000000009', 'RAL 3020', 'Rojo tráfico', 'RAL', '#C1121C', 5, true),
  ('c0000001-0000-0000-0000-000000000010', 'RAL 6005', 'Verde musgo', 'RAL', '#0F4336', 5, true),
  ('c0000001-0000-0000-0000-000000000011', 'NCS S 0500-N', 'Blanco NCS', 'NCS', '#FFFFFF', 3, true),
  ('c0000001-0000-0000-0000-000000000012', 'NCS S 1000-N', 'Gris muy claro NCS', 'NCS', '#F5F5F5', 3, true)
ON CONFLICT DO NOTHING;

-- Tratamientos
INSERT INTO tratamientos (id, nombre, descripcion, multiplicador_coste, tiempo_estimado_base, activo) VALUES
  ('t0000001-0000-0000-0000-000000000001', 'Lacado estándar', 'Proceso de lacado básico con fondo y acabado', 1.0, 30, true),
  ('t0000001-0000-0000-0000-000000000002', 'Lacado con fondo', 'Incluye aplicación de fondo sellador', 1.2, 45, true),
  ('t0000001-0000-0000-0000-000000000003', 'Lacado sin fondo', 'Lacado directo sin fondo previo', 0.8, 20, true),
  ('t0000001-0000-0000-0000-000000000004', 'Lacado poliuretano', 'Acabado de alta resistencia', 1.5, 60, true),
  ('t0000001-0000-0000-0000-000000000005', 'Lacado texturizado', 'Acabado con textura especial', 1.4, 50, true),
  ('t0000001-0000-0000-0000-000000000006', 'Imprimación solo', 'Solo aplicación de imprimación/fondo', 0.6, 15, true),
  ('t0000001-0000-0000-0000-000000000007', 'Relacado', 'Repaso o segunda capa sobre lacado existente', 0.7, 25, true)
ON CONFLICT DO NOTHING;

-- Tarifas base
INSERT INTO tarifas (id, nombre, producto_id, modo_precio, precio_m2, precio_pieza, precio_minimo, activo) VALUES
  ('f0000001-0000-0000-0000-000000000001', 'Tablero MDF estándar', '11111111-1111-1111-1111-111111111111', 'm2', 25.00, NULL, 15.00, true),
  ('f0000001-0000-0000-0000-000000000002', 'Tablero DM estándar', '22222222-2222-2222-2222-222222222222', 'm2', 22.00, NULL, 12.00, true),
  ('f0000001-0000-0000-0000-000000000003', 'Puerta estándar', '33333333-3333-3333-3333-333333333333', 'pieza', NULL, 45.00, 45.00, true),
  ('f0000001-0000-0000-0000-000000000004', 'Frente cajón pequeño', '44444444-4444-4444-4444-444444444444', 'pieza', NULL, 12.00, 8.00, true),
  ('f0000001-0000-0000-0000-000000000005', 'Moldura lineal', '55555555-5555-5555-5555-555555555555', 'm2', 35.00, NULL, 20.00, true),
  ('f0000001-0000-0000-0000-000000000006', 'Pieza especial', '66666666-6666-6666-6666-666666666666', 'ambos', 30.00, 25.00, 20.00, true)
ON CONFLICT DO NOTHING;

-- Plantillas de notificación
INSERT INTO plantillas_notificacion (nombre, tipo, asunto, contenido, activo) VALUES
  ('Avance 30%', 'avance_30', 'Su pedido {{numero_pedido}} está en proceso (30%)', 
   '<p>Estimado/a {{cliente}},</p><p>Le informamos que su pedido <strong>{{numero_pedido}}</strong> se encuentra al 30% de avance.</p><p>Fecha prevista de entrega: {{fecha_entrega}}</p><p>Saludos cordiales.</p>', true),
  ('Avance 70%', 'avance_70', 'Su pedido {{numero_pedido}} avanza (70%)', 
   '<p>Estimado/a {{cliente}},</p><p>Le informamos que su pedido <strong>{{numero_pedido}}</strong> se encuentra al 70% de avance.</p><p>Fecha prevista de entrega: {{fecha_entrega}}</p><p>Saludos cordiales.</p>', true),
  ('Pedido terminado', 'finalizado', 'Su pedido {{numero_pedido}} está terminado', 
   '<p>Estimado/a {{cliente}},</p><p>Nos complace informarle que su pedido <strong>{{numero_pedido}}</strong> ha sido completado satisfactoriamente.</p><p>Puede pasar a recogerlo o coordinar la entrega.</p><p>Saludos cordiales.</p>', true),
  ('Listo para entrega', 'listo_entrega', 'Su pedido {{numero_pedido}} está listo para entrega', 
   '<p>Estimado/a {{cliente}},</p><p>Su pedido <strong>{{numero_pedido}}</strong> está preparado y listo para ser recogido o enviado.</p><p>Por favor, contacte con nosotros para coordinar la entrega.</p><p>Saludos cordiales.</p>', true)
ON CONFLICT DO NOTHING;

-- Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'rol', 'usuario')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Eliminar trigger si existe y crear de nuevo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
