/*
  # Fix inventory updates for sales and routes

  1. Changes
    - Drop existing triggers and functions
    - Create new function to handle inventory updates
    - Create new trigger for order items
    - Update route sales function to handle inventory correctly

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity during inventory updates
*/

-- Drop existing triggers that might interfere with inventory updates
DROP TRIGGER IF EXISTS process_route_sale_trigger ON delivery_route_items;
DROP FUNCTION IF EXISTS process_route_sale() CASCADE;

-- Create a new function to handle inventory updates for all sales
CREATE OR REPLACE FUNCTION process_sale_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_product_type TEXT;
  v_pack_item RECORD;
  v_inventory_quantity INTEGER;
  v_product_name TEXT;
BEGIN
  -- Get product type and name
  SELECT type, name INTO v_product_type, v_product_name
  FROM products
  WHERE id = NEW.product_id;

  -- Check if it's a pack
  IF v_product_type = 'pack' THEN
    -- For packs, check and update inventory of each component
    FOR v_pack_item IN
      SELECT 
        pi.product_id,
        pi.quantity * NEW.quantity as required_quantity,
        p.name as component_name,
        COALESCE(i.quantity, 0) as available_quantity
      FROM pack_items pi
      JOIN products p ON p.id = pi.product_id
      LEFT JOIN inventory i ON i.product_id = pi.product_id
      WHERE pi.pack_id = NEW.product_id
    LOOP
      -- Verify stock
      IF v_pack_item.available_quantity < v_pack_item.required_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el componente % del pack %: % unidades disponibles, % requeridas',
          v_pack_item.component_name,
          v_product_name,
          v_pack_item.available_quantity,
          v_pack_item.required_quantity;
      END IF;

      -- Update inventory for pack component
      PERFORM update_inventory(
        v_pack_item.product_id,
        -(v_pack_item.required_quantity)
      );
    END LOOP;
  ELSE
    -- For regular products, check and update inventory directly
    SELECT quantity INTO v_inventory_quantity
    FROM inventory
    WHERE product_id = NEW.product_id;

    IF COALESCE(v_inventory_quantity, 0) < NEW.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %: % unidades disponibles, % requeridas',
        v_product_name,
        COALESCE(v_inventory_quantity, 0),
        NEW.quantity;
    END IF;

    -- Update inventory for regular product
    PERFORM update_inventory(
      NEW.product_id,
      -NEW.quantity
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error en process_sale_inventory: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process inventory updates for all order items
CREATE TRIGGER process_sale_inventory_trigger
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION process_sale_inventory();

-- Create new function to handle route sales
CREATE OR REPLACE FUNCTION process_route_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_route delivery_routes;
  v_order_id UUID;
BEGIN
  -- Get the route
  SELECT * INTO v_route
  FROM delivery_routes
  WHERE id = NEW.delivery_route_id;

  -- Get or create order
  SELECT id INTO v_order_id
  FROM orders
  WHERE customer_id = v_route.customer_id
  AND channel = 'route'
  AND DATE(created_at) = v_route.date;

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

  -- Create order item (this will trigger inventory update)
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

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error en process_route_sale: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for route sales
CREATE TRIGGER process_route_sale_trigger
  AFTER INSERT ON delivery_route_items
  FOR EACH ROW
  EXECUTE FUNCTION process_route_sale();