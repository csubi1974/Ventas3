/*
  # Agregar soporte para múltiples productos en rutas de reparto

  1. Nueva Tabla
    - `delivery_route_items`
      - `id` (uuid, primary key)
      - `delivery_route_id` (uuid, referencia a delivery_routes)
      - `product_id` (uuid, referencia a products)
      - `quantity` (integer)
      - `unit_price` (decimal)
      - `total_price` (decimal)
      - `created_at` (timestamptz)

  2. Seguridad
    - Habilitar RLS en la tabla
    - Agregar políticas para usuarios autenticados
*/

-- Crear tabla de items de reparto
CREATE TABLE delivery_route_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_route_id UUID REFERENCES delivery_routes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE delivery_route_items ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Usuarios autenticados pueden ver items de reparto" ON delivery_route_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear items de reparto" ON delivery_route_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar items de reparto" ON delivery_route_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar items de reparto" ON delivery_route_items
  FOR DELETE
  TO authenticated
  USING (true);

-- Crear índices para mejorar el rendimiento
CREATE INDEX delivery_route_items_route_id_idx ON delivery_route_items(delivery_route_id);
CREATE INDEX delivery_route_items_product_id_idx ON delivery_route_items(product_id);

-- Actualizar la tabla delivery_routes para manejar totales
ALTER TABLE delivery_routes 
ADD COLUMN subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN tax DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN total DECIMAL(10,2) NOT NULL DEFAULT 0;