# Supabase Database Setup for Educel

Run these SQL commands in your Supabase SQL Editor (Dashboard → SQL Editor → New Query).

---

## For NEW Users (Fresh Setup)

If you're setting up Educel for the first time, run Section A only.

## For EXISTING Users (Already have tables)

If you already ran the original setup and have data, **skip to Section B** (Safe Migration).

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learn_items_user_id_idx ON learn_items(user_id);
CREATE INDEX IF NOT EXISTS learn_items_created_at_idx ON learn_items(created_at DESC);

-- Saved Items Table
CREATE TABLE IF NOT EXISTS saved_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learn_item_id UUID NOT NULL REFERENCES learn_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, learn_item_id)
);

CREATE INDEX IF NOT EXISTS saved_items_user_id_idx ON saved_items(user_id);

-- Lesson Plans Table
CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learn_item_id UUID NOT NULL REFERENCES learn_items(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  goals JSONB NOT NULL DEFAULT '[]',
  resources JSONB NOT NULL DEFAULT '[]',
  exercises JSONB NOT NULL DEFAULT '[]',
  daily_plan JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, learn_item_id)
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
-- 1. Add theme column to user_prefs (if it doesn't exist)
-- This preserves all existing user data
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
    RAISE NOTICE 'theme column already exists in user_prefs';
  END IF;
END $$;

-- 2. Create lesson_plans table (safe - uses IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learn_item_id UUID NOT NULL REFERENCES learn_items(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  goals JSONB NOT NULL DEFAULT '[]',
  resources JSONB NOT NULL DEFAULT '[]',
  exercises JSONB NOT NULL DEFAULT '[]',
  daily_plan JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, learn_item_id)
);

-- 3. Enable RLS on lesson_plans (safe to run multiple times)
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

-- 4. Create indexes (safe - uses IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS lesson_plans_user_id_idx ON lesson_plans(user_id);
CREATE INDEX IF NOT EXISTS lesson_plans_learn_item_id_idx ON lesson_plans(learn_item_id);

-- 5. Add RLS policies for lesson_plans (only if they don't exist)
DO $$ 
BEGIN
  -- Check and create SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lesson_plans' AND policyname = 'Users can view own lesson plans'
  ) THEN
    CREATE POLICY "Users can view own lesson plans" ON lesson_plans
      FOR SELECT USING (auth.uid() = user_id);
    RAISE NOTICE 'Created SELECT policy for lesson_plans';
  END IF;
  
  -- Check and create INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lesson_plans' AND policyname = 'Users can insert own lesson plans'
  ) THEN
    CREATE POLICY "Users can insert own lesson plans" ON lesson_plans
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    RAISE NOTICE 'Created INSERT policy for lesson_plans';
  END IF;
  
  -- Check and create DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lesson_plans' AND policyname = 'Users can delete own lesson plans'
  ) THEN
    CREATE POLICY "Users can delete own lesson plans" ON lesson_plans
      FOR DELETE USING (auth.uid() = user_id);
    RAISE NOTICE 'Created DELETE policy for lesson_plans';
  END IF;
END $$;

-- Done! Your existing data is preserved.
SELECT 'Migration complete!' AS status;
```

---

## Configure Email Auth (In Dashboard)

1. Go to **Authentication** → **Providers** → **Email**
2. Enable **Email OTP** (Magic Link)
3. Configure email templates as needed

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

## Quick Verification

After running the SQL, verify your tables exist:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_prefs', 'learn_items', 'saved_items', 'lesson_plans');
```

You should see all 4 tables listed.
