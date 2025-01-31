-- Agregar campos para gestión de botellones y totales
ALTER TABLE delivery_routes
ADD COLUMN IF NOT EXISTS bottles_in_circulation INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bottles_owned INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bottles_balance INTEGER GENERATED ALWAYS AS (bottles_in_circulation + bottles_to_deliver - bottles_to_collect) STORED;

-- Agregar campos para gestión de ventas
ALTER TABLE delivery_routes
ADD COLUMN IF NOT EXISTS sale_type TEXT CHECK (sale_type IN ('scheduled', 'direct')) DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS sale_status TEXT CHECK (sale_status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending';

-- Crear función para actualizar el balance de botellones del cliente
CREATE OR REPLACE FUNCTION update_customer_bottles()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completado' AND OLD.status != 'completado' THEN
    -- Actualizar botellones del cliente
    UPDATE customers
    SET 
      bottles_lent = bottles_lent + NEW.bottles_balance - COALESCE(OLD.bottles_balance, 0)
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar botellones automáticamente
DROP TRIGGER IF EXISTS update_customer_bottles_trigger ON delivery_routes;
CREATE TRIGGER update_customer_bottles_trigger
  AFTER UPDATE ON delivery_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_bottles();

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS delivery_routes_sale_type_idx ON delivery_routes(sale_type);
CREATE INDEX IF NOT EXISTS delivery_routes_sale_status_idx ON delivery_routes(sale_status);