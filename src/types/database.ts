export interface Database {
  public: {
    Tables: {
      orders: {
        Row: {
          id: number
          customer_id: string
          total_amount: number
          status: string
          payment_status: string
          channel: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          customer_id: string
          total_amount: number
          status: string
          payment_status: string
          channel: string
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: number
          order_id: number
          product_id: string
          quantity: number
          unit_price: number
          total_price: number
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          order_id: number
          product_id: string
          quantity: number
          unit_price: number
          total_price: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
