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

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

#### Public Keys (safe to commit in `.env`)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Supabase Dashboard → Settings → API |

These are **public** keys designed to be exposed in client-side code. Supabase uses Row Level Security (RLS) to protect data.

#### Secret Keys (NEVER commit - use `.env.local`)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `CLAUDE_API_KEY` | Anthropic API key | [console.anthropic.com](https://console.anthropic.com/) |

⚠️ **IMPORTANT**: The Claude API key is a **secret** and must NEVER be committed to git.

- **Local development**: Add to `.env.local` (gitignored)
- **Vercel deployment**: Add via Settings → Environment Variables
- **Other platforms**: Use their secure environment variable system

### 2. Supabase Database Setup

**IMPORTANT**: The database schema is already set up in your Supabase project.

Required tables:
- `user_prefs` - User preferences and settings
- `learn_items` - AI-generated learning content
- `saved_items` - Bookmarked items
- `lesson_plans` - Generated learning plans
- `user_events` - Event tracking for personalization
- `home_recos` - Topic recommendation history
- `topic_options_cache` - Cached topic suggestions

All tables have Row Level Security (RLS) policies enabled for data protection.

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

### Vercel

1. Connect your repository
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` (can also be in repo)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (can also be in repo)
   - `CLAUDE_API_KEY` (**must** be added as secret env var)
3. Deploy

## Security Notes

- Supabase `anon` key is **public by design** - it's meant to be in client code
- All data protection is handled by Row Level Security (RLS) policies
- Claude API key is **private** and only used server-side in `/api/generate`
- Never commit `.env.local` or any file containing `CLAUDE_API_KEY`

## License

MIT
