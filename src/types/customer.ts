export interface Customer {
  id: string;
  code: string;
  rut?: string;
  full_name: string;
  type: 'personal' | 'business';
  street: string;
  number: string;
  district: string;
  city: string;
  reference?: string;
  phone?: string;
  email?: string;
  contact?: string;
  comments?: string;
  created_at: string;
  updated_at: string;
}