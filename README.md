# [PRODUCT_NAME]

Personalized AI morning digest for US thoroughbred handicappers. We score
every race on the tracks a user follows against their handicapping profile and
deliver a digest of five races worth their time each morning, with verifiable
reasoning.

Working name is TBD — `[PRODUCT_NAME]` is a placeholder in user-facing strings.

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript (strict)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase Postgres
- **ORM:** Drizzle (migrations checked in)
- **Data:** theracingapi.com (North America add-on)
- **Hosting:** Vercel

## Prerequisites

- Node.js 22+
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/local-development) (optional,
  for running Postgres locally — requires Docker)

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Local Supabase

The Supabase CLI runs Postgres + Studio locally in Docker:

```bash
npx supabase init            # one-time, creates ./supabase
npx supabase start           # boots Postgres + Studio
npx supabase status          # prints local URLs + keys
```

- Studio dashboard: `http://localhost:54323`
- API URL: `http://localhost:54321`
- Copy the printed `DB URL` into `DATABASE_URL`, and the API URL / anon key /
  service role key into the matching `.env.local` vars.

Stop it with `npx supabase stop`.

### Database migrations

Schema lives in `db/schema.ts`; migrations are checked into `db/migrations/`.

```bash
npm run db:generate   # diff schema.ts -> new SQL migration
npm run db:migrate    # apply pending migrations to DATABASE_URL
```

Migrations must be applied to the hosted Supabase database before auth and
onboarding work. `0001_auth_user_trigger.sql` installs a trigger on
`auth.users`; if you apply migrations by pasting SQL into the Supabase SQL
Editor instead, run the files in numeric order.

### Authentication

Auth is Supabase email + password via `@supabase/ssr`. In the Supabase
dashboard set the Site URL and redirect URLs to your deployment domain. Email
confirmation is optional: with it on, the `/auth/confirm` route handles the
emailed link; with it off, signup logs the user straight in.

## Environment variables

See [`.env.example`](./.env.example). Copy it to `.env.local`.

| Variable | Purpose | Needed by |
| --- | --- | --- |
| `DATABASE_URL` | Supabase Postgres connection string (Drizzle) | M0+ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | M1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (browser) key | M1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role (server) key | M1 |
| `RACING_API_BASE_URL` | theracingapi.com base URL | M0+ |
| `RACING_API_USERNAME` | theracingapi.com HTTP Basic username | M0+ |
| `RACING_API_PASSWORD` | theracingapi.com HTTP Basic password | M0+ |
| `ANTHROPIC_API_KEY` | Claude API (onboarding + digest reasoning) | M2 |
| `CRON_SECRET` | Bearer token guarding `GET /api/cron/ingest` | M3 |
| `RESEND_API_KEY` | Email delivery | M4 |
| `STRIPE_SECRET_KEY` | Billing — see TODO(M5) in `.env.example` | M5 |

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript check (no emit) |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:generate` | Generate a Drizzle migration from `db/schema.ts` |
| `npm run db:migrate` | Apply pending Drizzle migrations to `DATABASE_URL` |

The live Racing API integration test (`tests/racing.integration.test.ts`) is
skipped automatically unless `RACING_API_USERNAME` / `RACING_API_PASSWORD` are
set, so `npm test` is safe to run in CI without credentials.

## Project structure

```
app/
  page.tsx            Landing + lightweight email capture
  login/ signup/      Email + password auth pages
  onboarding/         Deterministic onboarding form
  dashboard/          Saved profile (post-onboarding)
  auth/confirm/       Email-confirmation route handler
  api/cron/ingest/    Race-ingestion trigger (CRON_SECRET-guarded)
middleware.ts         Session refresh + route gating
db/
  schema.ts           Drizzle schema: users, user_preferences, email_signups,
                      handicapper_profile, onboarding_conversations, races
  migrations/         Checked-in SQL migrations
  index.ts            Lazy Drizzle client over Supabase Postgres
  queries.ts          Typed read helpers
lib/
  env.ts              Typed environment-variable access
  supabase/           Browser / server / middleware Supabase clients
  actions/            Server actions: auth, onboarding, email capture
  onboarding/         Onboarding options + Zod schema
  racing/
    types.ts          Raw NA API schemas (Zod) + normalized domain types
    client.ts         RacingApiClient — fetchTodayUSRacecards()
    regions.ts        RegionStrategy: UsRegionStrategy + UkRegionStrategy stub
    canonical.ts      Surface / class / distance canonicalization
    ingest.ts         Racecard → races-row mapping + idempotent upsert
tests/                Unit + (skippable) live integration tests
  fixtures/racing/    Captured-shape Racing API meets / entries fixtures
```

## Region architecture

The Racing API client returns region-agnostic `Racecard` values. Region-specific
behaviour lives behind the `RegionStrategy` interface in `lib/racing/regions.ts`.
v1 implements `UsRegionStrategy` only; `UkRegionStrategy` is a typed stub that
throws — UK/IE racing is an explicit v1 non-goal.
