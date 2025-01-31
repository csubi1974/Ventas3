/*
  # Add payment method to orders

  1. Changes
    - Add payment_method column to orders table
    - Add check constraint for valid payment methods
*/

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('efectivo', 'transfer', 'pendiente'));

-- Update existing rows to have a default value
UPDATE orders 
SET payment_method = 'efectivo' 
WHERE payment_method IS NULL;