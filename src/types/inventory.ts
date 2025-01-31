export interface InventoryItem {
  id: string;
  product_id: string;
  product: {
    code: string;
    name: string;
    type: string;
  };
  quantity: number;
  type: string;
  location: 'almacen' | 'ruta' | 'cliente';
  status: 'disponible' | 'reservado' | 'prestado' | 'mantenimiento';
  serial_number?: string;
  condition: 'nuevo' | 'usado' | 'reparado';
  last_count_date: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_id: string;
  type: 'entrada' | 'salida' | 'ajuste' | 'prestamo' | 'devolucion';
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type?: 'order' | 'adjustment' | 'maintenance';
  reference_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface InventoryAlert {
  id: string;
  product_id: string;
  min_quantity: number;
  alert_quantity: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}