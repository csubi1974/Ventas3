/*
  # Fix pack product inventory handling

  1. Changes
    - Add pack_items table to define pack contents
    - Add triggers to enforce pack validation rules
    - Update inventory validation to handle packs
    - Improve error messages

  2. Security
    - Enable RLS on new table
    - Add appropriate policies
*/

-- Create table for pack contents
CREATE TABLE IF NOT EXISTS pack_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES products(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE pack_items ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Usuarios autenticados pueden ver items de packs" ON pack_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar items de packs" ON pack_items
  FOR ALL TO authenticated USING (true);

-- Create function to validate pack items
CREATE OR REPLACE FUNCTION validate_pack_item()
RETURNS TRIGGER AS $$
DECLARE
  v_pack_type TEXT;
  v_product_type TEXT;
BEGIN
  -- Check if pack_id refers to a pack product
  SELECT type INTO v_pack_type
  FROM products
  WHERE id = NEW.pack_id;

  IF v_pack_type != 'pack' THEN
    RAISE EXCEPTION 'El producto % no es un pack', NEW.pack_id;
  END IF;

  -- Check if product_id refers to a non-pack product
  SELECT type INTO v_product_type
  FROM products
  WHERE id = NEW.product_id;

  IF v_product_type = 'pack' THEN
    RAISE EXCEPTION 'No se pueden incluir packs dentro de otros packs';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for pack validation
CREATE TRIGGER validate_pack_item_trigger
  BEFORE INSERT OR UPDATE ON pack_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_pack_item();

-- Create function to validate pack inventory
CREATE OR REPLACE FUNCTION validate_pack_inventory(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_type TEXT;
  v_pack_item RECORD;
  v_inventory_quantity INTEGER;
BEGIN
  -- Get product type
  SELECT type INTO v_product_type
  FROM products
  WHERE id = p_product_id;

  -- If not a pack, check direct inventory
  IF v_product_type != 'pack' THEN
    SELECT quantity INTO v_inventory_quantity
    FROM inventory
    WHERE product_id = p_product_id;

    RETURN COALESCE(v_inventory_quantity, 0) >= p_quantity;
  END IF;

  -- For packs, check inventory of all contained items
  FOR v_pack_item IN
    SELECT pi.product_id, pi.quantity * p_quantity as required_quantity
    FROM pack_items pi
    WHERE pi.pack_id = p_product_id
  LOOP
    SELECT quantity INTO v_inventory_quantity
    FROM inventory
    WHERE product_id = v_pack_item.product_id;

    IF COALESCE(v_inventory_quantity, 0) < v_pack_item.required_quantity THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- Update process_route_sale function to handle packs
CREATE OR REPLACE FUNCTION process_route_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_route delivery_routes;
  v_order_id UUID;
  v_product_type TEXT;
  v_pack_item RECORD;
  v_inventory_quantity INTEGER;
  v_product_name TEXT;
BEGIN
  -- Get the route
  SELECT * INTO v_route
  FROM delivery_routes
  WHERE id = NEW.delivery_route_id;

  -- Get product type and name
  SELECT type, name INTO v_product_type, v_product_name
  FROM products
  WHERE id = NEW.product_id;

  -- Validate inventory
  IF NOT validate_pack_inventory(NEW.product_id, NEW.quantity) THEN
    IF v_product_type = 'pack' THEN
      -- For packs, find which component is missing
      FOR v_pack_item IN
        SELECT 
          p.name as product_name,
          pi.quantity * NEW.quantity as required_quantity,
          COALESCE(i.quantity, 0) as available_quantity
        FROM pack_items pi
        JOIN products p ON p.id = pi.product_id
        LEFT JOIN inventory i ON i.product_id = pi.product_id
        WHERE pi.pack_id = NEW.product_id
        AND COALESCE(i.quantity, 0) < (pi.quantity * NEW.quantity)
      LOOP
        RAISE EXCEPTION 'Stock insuficiente para el componente % del pack %: % unidades disponibles, % requeridas',
          v_pack_item.product_name,
          v_product_name,
          v_pack_item.available_quantity,
          v_pack_item.required_quantity;
      END LOOP;
    ELSE
      -- For regular products
      SELECT quantity INTO v_inventory_quantity
      FROM inventory
      WHERE product_id = NEW.product_id;

      RAISE EXCEPTION 'Stock insuficiente para el producto %: % unidades disponibles, % requeridas',
        v_product_name,
        COALESCE(v_inventory_quantity, 0),
        NEW.quantity;
    END IF;
  END IF;

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

  -- Create order item
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

  -- Update inventory
  IF v_product_type = 'pack' THEN
    -- For packs, update inventory of each component
    FOR v_pack_item IN
      SELECT product_id, quantity
      FROM pack_items
      WHERE pack_id = NEW.product_id
    LOOP
      PERFORM update_inventory(
        v_pack_item.product_id,
        -(v_pack_item.quantity * NEW.quantity)
      );
    END LOOP;
  ELSE
    -- For regular products
    PERFORM update_inventory(
      NEW.product_id,
      -NEW.quantity
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error en process_route_sale: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;