-- Crear tabla de configuración del sistema
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Usuarios autenticados pueden ver configuración" ON settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo administradores pueden modificar configuración" ON settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Insertar configuración inicial
INSERT INTO settings (key, value, description, category) VALUES
  (
    'company',
    '{
      "name": "Agua Pura",
      "rut": "76.123.456-7",
      "address": "Av. Principal 123",
      "phone": "+56 2 2345 6789",
      "email": "contacto@aguapura.cl"
    }'::jsonb,
    'Información de la empresa',
    'general'
  ),
  (
    'billing',
    '{
      "tax_rate": 19,
      "currency": "CLP",
      "payment_methods": ["efectivo", "transferencia", "tarjeta"]
    }'::jsonb,
    'Configuración de facturación',
    'financial'
  ),
  (
    'inventory',
    '{
      "low_stock_threshold": 20,
      "critical_stock_threshold": 10,
      "default_location": "almacen"
    }'::jsonb,
    'Configuración de inventario',
    'inventory'
  ),
  (
    'delivery',
    '{
      "start_time": "08:00",
      "end_time": "18:00",
      "max_daily_routes": 3,
      "max_stops_per_route": 20
    }'::jsonb,
    'Configuración de entregas',
    'operations'
  ),
  (
    'notifications',
    '{
      "low_stock_alerts": true,
      "payment_reminders": true,
      "delivery_notifications": true
    }'::jsonb,
    'Configuración de notificaciones',
    'system'
  );