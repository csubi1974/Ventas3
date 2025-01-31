/*
  # Crear tabla de rutas de reparto

  1. Nueva Tabla
    - `delivery_routes`
      - `id` (uuid, primary key)
      - `date` (date)
      - `order` (integer)
      - `customer_id` (uuid, referencia a customers)
      - `bottles_to_deliver` (integer)
      - `bottles_to_collect` (integer)
      - `observation` (text)
      - `payment_amount` (decimal)
      - `payment_method` (text)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Seguridad
    - Habilitar RLS en la tabla
    - Agregar políticas para usuarios autenticados
*/

-- Crear tabla de rutas de reparto
CREATE TABLE delivery_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  "order" INTEGER NOT NULL,
  customer_id UUID REFERENCES customers(id),
  bottles_to_deliver INTEGER NOT NULL DEFAULT 0,
  bottles_to_collect INTEGER NOT NULL DEFAULT 0,
  observation TEXT,
  payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'transfer', 'pendiente')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'completado', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Usuarios autenticados pueden ver rutas" ON delivery_routes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear rutas" ON delivery_routes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar rutas" ON delivery_routes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar rutas" ON delivery_routes
  FOR DELETE
  TO authenticated
  USING (true);

-- Crear índices para mejorar el rendimiento
CREATE INDEX delivery_routes_date_idx ON delivery_routes(date);
CREATE INDEX delivery_routes_customer_id_idx ON delivery_routes(customer_id);