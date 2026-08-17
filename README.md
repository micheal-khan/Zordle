# Zordle

A polished daily five-letter word game built with Next.js, TypeScript, Supabase, and an optional OpenAI-powered nudge.

## What works now

- Six-guess daily puzzle with duplicate-letter-safe scoring
- Physical and on-screen keyboards, responsive layout, reveal and error animations
- Local daily progress, streaks, win percentage, guess distribution, and share grid
- Required Supabase email authentication and cross-device result sync
- Editable player profiles, a 12-month contribution-style activity calendar, and an authenticated leaderboard
- Optional OpenAI spoiler-safe hint after two submitted guesses, with an offline fallback
- Server-side answer evaluation so the daily solution is not shipped in the browser bundle
- Public word validation API fallback via WordSoHard; common guesses remain available offline

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/20260817110924_add_profiles_activity_leaderboard.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and add the Project URL and publishable key.
4. In Supabase Auth, configure your site URL and redirect URLs for local and production domains.

The migration enables RLS, keeps each player's puzzle history private, and exposes only profile names plus aggregate scores to signed-in players. Never put a secret or service-role key in `NEXT_PUBLIC_*` variables.

## Optional OpenAI hint

Add `OPENAI_API_KEY` to `.env.local`. `OPENAI_HINT_MODEL` defaults to `gpt-5.6-luna`. The key is only read by the server route and is never exposed to the client.

## Word data

The bundled daily-answer pool is original/common-word curation. Guess validation first checks a local common-word set and then uses the keyless [WordSoHard API](https://wordsohard.com/api) for broader validation. A production version can replace the compact local set with the public-domain [ENABLE five-letter dataset](https://puzzlecottage.com/data/) without changing the game API.

“Zordle” is an independent word game and is not affiliated with or endorsed by The New York Times.
