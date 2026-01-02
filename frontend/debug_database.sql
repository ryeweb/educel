-- Debug queries to check database state

-- 1. Check if topic_options_cache has any data
SELECT
  user_id,
  session_id,
  created_at,
  (created_at > NOW() - INTERVAL '10 minutes') as is_fresh,
  options
FROM topic_options_cache
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if learn_items are being created
SELECT
  id,
  topic,
  source_type,
  created_at,
  expires_at,
  (expires_at IS NULL OR expires_at > NOW()) as is_valid
FROM learn_items
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if home_recos are being tracked
SELECT
  session_id,
  slot,
  topic,
  created_at
FROM home_recos
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if user_events are being logged
SELECT
  event_type,
  topic,
  created_at
FROM user_events
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check table existence and structure
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('topic_options_cache', 'home_recos', 'user_events', 'learn_items', 'user_prefs')
ORDER BY table_name;
