/*
  # Actualizar precios a Pesos Chilenos

  1. Cambios
    - Insertar productos con precios en CLP
    - Actualizar productos básicos y packs
  
  2. Productos
    - Recarga de agua: $3.500
    - Dispensador pedestal con ventilador: $45.000
    - Dispensador pedestal con compresor: $65.000
    - Dispensador PVC: $25.000
    - Bomba USB: $8.000
    - Pack Pro: $75.000
    - Pack Hogar: $35.000
*/

-- Insertar productos básicos
INSERT INTO products (code, name, description, type, price) VALUES
('AGUA-20L', 'Recarga Agua Purificada 20L', 'Recarga de agua purificada en botellón de 20 litros', 'water', 3500),
('DISP-VENT', 'Dispensador Pedestal con Ventilador', 'Dispensador de agua con pedestal y sistema de ventilación', 'dispenser', 45000),
('DISP-COMP', 'Dispensador Pedestal con Compresor', 'Dispensador de agua con pedestal y sistema de refrigeración por compresor', 'dispenser', 65000),
('DISP-PVC', 'Dispensador PVC', 'Dispensador de agua básico de PVC', 'dispenser', 25000),
('BOMB-USB', 'Bomba USB', 'Bomba de agua USB recargable', 'accessory', 8000);

-- Insertar packs
INSERT INTO products (code, name, description, type, price) VALUES
('PACK-PRO', 'Pack Pro', '1 Dispensador con Compresor + 3 Botellones', 'pack', 75000),
('PACK-HOME', 'Pack Hogar', '1 Dispensador PVC + 3 Botellones', 'pack', 35000);