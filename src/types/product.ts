export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: 'water' | 'dispenser' | 'accessory' | 'pack';
  price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}