# Supabase Database Setup for Educel

Run these SQL commands in your Supabase SQL Editor (Dashboard → SQL Editor → New Query).

## 1. Create Tables

```sql
-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_topics TEXT[] NOT NULL DEFAULT '{}',
  depth TEXT NOT NULL DEFAULT 'concise' CHECK (depth IN ('concise', 'deeper')),
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

-- Create index for faster queries
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS saved_items_user_id_idx ON saved_items(user_id);
```

## 2. Enable Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE user_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
```

## 3. Create RLS Policies

```sql
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
```

## 4. Configure Email Auth (In Dashboard)

1. Go to **Authentication** → **Providers** → **Email**
2. Enable **Email OTP** (Magic Link)
3. Configure email templates as needed

## 5. Environment Variables

Make sure your `.env` file has:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
CLAUDE_API_KEY=your-claude-api-key
```

## Quick Test

After running the SQL, you can test by trying to sign in with your email. You should receive a magic link that logs you in and redirects to onboarding.
