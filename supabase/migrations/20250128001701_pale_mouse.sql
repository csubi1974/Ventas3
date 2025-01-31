/*
  # Agregar campos de RUT y tipo a la tabla de clientes

  1. Cambios
    - Agregar campo `rut` (texto, único, requerido)
    - Agregar campo `type` (texto, requerido, con valores permitidos 'personal' o 'business')
    - Actualizar la estructura de la tabla customers
  
  2. Seguridad
    - Mantener RLS habilitado
    - Agregar políticas para CRUD operations
*/

-- Agregar campos a la tabla customers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'rut'
  ) THEN
    ALTER TABLE customers ADD COLUMN rut TEXT UNIQUE NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'type'
  ) THEN
    ALTER TABLE customers ADD COLUMN type TEXT NOT NULL CHECK (type IN ('personal', 'business'));
  END IF;
END $$;

-- Políticas de seguridad para la tabla customers
CREATE POLICY "Usuarios autenticados pueden ver clientes" ON customers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear clientes" ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar clientes" ON customers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar clientes" ON customers
  FOR DELETE
  TO authenticated
  USING (true);