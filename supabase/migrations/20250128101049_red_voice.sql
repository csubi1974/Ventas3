-- Crear función para generar venta desde ruta
CREATE OR REPLACE FUNCTION create_sale_from_route()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_item RECORD;
BEGIN
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

-- Crear trigger para generar venta automáticamente
DROP TRIGGER IF EXISTS create_sale_from_route_trigger ON delivery_routes;
CREATE TRIGGER create_sale_from_route_trigger
  AFTER INSERT ON delivery_routes
  FOR EACH ROW
  EXECUTE FUNCTION create_sale_from_route();

-- Crear función para actualizar venta cuando se actualiza la ruta
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

-- Crear trigger para actualizar venta automáticamente
DROP TRIGGER IF EXISTS update_sale_from_route_trigger ON delivery_routes;
CREATE TRIGGER update_sale_from_route_trigger
  AFTER UPDATE ON delivery_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_from_route();