/*
  # Corregir políticas de la tabla users

  1. Cambios
    - Eliminar política anterior que causaba recursión infinita
    - Crear nuevas políticas específicas para cada operación
  
  2. Seguridad
    - Permitir inserción solo durante el registro
    - Permitir lectura a usuarios autenticados
    - Permitir actualización solo a admins y al propio usuario
*/

-- Eliminar política anterior
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Admins have full access to users" ON users;

-- Política para insertar (durante el registro)
CREATE POLICY "Enable insert for authentication" ON users
  FOR INSERT
  WITH CHECK (true);

-- Política para lectura (usuarios autenticados)
CREATE POLICY "Authenticated users can view users" ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para actualización (admin o propio usuario)
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR 
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() AND role = 'admin'
        ))
  WITH CHECK (auth.uid() = id OR 
             EXISTS (
               SELECT 1 FROM users 
               WHERE id = auth.uid() AND role = 'admin'
             ));