/*
  # Políticas de seguridad para inventario

  1. Seguridad
    - Habilitar RLS en la tabla inventory
    - Agregar políticas para usuarios autenticados:
      - Lectura de registros
      - Creación de registros
      - Actualización de registros
      - Eliminación de registros
*/

-- Políticas para la tabla inventory
CREATE POLICY "Usuarios autenticados pueden ver inventario" ON inventory
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear registros de inventario" ON inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar inventario" ON inventory
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar registros de inventario" ON inventory
  FOR DELETE
  TO authenticated
  USING (true);