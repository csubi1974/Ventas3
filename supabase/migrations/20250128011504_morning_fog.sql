/*
  # Agregar políticas RLS para la tabla products

  1. Seguridad
    - Habilitar RLS en la tabla products
    - Agregar políticas para:
      - Lectura: Todos los usuarios autenticados
      - Escritura: Todos los usuarios autenticados
      - Eliminación: Todos los usuarios autenticados
*/

-- Políticas de seguridad para la tabla products
CREATE POLICY "Usuarios autenticados pueden ver productos" ON products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear productos" ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar productos" ON products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar productos" ON products
  FOR DELETE
  TO authenticated
  USING (true);