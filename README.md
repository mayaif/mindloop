# MindLoop

A habit tracker with a real AI coach — built to demonstrate a universal
Expo app (iOS, Android, and web from one codebase), offline-first sync,
live cross-device updates, and a genuine multi-agent LLM pipeline, not a
single prompt-and-display wrapper.

**Live web demo:** https://mindloop-five.vercel.app (sign in as guest — no
account needed)

## What it does

- **Daily habit tracking** — water, sleep, exercise/steps, mood,
  meditation, reading. Log manually with a tap, or let two of them
  (Sleep, Steps) sync automatically from Apple Health on iOS.
- **Offline-first.** Every write lands in a local SQLite database first
  and works with no connection; a background sync pushes/pulls against
  Supabase Postgres when online, with Supabase Realtime pushing changes
  from other devices back in live.
- **AI weekly coach.** A three-stage Groq-backed pipeline (reviewer →
  coach → tone-check-with-one-revision) reads the last 7 days of logs and
  produces a plain-English review plus 2–3 concrete micro-goals for next
  week. The result is cached per-user/per-week — generating one costs a
  real LLM call, opening the tab again doesn't.
- **Daily reminder notifications** (native only — scheduled local
  notifications aren't meaningfully supported on web).
- **Guest-first auth.** Try the whole app with zero signup via Supabase
  anonymous auth; upgrade to a real email/password account later without
  losing any data (`user_id` never changes on upgrade).

## Why it's built this way

This app exists to demonstrate patterns from real production work:
React Native/Expo experience, offline-first architecture, real-time
features, and responsible use of LLMs in a product (deterministic data
layer, the model only ever produces natural-language text — never SQL,
never writes it can't be validated). See the [multi-agent pipeline](#the-ai-coach-pipeline)
section below for the technical detail.

## Tech stack

- **Expo Router + React Native + TypeScript** — one codebase compiles to
  iOS, Android, and a real website (`expo export --platform web`), not
  three separate projects.
- **NativeWind (Tailwind for RN)** — see `src/theme/colors.ts` for the
  single source of truth the palette and every icon color read from.
- **expo-sqlite** — local-first data layer.
- **Supabase** — Postgres (server mirror), Realtime (cross-device sync),
  Auth (anonymous + email/password), Edge Functions (the one place the
  Groq key lives).
- **@kingstinct/react-native-healthkit** — Apple Health integration
  (iOS only; requires a custom dev client, not Expo Go — see below).
- **Groq** (`openai/gpt-oss-120b` / `openai/gpt-oss-20b`) — the coach
  pipeline's LLM calls.
- **expo-notifications** — daily reminder scheduling.

## The AI coach pipeline

`supabase/functions/weekly-coach` (a Deno Edge Function — the only place
`GROQ_API_KEY` exists, since this is a client-only app with no server of
its own):

1. **Reviewer** reads the week's habit logs and drafts a trends/wins/
   struggles summary.
2. **Coach** takes the reviewer's summary and proposes 2–3 concrete,
   achievable micro-goals for next week.
3. **Tone check** verifies the coaching message reads as supportive, not
   judgmental — with one automatic revision pass if it doesn't, before
   anything reaches the user.

The model only ever produces natural-language text that gets displayed
as-is — it never generates a database query, never decides what data to
read (that's a fixed, deterministic "last 7 days of logs" query the app
runs before calling the function), and never writes anything back except
through the app's own normal habit-logging code path. Structured output
(the goals list) is a small, fixed JSON shape the model fills in, not
freeform code.

## Running it locally

### Web

```bash
npm install
npx expo start --web
```

### iOS Simulator (native features: HealthKit, notifications)

HealthKit is a native module Expo Go doesn't support, so native testing
needs a custom dev client instead:

```bash
npx eas-cli build --profile development-simulator --platform ios
npx eas-cli build:run -p ios --latest   # installs it into the Simulator
npx expo start                          # then press i, or scan from the dev client
```

The `development-simulator` EAS profile targets the iOS Simulator, which
needs no Apple Developer account (free). A physical-device build
(`development` profile) requires a paid Apple Developer Program
membership for code signing.

To see real HealthKit data without a physical device/Apple Watch: open
the Simulator's **Health** app → **Browse** → **Sleep** or **Steps** →
add a data point manually, then **Settings → Apple Health → Sync now**
in MindLoop.

### Environment variables

Copy `.env.example` to `.env` and fill in the values — see that file for
what each one is for and where to get it. `EXPO_PUBLIC_`-prefixed values
are bundled into the client and required to run the app at all; the rest
are only needed if you're the one managing the Supabase/EAS projects.

### Database setup

Run `supabase/schema.sql` once in your Supabase project's SQL editor
(safe to re-run — every statement is idempotent). Push the Groq key to
the Edge Function's own secret store (see `.env.example` for the exact
command) and deploy it:

```bash
supabase functions deploy weekly-coach --project-ref <your-ref>
```

## Deployment

- **Web** deploys to Vercel on every push to `main` (static export via
  `expo export --platform web`, configured in `vercel.json` — see that
  file for the SPA rewrite rule Expo Router's client-side routing needs).
- **Native** builds go through EAS Build (see `eas.json` for the
  `development`, `development-simulator`, `preview`, and `production`
  profiles).

## Known simplifications

- **HealthKit is iOS-only.** Android's equivalent (Health Connect) isn't
  implemented — Sleep/Steps stay manual there, with an in-app note
  pointing at the iPhone app.
- **The weekly insight caches one "current" value per user**, not a full
  history — regenerating replaces it rather than keeping past weeks
  around. A real product version would likely keep a scrollable history.
- **No production Apple Developer account is wired up** — native builds
  ship through EAS's free Simulator profile for demo purposes; a real
  App Store release would need the paid developer program and store
  listing work this project doesn't cover.
- **Local SQLite migrations are hand-rolled** (`PRAGMA table_info` +
  guarded `ALTER TABLE`), not a formal migration framework — fine at this
  schema size, would need revisiting if the schema grew much further.
