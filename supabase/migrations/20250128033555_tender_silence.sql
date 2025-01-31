/*
  # Configuración de políticas para el módulo de finanzas

  1. Nuevas Políticas
    - Permisos para la tabla expenses
    - Acceso completo para usuarios autenticados
  
  2. Seguridad
    - Habilitar RLS en la tabla expenses
    - Políticas para operaciones CRUD
*/

-- Habilitar RLS para la tabla expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Políticas para la tabla expenses
CREATE POLICY "Usuarios autenticados pueden ver gastos" ON expenses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear gastos" ON expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar gastos" ON expenses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar gastos" ON expenses
  FOR DELETE
  TO authenticated
  USING (true);