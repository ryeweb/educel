-- Discovery and Caching Tables for Educel
-- Run this in your Supabase SQL Editor for the production database

-- 1. Topic Options Cache (stores generated topic suggestions for 10 min)
CREATE TABLE IF NOT EXISTS topic_options_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  options JSONB NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE topic_options_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own cache
CREATE POLICY "Users can manage own cache"
  ON topic_options_cache
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Home Recommendations (tracks which topics were shown to users)
CREATE TABLE IF NOT EXISTS home_recos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('A', 'B', 'C')),
  topic TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE home_recos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own recommendations
CREATE POLICY "Users can manage own recos"
  ON home_recos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_home_recos_user_created
  ON home_recos(user_id, created_at DESC);

-- 3. User Events (tracks user interactions for personalization)
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'reco_shown',
    'topic_clicked',
    'content_viewed',
    'quiz_completed',
    'saved',
    'plan_generated'
  )),
  topic TEXT,
  learn_item_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own events
CREATE POLICY "Users can manage own events"
  ON user_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_events_user_created
  ON user_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_events_user_type
  ON user_events(user_id, event_type);

-- Verify tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('topic_options_cache', 'home_recos', 'user_events')
ORDER BY table_name;
