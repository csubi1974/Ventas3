export interface DeliveryRouteItem {
  id: string;
  product_id: string;
  product: {
    code: string;
    name: string;
    type: string;
    price: number;
  };
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface DeliveryRoute {
  id: string;
  date: string;
  order: number;
  customer: {
    id: string;
    name: string;
    code: string;
    phone: string;
    address: string;
  };
  items: DeliveryRouteItem[];
  bottles_to_deliver: number;
  bottles_to_collect: number;
  bottles_in_circulation: number;
  bottles_owned: number;
  bottles_balance: number;
  observation: string;
  subtotal: number;
  tax: number;
  total: number;
  payment: {
    amount: number;
    method: 'efectivo' | 'transfer' | 'pendiente';
  };
  sale_type: 'scheduled' | 'direct';
  sale_status: 'pending' | 'confirmed' | 'cancelled';
  status: 'pendiente' | 'completado' | 'cancelado';
}

export interface BottlesBalance {
  inCirculation: number;
  owned: number;
  toDeliver: number;
  toCollect: number;
  balance: number;
}