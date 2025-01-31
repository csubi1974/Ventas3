/*
  # Improve inventory management system

  1. Changes
    - Update inventory update function with better validation
    - Add inventory check function
    - Improve error messages
    - Fix transaction handling

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity
*/

-- Drop existing function
DROP FUNCTION IF EXISTS update_inventory(UUID, INTEGER);

-- Create improved inventory check function
CREATE OR REPLACE FUNCTION check_inventory_availability(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_type TEXT;
  v_product_name TEXT;
  v_current_quantity INTEGER;
  v_pack_item RECORD;
BEGIN
  -- Get product information
  SELECT type, name INTO v_product_type, v_product_name
  FROM products
  WHERE id = p_product_id;

  IF v_product_type = 'pack' THEN
    -- Check components for packs
    FOR v_pack_item IN
      SELECT 
        p.name as component_name,
        pi.quantity * p_quantity as required_quantity,
        COALESCE(i.quantity, 0) as available_quantity
      FROM pack_items pi
      JOIN products p ON p.id = pi.product_id
      LEFT JOIN inventory i ON i.product_id = pi.product_id
      WHERE pi.pack_id = p_product_id
    LOOP
      IF v_pack_item.available_quantity < v_pack_item.required_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente para el componente % del pack %: % unidades disponibles, % requeridas',
          v_pack_item.component_name,
          v_product_name,
          v_pack_item.available_quantity,
          v_pack_item.required_quantity;
      END IF;
    END LOOP;
  ELSE
    -- Check regular products
    SELECT quantity INTO v_current_quantity
    FROM inventory
    WHERE product_id = p_product_id;

    IF COALESCE(v_current_quantity, 0) < p_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %: % unidades disponibles, % requeridas',
        v_product_name,
        COALESCE(v_current_quantity, 0),
        p_quantity;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- Create improved inventory update function
CREATE OR REPLACE FUNCTION update_inventory(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_type TEXT;
  v_inventory_id UUID;
  v_current_quantity INTEGER;
  v_new_quantity INTEGER;
  v_movement_type TEXT;
  v_pack_item RECORD;
BEGIN
  -- Check inventory availability first
  PERFORM check_inventory_availability(p_product_id, ABS(p_quantity));

  -- Get product type
  SELECT type INTO v_product_type
  FROM products
  WHERE id = p_product_id;

  IF v_product_type = 'pack' THEN
    -- Update components for packs
    FOR v_pack_item IN
      SELECT product_id, quantity
      FROM pack_items
      WHERE pack_id = p_product_id
    LOOP
      -- Get or create inventory record
      SELECT id, quantity
      INTO v_inventory_id, v_current_quantity
      FROM inventory
      WHERE product_id = v_pack_item.product_id;

      IF v_inventory_id IS NULL THEN
        INSERT INTO inventory (product_id, quantity, type, location, status, condition)
        VALUES (v_pack_item.product_id, 0, 'in_circulation', 'almacen', 'disponible', 'nuevo')
        RETURNING id, quantity INTO v_inventory_id, v_current_quantity;
      END IF;

      -- Calculate new quantity
      v_new_quantity := v_current_quantity + (p_quantity * v_pack_item.quantity);

      -- Update inventory
      UPDATE inventory
      SET 
        quantity = v_new_quantity,
        last_count_date = now()
      WHERE id = v_inventory_id;

      -- Record movement
      INSERT INTO inventory_movements (
        inventory_id,
        type,
        quantity,
        previous_quantity,
        new_quantity,
        created_by
      ) VALUES (
        v_inventory_id,
        CASE WHEN p_quantity > 0 THEN 'entrada' ELSE 'salida' END,
        ABS(p_quantity * v_pack_item.quantity),
        v_current_quantity,
        v_new_quantity,
        auth.uid()
      );
    END LOOP;
  ELSE
    -- Update regular product inventory
    SELECT id, quantity
    INTO v_inventory_id, v_current_quantity
    FROM inventory
    WHERE product_id = p_product_id;

    IF v_inventory_id IS NULL THEN
      INSERT INTO inventory (product_id, quantity, type, location, status, condition)
      VALUES (p_product_id, 0, 'in_circulation', 'almacen', 'disponible', 'nuevo')
      RETURNING id, quantity INTO v_inventory_id, v_current_quantity;
    END IF;

    -- Calculate new quantity
    v_new_quantity := v_current_quantity + p_quantity;

    -- Update inventory
    UPDATE inventory
    SET 
      quantity = v_new_quantity,
      last_count_date = now()
    WHERE id = v_inventory_id;

    -- Record movement
    INSERT INTO inventory_movements (
      inventory_id,
      type,
      quantity,
      previous_quantity,
      new_quantity,
      created_by
    ) VALUES (
      v_inventory_id,
      CASE WHEN p_quantity > 0 THEN 'entrada' ELSE 'salida' END,
      ABS(p_quantity),
      v_current_quantity,
      v_new_quantity,
      auth.uid()
    );
  END IF;
END;
$$;