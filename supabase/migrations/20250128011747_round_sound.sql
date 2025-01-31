/*
  # Agregar políticas RLS para órdenes y detalles de órdenes

  1. Seguridad
    - Agregar políticas para la tabla orders:
      - Lectura: Usuarios autenticados pueden ver todas las órdenes
      - Escritura: Usuarios autenticados pueden crear órdenes
      - Actualización: Usuarios autenticados pueden actualizar órdenes
    - Agregar políticas para la tabla order_items:
      - Lectura: Usuarios autenticados pueden ver todos los items
      - Escritura: Usuarios autenticados pueden crear items
*/

-- Políticas para orders
CREATE POLICY "Usuarios autenticados pueden ver órdenes" ON orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear órdenes" ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar órdenes" ON orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para order_items
CREATE POLICY "Usuarios autenticados pueden ver items de órdenes" ON order_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear items de órdenes" ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar items de órdenes" ON order_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);