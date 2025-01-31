/*
  # Fix route inventory update trigger

  1. Changes
    - Move inventory update to trigger on delivery_route_items instead of delivery_routes
    - Add better error handling and validation
    - Improve inventory update process

  2. Security
    - Maintain existing RLS policies
    - Add inventory validation
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS create_sale_from_route_trigger ON delivery_routes;
DROP TRIGGER IF EXISTS validate_route_inventory_trigger ON delivery_route_items;
DROP FUNCTION IF EXISTS create_sale_from_route();
DROP FUNCTION IF EXISTS validate_route_inventory();

-- Create function to handle route sales and inventory
CREATE OR REPLACE FUNCTION process_route_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_route delivery_routes;
  v_order_id UUID;
  v_inventory_quantity INTEGER;
BEGIN
  -- Obtener la ruta completa
  SELECT * INTO v_route
  FROM delivery_routes
  WHERE id = NEW.delivery_route_id;

  -- Verificar si ya existe una orden para esta ruta
  SELECT id INTO v_order_id
  FROM orders
  WHERE customer_id = v_route.customer_id
  AND channel = 'route'
  AND DATE(created_at) = v_route.date;

  -- Verificar stock disponible
  SELECT quantity INTO v_inventory_quantity
  FROM inventory
  WHERE product_id = NEW.product_id;

  IF v_inventory_quantity IS NULL OR v_inventory_quantity < NEW.quantity THEN
    RAISE EXCEPTION 'Stock insuficiente para el producto %: % unidades disponibles, % requeridas', 
      (SELECT name FROM products WHERE id = NEW.product_id),
      COALESCE(v_inventory_quantity, 0),
      NEW.quantity;
  END IF;

  -- Si no existe la orden, crearla
  IF v_order_id IS NULL THEN
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
      v_route.customer_id,
      CASE 
        WHEN v_route.sale_status = 'confirmed' THEN 'confirmed'
        ELSE 'pending'
      END,
      v_route.total,
      CASE 
        WHEN v_route.payment_method = 'pendiente' THEN 'pending'
        ELSE 'paid'
      END,
      v_route.payment_method,
      'route',
      v_route.subtotal,
      v_route.tax
    )
    RETURNING id INTO v_order_id;
  END IF;

  -- Crear el item de la orden
  INSERT INTO order_items (
    order_id,
    product_id,
    quantity,
    unit_price,
    total_price
  ) VALUES (
    v_order_id,
    NEW.product_id,
    NEW.quantity,
    NEW.unit_price,
    NEW.total_price
  );

  -- Actualizar el inventario
  PERFORM update_inventory(
    NEW.product_id,
    -NEW.quantity
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error en process_route_sale: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para procesar la venta y actualizar inventario
CREATE TRIGGER process_route_sale_trigger
  AFTER INSERT ON delivery_route_items
  FOR EACH ROW
  EXECUTE FUNCTION process_route_sale();