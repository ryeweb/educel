-- Fix foreign key constraint issue on user_events table

-- 1. Check current constraint
SELECT
  conname as constraint_name,
  conrelid::regclass as table_name,
  confrelid::regclass as referenced_table,
  confupdtype as on_update,
  confdeltype as on_delete
FROM pg_constraint
WHERE conname = 'user_events_learn_item_id_fkey';

-- 2. Drop the restrictive foreign key constraint
ALTER TABLE user_events
DROP CONSTRAINT IF EXISTS user_events_learn_item_id_fkey;

-- 3. Add it back with proper cascade behavior (SET NULL on delete/update)
-- This allows learn_items to be updated/deleted without breaking user_events
ALTER TABLE user_events
ADD CONSTRAINT user_events_learn_item_id_fkey
FOREIGN KEY (learn_item_id)
REFERENCES learn_items(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- 4. Verify the fix
SELECT
  conname as constraint_name,
  confupdtype as on_update,
  confdeltype as on_delete
FROM pg_constraint
WHERE conname = 'user_events_learn_item_id_fkey';
