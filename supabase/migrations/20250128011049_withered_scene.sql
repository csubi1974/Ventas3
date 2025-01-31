/*
  # Initialize inventory for products
  
  1. New Data
    - Initial inventory records for all products
    - Default quantities and status
    
  2. Changes
    - Insert inventory records for existing products
*/

-- Initialize inventory for existing products
INSERT INTO inventory (product_id, quantity, type, location, status, condition)
SELECT 
  id as product_id,
  CASE 
    WHEN type = 'water' THEN 100  -- Botellones
    WHEN type = 'dispenser' AND code = 'DISP-VENT' THEN 15  -- Dispensadores ventilador
    WHEN type = 'dispenser' AND code = 'DISP-COMP' THEN 10  -- Dispensadores compresor
    WHEN type = 'dispenser' AND code = 'DISP-PVC' THEN 20   -- Dispensadores PVC
    WHEN type = 'accessory' THEN 50  -- Accesorios
    WHEN type = 'pack' THEN 0  -- Los packs no tienen inventario físico
    ELSE 0
  END as quantity,
  CASE 
    WHEN type = 'pack' THEN 'new'  -- Los packs son virtuales
    ELSE 'in_circulation'
  END as type,
  'almacen' as location,
  'disponible' as status,
  'nuevo' as condition
FROM products
WHERE active = true
ON CONFLICT DO NOTHING;