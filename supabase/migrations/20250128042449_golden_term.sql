/*
  # Update orders channel constraint

  1. Changes
    - Drop existing channel check constraint
    - Add new channel check constraint with 'mobile_sales' option
*/

-- Drop existing constraint
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_channel_check;

-- Add new constraint with mobile_sales option
ALTER TABLE orders 
ADD CONSTRAINT orders_channel_check 
CHECK (channel IN ('in_person', 'phone', 'whatsapp', 'route', 'mobile_sales'));