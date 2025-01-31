/*
  # Add order totals columns

  1. Changes
    - Add subtotal column to orders table
    - Add tax column to orders table
    - Add default values for existing orders
*/

-- Add subtotal and tax columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2);

-- Update existing rows to calculate subtotal and tax from total_amount
UPDATE orders 
SET 
  subtotal = ROUND(total_amount / 1.19, 2),
  tax = ROUND(total_amount - (total_amount / 1.19), 2)
WHERE subtotal IS NULL OR tax IS NULL;