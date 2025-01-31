/*
  # Configuración del sistema de inventario

  1. Nuevas Tablas
    - `inventory_movements`
      - Registra todos los movimientos de inventario
      - Tipos: entrada, salida, ajuste, préstamo, devolución
      - Referencia al producto y cantidad
      - Tracking de stock actual
    - `inventory_alerts`
      - Configuración de alertas por producto
      - Define niveles mínimos de stock
      - Permite personalizar umbrales por producto

  2. Modificaciones
    - Actualización de la tabla `inventory`
      - Nuevos campos para mejor control de stock
      - Separación por estados y ubicaciones

  3. Seguridad
    - Políticas RLS para control de acceso
    - Restricciones para mantener integridad de datos
*/

-- Modificar la tabla inventory existente
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS location TEXT CHECK (location IN ('almacen', 'ruta', 'cliente')) DEFAULT 'almacen',
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('disponible', 'reservado', 'prestado', 'mantenimiento')) DEFAULT 'disponible',
ADD COLUMN IF NOT EXISTS serial_number TEXT,
ADD COLUMN IF NOT EXISTS condition TEXT CHECK (condition IN ('nuevo', 'usado', 'reparado')) DEFAULT 'nuevo';

-- Crear tabla para movimientos de inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id),
  type TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste', 'prestamo', 'devolucion')),
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('order', 'adjustment', 'maintenance')),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla para alertas de inventario
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  min_quantity INTEGER NOT NULL,
  alert_quantity INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Usuarios autenticados pueden ver movimientos" ON inventory_movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden crear movimientos" ON inventory_movements
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden ver alertas" ON inventory_alerts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden gestionar alertas" ON inventory_alerts
  FOR ALL TO authenticated USING (true);

-- Insertar configuración inicial de alertas
INSERT INTO inventory_alerts (product_id, min_quantity, alert_quantity)
SELECT 
  id as product_id,
  CASE 
    WHEN type = 'water' THEN 40  -- Botellones
    WHEN type = 'dispenser' THEN 5  -- Dispensadores
    WHEN type = 'accessory' AND code = 'TAPA-1000' THEN 1000  -- Tapas (1 caja)
    ELSE 10  -- Otros productos
  END as min_quantity,
  CASE 
    WHEN type = 'water' THEN 60  -- Alertar cuando quedan 60 botellones
    WHEN type = 'dispenser' THEN 8  -- Alertar cuando quedan 8 dispensadores
    WHEN type = 'accessory' AND code = 'TAPA-1000' THEN 2000  -- Alertar cuando quedan 2 cajas de tapas
    ELSE 15  -- Otros productos
  END as alert_quantity
FROM products
WHERE active = true
ON CONFLICT DO NOTHING;