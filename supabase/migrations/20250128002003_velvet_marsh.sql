/*
  # Agregar campos de dirección a la tabla de clientes

  1. Cambios
    - Agregar campos de dirección:
      - street (calle)
      - number (número)
      - district (comuna)
      - city (ciudad)
      - reference (referencia)
    
  2. Seguridad
    - Mantener RLS habilitado
*/

-- Agregar campos de dirección a la tabla customers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'street'
  ) THEN
    ALTER TABLE customers ADD COLUMN street TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'number'
  ) THEN
    ALTER TABLE customers ADD COLUMN number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'district'
  ) THEN
    ALTER TABLE customers ADD COLUMN district TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'city'
  ) THEN
    ALTER TABLE customers ADD COLUMN city TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'reference'
  ) THEN
    ALTER TABLE customers ADD COLUMN reference TEXT;
  END IF;
END $$;