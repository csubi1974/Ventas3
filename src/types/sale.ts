export interface SaleItem {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  sale_number: string;
  customer_id: string;
  customer_name: string;
  customer_rut: string;
  date: string;
  subtotal: number;
  tax: number;
  total: number;
  items: SaleItem[];
  created_at: string;
  updated_at: string;
}