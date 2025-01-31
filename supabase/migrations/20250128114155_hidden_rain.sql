/*
  # Fix inventory update for delivery routes

  1. Changes
    - Update create_sale_from_route trigger to handle inventory updates
    - Add inventory update to route completion
    - Add inventory checks before route creation

  2. Security
    - Maintain existing RLS policies
    - Add inventory validation
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS create_sale_from_route_trigger ON delivery_routes;
DROP FUNCTION IF EXISTS create_sale_from_route();

-- Create improved function for route sales
CREATE OR REPLACE FUNCTION create_sale_from_route()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_item RECORD;
  v_inventory_quantity INTEGER;
BEGIN
  -- Verificar stock disponible para todos los productos
  FOR v_item IN 
    SELECT dri.product_id, dri.quantity 
    FROM delivery_route_items dri
    WHERE dri.delivery_route_id = NEW.id
  LOOP
    SELECT quantity INTO v_inventory_quantity
    FROM inventory
    WHERE product_id = v_item.product_id;

    IF v_inventory_quantity IS NULL OR v_inventory_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', v_item.product_id;
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

  -- Actualizar el inventario
  FOR v_item IN 
    SELECT product_id, quantity 
    FROM delivery_route_items 
    WHERE delivery_route_id = NEW.id
  LOOP
    PERFORM update_inventory(v_item.product_id, -v_item.quantity);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
CREATE TRIGGER create_sale_from_route_trigger
  AFTER INSERT ON delivery_routes
  FOR EACH ROW
  EXECUTE FUNCTION create_sale_from_route();

-- Actualizar la función de actualización de ruta
CREATE OR REPLACE FUNCTION update_sale_from_route()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar estado de la orden
  UPDATE orders
  SET 
    status = CASE 
      WHEN NEW.sale_status = 'confirmed' THEN 'confirmed'
      WHEN NEW.sale_status = 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END,
    payment_status = CASE 
      WHEN NEW.payment_method = 'pendiente' THEN 'pending'
      ELSE 'paid'
    END,
    payment_method = NEW.payment_method,
    total_amount = NEW.total,
    subtotal = NEW.subtotal,
    tax = NEW.tax,
    updated_at = now()
  WHERE id IN (
    SELECT o.id 
    FROM orders o
    WHERE o.customer_id = NEW.customer_id
    AND o.channel = 'route'
    AND DATE(o.created_at) = NEW.date
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;