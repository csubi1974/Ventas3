/*
  # Agregar soporte para precios con IVA

  1. Cambios
    - Agregar columna price_with_tax a la tabla products
    - Actualizar precios existentes
    - Crear función para calcular precio con/sin IVA

  2. Notas
    - price almacenará el precio neto (sin IVA)
    - price_with_tax almacenará el precio total (con IVA)
*/

-- Agregar columna para precio con IVA
ALTER TABLE products
ADD COLUMN price_with_tax DECIMAL(10,2) GENERATED ALWAYS AS (price * 1.19) STORED;

-- Crear función para calcular precio neto desde precio con IVA
CREATE OR REPLACE FUNCTION calculate_net_price(price_with_tax DECIMAL)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ROUND(price_with_tax / 1.19, 2);
END;
$$;