/*
  # Add pack items data
  
  1. Changes
    - Add component items for existing packs
    - Configure Pro Pack with Compressor Dispenser
    - Configure Home Pack with PVC Dispenser
    - Add water bottles to both packs (3 per pack)
*/

-- Add items for existing packs
DO $$ 
DECLARE
  v_pack_pro_id UUID;
  v_pack_home_id UUID;
  v_disp_comp_id UUID;
  v_disp_pvc_id UUID;
  v_agua_id UUID;
BEGIN
  -- Get pack IDs
  SELECT id INTO v_pack_pro_id FROM products WHERE code = 'PACK-PRO';
  SELECT id INTO v_pack_home_id FROM products WHERE code = 'PACK-HOME';
  
  -- Get component IDs
  SELECT id INTO v_disp_comp_id FROM products WHERE code = 'DISP-COMP';
  SELECT id INTO v_disp_pvc_id FROM products WHERE code = 'DISP-PVC';
  SELECT id INTO v_agua_id FROM products WHERE code = 'AGUA-20L';

  -- Add dispensers to packs
  INSERT INTO pack_items (pack_id, product_id, quantity)
  VALUES
    (v_pack_pro_id, v_disp_comp_id, 1),
    (v_pack_home_id, v_disp_pvc_id, 1);

  -- Add water bottles to both packs (3 bottles each)
  INSERT INTO pack_items (pack_id, product_id, quantity)
  VALUES
    (v_pack_pro_id, v_agua_id, 3),
    (v_pack_home_id, v_agua_id, 3);
END $$;