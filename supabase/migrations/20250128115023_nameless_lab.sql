/*
  # Fix inventory update for delivery routes

  1. Changes
    - Add inventory update to route items
    - Improve error handling
    - Add inventory validation before route creation

  2. Security
    - Maintain existing RLS policies
    - Add inventory checks
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS create_sale_from_route_trigger ON delivery_routes;
DROP FUNCTION IF EXISTS create_sale_from_route();

-- Create improved function for route sales with inventory management
CREATE OR REPLACE FUNCTION create_sale_from_route()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_item RECORD;
  v_inventory_quantity INTEGER;
BEGIN
  -- Verificar stock disponible para todos los productos
  FOR v_item IN 
    SELECT dri.product_id, dri.quantity, p.name as product_name
    FROM delivery_route_items dri
    JOIN products p ON p.id = dri.product_id
    WHERE dri.delivery_route_id = NEW.id
  LOOP
    SELECT quantity INTO v_inventory_quantity
    FROM inventory
    WHERE product_id = v_item.product_id;

    IF v_inventory_quantity IS NULL OR v_inventory_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %: % unidades disponibles, % requeridas', 
        v_item.product_name, COALESCE(v_inventory_quantity, 0), v_item.quantity;
    END IF;
  END LOOP;

  -- Crear la orden de venta
  INSERT INTO orders (
    customer_id,
    status,
    total_amount,
    payment_status,
    payment_method,
    channel,
    subtotal,
    tax
  ) VALUES (
    NEW.customer_id,
    CASE 
      WHEN NEW.sale_status = 'confirmed' THEN 'confirmed'
      ELSE 'pending'
    END,
    NEW.total,
    CASE 
      WHEN NEW.payment_method = 'pendiente' THEN 'pending'
      ELSE 'paid'
    END,
    NEW.payment_method,
    'route',
    NEW.subtotal,
    NEW.tax
  )
  RETURNING id INTO v_order_id;

  -- Crear los items de la orden
  INSERT INTO order_items (
    order_id,
    product_id,
    quantity,
    unit_price,
    total_price
  )
  SELECT 
    v_order_id,
    product_id,
    quantity,
    unit_price,
    total_price
  FROM delivery_route_items
  WHERE delivery_route_id = NEW.id;

  -- Actualizar el inventario inmediatamente
  FOR v_item IN 
    SELECT product_id, quantity 
    FROM delivery_route_items 
    WHERE delivery_route_id = NEW.id
  LOOP
    -- Llamar a la función de actualización de inventario
    PERFORM update_inventory(
      v_item.product_id,
      -v_item.quantity
    );
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Registrar el error y relanzarlo
    RAISE NOTICE 'Error en create_sale_from_route: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger para la creación de ventas desde rutas
CREATE TRIGGER create_sale_from_route_trigger
  AFTER INSERT ON delivery_routes
  FOR EACH ROW
  EXECUTE FUNCTION create_sale_from_route();

-- Función para validar el inventario antes de crear una ruta
CREATE OR REPLACE FUNCTION validate_route_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_inventory_quantity INTEGER;
BEGIN
  -- Verificar stock disponible para todos los productos
  FOR v_item IN 
    SELECT dri.product_id, dri.quantity, p.name as product_name
    FROM delivery_route_items dri
    JOIN products p ON p.id = dri.product_id
    WHERE dri.delivery_route_id = NEW.id
  LOOP
    SELECT quantity INTO v_inventory_quantity
    FROM inventory
    WHERE product_id = v_item.product_id;

    IF v_inventory_quantity IS NULL OR v_inventory_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %: % unidades disponibles, % requeridas', 
        v_item.product_name, COALESCE(v_inventory_quantity, 0), v_item.quantity;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para validar inventario antes de crear una ruta
CREATE TRIGGER validate_route_inventory_trigger
  AFTER INSERT ON delivery_route_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_route_inventory();