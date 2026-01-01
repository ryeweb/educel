# Supabase Database Setup for Educel

Run these SQL commands in your Supabase SQL Editor (Dashboard → SQL Editor → New Query).

---

## For NEW Users (Fresh Setup)

If you're setting up Educel for the first time, run **Section A** only.

## For EXISTING Users (Already have tables)

If you already have tables, run **Section B** (Safe Migration) to add new features.

---

## Section A: Fresh Setup (New Users Only)

```sql
-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_topics TEXT[] NOT NULL DEFAULT '{}',
  depth TEXT NOT NULL DEFAULT 'concise' CHECK (depth IN ('concise', 'deeper')),
  theme TEXT NOT NULL DEFAULT 'auto' CHECK (theme IN ('light', 'dark', 'auto')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learn Items Table
CREATE TABLE IF NOT EXISTS learn_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('topic_choice', 'teach_me', 'learn_more', 'adjacent')),
  content JSONB NOT NULL,
  expanded_content JSONB DEFAULT NULL,
  expanded_created_at TIMESTAMPTZ DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learn_items_user_id_idx ON learn_items(user_id);
CREATE INDEX IF NOT EXISTS learn_items_created_at_idx ON learn_items(created_at DESC);
CREATE INDEX IF NOT EXISTS learn_items_expires_at_idx ON learn_items(expires_at) WHERE expires_at IS NOT NULL;

-- Saved Items Table (supports multiple item types)
CREATE TABLE IF NOT EXISTS saved_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'learning' CHECK (item_type IN ('learning', 'lesson_plan')),
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS saved_items_user_id_idx ON saved_items(user_id);
CREATE INDEX IF NOT EXISTS saved_items_item_type_idx ON saved_items(item_type);

-- Lesson Plans Table
CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learn_item_id UUID REFERENCES learn_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lesson_plans_user_id_idx ON lesson_plans(user_id);
CREATE INDEX IF NOT EXISTS lesson_plans_learn_item_id_idx ON lesson_plans(learn_item_id);

-- Enable RLS on all tables
ALTER TABLE user_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

-- User Prefs Policies
CREATE POLICY "Users can view own prefs" ON user_prefs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prefs" ON user_prefs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prefs" ON user_prefs
  FOR UPDATE USING (auth.uid() = user_id);

-- Learn Items Policies
CREATE POLICY "Users can view own learn items" ON learn_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learn items" ON learn_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learn items" ON learn_items
  FOR UPDATE USING (auth.uid() = user_id);

-- Saved Items Policies
CREATE POLICY "Users can view own saved items" ON saved_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved items" ON saved_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved items" ON saved_items
  FOR DELETE USING (auth.uid() = user_id);

-- Lesson Plans Policies
CREATE POLICY "Users can view own lesson plans" ON lesson_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lesson plans" ON lesson_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lesson plans" ON lesson_plans
  FOR DELETE USING (auth.uid() = user_id);
```

---

## Section B: Safe Migration (Existing Users)

**Run this if you already have the original tables set up.** This will NOT delete any existing data.

```sql
-- ============================================
-- SAFE MIGRATIONS - No data loss
-- ============================================

-- 1. Add theme column to user_prefs (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_prefs' AND column_name = 'theme'
  ) THEN
    ALTER TABLE user_prefs ADD COLUMN theme TEXT NOT NULL DEFAULT 'auto' 
      CHECK (theme IN ('light', 'dark', 'auto'));
    RAISE NOTICE 'Added theme column to user_prefs';
  ELSE
    RAISE NOTICE 'theme column already exists';
  END IF;
END $$;

-- 2. Add expanded_content columns to learn_items (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'learn_items' AND column_name = 'expanded_content'
  ) THEN
    ALTER TABLE learn_items ADD COLUMN expanded_content JSONB DEFAULT NULL;
    RAISE NOTICE 'Added expanded_content column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'learn_items' AND column_name = 'expanded_created_at'
  ) THEN
    ALTER TABLE learn_items ADD COLUMN expanded_created_at TIMESTAMPTZ DEFAULT NULL;
    RAISE NOTICE 'Added expanded_created_at column';
  END IF;
END $$;

-- 3. Add expires_at column to learn_items (for retention)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'learn_items' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE learn_items ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NULL;
    RAISE NOTICE 'Added expires_at column';
    
    -- Set default expiration for existing unsaved items (30 days from now)
    UPDATE learn_items 
    SET expires_at = NOW() + INTERVAL '30 days'
    WHERE id NOT IN (
      SELECT item_id FROM saved_items WHERE item_type = 'learning'
    );
    RAISE NOTICE 'Set expiration for existing unsaved items';
  END IF;
END $$;

-- 4. Add index for expires_at
CREATE INDEX IF NOT EXISTS learn_items_expires_at_idx 
  ON learn_items(expires_at) WHERE expires_at IS NOT NULL;

-- 5. Update saved_items to support multiple types
DO $$ 
BEGIN
  -- Add item_type column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_items' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE saved_items ADD COLUMN item_type TEXT NOT NULL DEFAULT 'learning' 
      CHECK (item_type IN ('learning', 'lesson_plan'));
    RAISE NOTICE 'Added item_type column to saved_items';
  END IF;
  
  -- Add item_id column if not exists (rename from learn_item_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_items' AND column_name = 'item_id'
  ) THEN
    -- Check if learn_item_id exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'saved_items' AND column_name = 'learn_item_id'
    ) THEN
      -- Rename column
      ALTER TABLE saved_items RENAME COLUMN learn_item_id TO item_id;
      RAISE NOTICE 'Renamed learn_item_id to item_id';
    ELSE
      ALTER TABLE saved_items ADD COLUMN item_id UUID NOT NULL;
      RAISE NOTICE 'Added item_id column';
    END IF;
  END IF;
END $$;

-- 6. Update unique constraint for saved_items
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'saved_items_user_id_learn_item_id_key'
  ) THEN
    ALTER TABLE saved_items DROP CONSTRAINT saved_items_user_id_learn_item_id_key;
  END IF;
  
  -- Create new composite unique constraint (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'saved_items_user_id_item_type_item_id_key'
  ) THEN
    ALTER TABLE saved_items ADD CONSTRAINT saved_items_user_id_item_type_item_id_key 
      UNIQUE (user_id, item_type, item_id);
    RAISE NOTICE 'Created new unique constraint';
  END IF;
END $$;

-- 7. Create lesson_plans table (if not exists)
CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learn_item_id UUID REFERENCES learn_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lesson_plans_user_id_idx ON lesson_plans(user_id);
CREATE INDEX IF NOT EXISTS lesson_plans_learn_item_id_idx ON lesson_plans(learn_item_id);

-- 8. Enable RLS on lesson_plans
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

-- 9. Add RLS policies for lesson_plans (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lesson_plans' AND policyname = 'Users can view own lesson plans'
  ) THEN
    CREATE POLICY "Users can view own lesson plans" ON lesson_plans
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lesson_plans' AND policyname = 'Users can insert own lesson plans'
  ) THEN
    CREATE POLICY "Users can insert own lesson plans" ON lesson_plans
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lesson_plans' AND policyname = 'Users can delete own lesson plans'
  ) THEN
    CREATE POLICY "Users can delete own lesson plans" ON lesson_plans
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 10. Add UPDATE policy for learn_items (for caching expanded content)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'learn_items' AND policyname = 'Users can update own learn items'
  ) THEN
    CREATE POLICY "Users can update own learn items" ON learn_items
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Done!
SELECT 'Migration complete!' AS status;
```

---

## Section C: Retention Cleanup (Optional - Run Manually or via Cron)

This query deletes expired, unsaved learnings. Run periodically (e.g., weekly) or set up as a Supabase cron job.

```sql
-- Delete expired, unsaved learn items
-- Safe: Only deletes items with expires_at in the past
-- Items that are saved have expires_at = NULL and won't be deleted

DELETE FROM learn_items
WHERE expires_at IS NOT NULL 
  AND expires_at < NOW();

-- Optional: View what would be deleted (run this first to check)
-- SELECT id, topic, expires_at 
-- FROM learn_items 
-- WHERE expires_at IS NOT NULL AND expires_at < NOW();
```

### Setting up Automated Cleanup (Supabase pg_cron)

If you want automatic cleanup, enable pg_cron in Supabase and create:

```sql
-- Enable pg_cron extension (run once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule weekly cleanup every Sunday at 3 AM UTC
SELECT cron.schedule(
  'cleanup-expired-learnings',
  '0 3 * * 0',
  $$DELETE FROM learn_items WHERE expires_at IS NOT NULL AND expires_at < NOW()$$
);
```

---

## Verification Queries

After running migrations, verify your schema:

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_prefs', 'learn_items', 'saved_items', 'lesson_plans');

-- Check learn_items columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'learn_items';

-- Check saved_items columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'saved_items';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_prefs', 'learn_items', 'saved_items', 'lesson_plans');
```

---

## Environment Variables

**`.env`** (public, safe to commit):
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**`.env.local`** (secret, never commit):
```
CLAUDE_API_KEY=your-claude-api-key
```

---

## Retention Rules Summary

| Item Type | Expiration |
|-----------|------------|
| Unsaved learnings | 30 days from creation |
| Saved learnings | Never expires |
| Lesson plans | Never expires (always auto-saved) |

When a user saves a learning, `expires_at` is set to `NULL`.
When a user unsaves a learning, `expires_at` is reset to 30 days from now.
