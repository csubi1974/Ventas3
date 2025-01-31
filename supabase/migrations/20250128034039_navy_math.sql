/*
  # Actualizar categorías de gastos

  1. Cambios
    - Modificar la restricción de tipo de gastos para incluir todas las categorías necesarias
  
  2. Seguridad
    - Mantener la restricción CHECK para validar los tipos permitidos
*/

-- Eliminar la restricción anterior
ALTER TABLE expenses 
  DROP CONSTRAINT IF EXISTS expenses_type_check;

-- Agregar la nueva restricción con todas las categorías
ALTER TABLE expenses 
  ADD CONSTRAINT expenses_type_check 
  CHECK (type IN (
    'Combustible',
    'Mantenimiento',
    'Salarios',
    'Servicios',
    'Suministros',
    'Otros gastos'
  ));