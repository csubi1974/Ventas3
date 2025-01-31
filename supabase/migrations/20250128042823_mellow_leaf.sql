/*
  # Función para actualizar inventario

  1. Nueva Función
    - `update_inventory(p_product_id UUID, p_quantity INTEGER)`
    - Actualiza la cantidad en el inventario
    - Registra el movimiento en inventory_movements
    - Verifica que haya suficiente stock para salidas
    - Crea nuevo registro de inventario si no existe

  2. Seguridad
    - Función accesible solo para usuarios autenticados
*/

CREATE OR REPLACE FUNCTION public.update_inventory(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inventory_id UUID;
  v_current_quantity INTEGER;
  v_new_quantity INTEGER;
  v_movement_type TEXT;
BEGIN
  -- Obtener o crear registro de inventario
  SELECT id, quantity
  INTO v_inventory_id, v_current_quantity
  FROM inventory
  WHERE product_id = p_product_id;

  IF v_inventory_id IS NULL THEN
    INSERT INTO inventory (product_id, quantity, type, location, status, condition)
    VALUES (p_product_id, 0, 'in_circulation', 'almacen', 'disponible', 'nuevo')
    RETURNING id, quantity INTO v_inventory_id, v_current_quantity;
  END IF;

  -- Calcular nueva cantidad
  v_new_quantity := v_current_quantity + p_quantity;

  -- Verificar stock suficiente para salidas
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente';
  END IF;

  -- Determinar tipo de movimiento
  v_movement_type := CASE
    WHEN p_quantity > 0 THEN 'entrada'
    ELSE 'salida'
  END;

  -- Actualizar inventario
  UPDATE inventory
  SET 
    quantity = v_new_quantity,
    last_count_date = now()
  WHERE id = v_inventory_id;

  -- Registrar movimiento
  INSERT INTO inventory_movements (
    inventory_id,
    type,
    quantity,
    previous_quantity,
    new_quantity,
    created_by
  ) VALUES (
    v_inventory_id,
    v_movement_type,
    ABS(p_quantity),
    v_current_quantity,
    v_new_quantity,
    auth.uid()
  );
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.update_inventory TO authenticated;