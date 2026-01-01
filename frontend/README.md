# Educel - Personal Knowledge Feed

A production-ready MVP web app that delivers short, AI-generated learning cards for knowledge workers and founders.

## Features

- **Pick a Lane**: 3 AI-generated topic cards based on your preferences
- **Teach Me About**: Ask anything specific, with smart clarifying questions for broad topics
- **Learn Cards**: Scannable format with title, hook, bullets, example, and micro-action
- **Quiz Mode**: Test your understanding with built-in questions
- **Save & Continue**: Bookmark items and continue where you left off
- **Explore Adjacent**: Discover related topics from any learn card

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Auth + Postgres with RLS)
- **Claude AI** (Claude Sonnet 4 for content generation)
- **Tailwind CSS** + shadcn/ui

## Setup

### 1. Environment Variables

Create a `.env` file in the frontend directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
CLAUDE_API_KEY=your-claude-api-key
```

### 2. Supabase Database Setup

**IMPORTANT**: You must run the SQL migrations in your Supabase dashboard.

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** → **New Query**
3. Copy and run all the SQL from `SUPABASE_SETUP.md`

This creates:
- `user_prefs` table (user preferences)
- `learn_items` table (generated learning content)
- `saved_items` table (bookmarked items)
- Row Level Security policies

### 3. Enable Email Auth

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Enable "Magic Link" / OTP login

### 4. Run Locally

```bash
cd frontend
yarn install
yarn dev
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home - Topic picks, Teach me input, Continue section |
| `/onboarding` | First-time setup - Select topics and depth |
| `/learn/[id]` | View a learning card with actions |
| `/saved` | View saved items |
| `/settings` | Update preferences |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/generate` | POST | Generate AI content (topic options, learn items, etc.) |
| `/api/auth/login` | POST | Send magic link email |
| `/api/auth/logout` | POST | Sign out |
| `/api/prefs` | GET/POST | User preferences |
| `/api/learn` | GET/POST | Learning items |
| `/api/saved` | GET/POST/DELETE | Saved items |

## Deployment

Deploy to Vercel:

1. Connect your repository
2. Add environment variables in Vercel dashboard
3. Deploy

## License

MIT
