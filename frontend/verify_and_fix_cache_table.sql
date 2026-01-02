-- Verify and fix topic_options_cache table structure

-- 1. Check current table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'topic_options_cache'
ORDER BY ordinal_position;

-- 2. Check if user_id is the primary key
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'topic_options_cache'::regclass
  AND contype = 'p';

-- 3. Check recent cache entries
SELECT
  user_id,
  session_id,
  created_at,
  NOW() - created_at as age,
  (created_at > NOW() - INTERVAL '10 minutes') as is_fresh,
  jsonb_pretty(options) as options_preview
FROM topic_options_cache
ORDER BY created_at DESC
LIMIT 3;

-- 4. If table structure is wrong, drop and recreate
-- IMPORTANT: Only run this section if the above queries show incorrect structure

-- DROP TABLE IF EXISTS topic_options_cache CASCADE;

-- CREATE TABLE topic_options_cache (
--   user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   options JSONB NOT NULL,
--   session_id TEXT NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- ALTER TABLE topic_options_cache ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can manage own cache"
--   ON topic_options_cache
--   FOR ALL
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
