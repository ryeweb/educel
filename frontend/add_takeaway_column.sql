-- Add one_line_takeaway column to learn_items if it doesn't exist
ALTER TABLE learn_items 
ADD COLUMN IF NOT EXISTS one_line_takeaway TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'learn_items' 
  AND column_name = 'one_line_takeaway';
