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
app/                  Next.js App Router (placeholder landing page in M0)
db/
  schema.ts           Drizzle schema — empty until M1
  migrations/         Generated Drizzle migrations
  index.ts            Lazy Drizzle client over Supabase Postgres
lib/
  env.ts              Typed environment-variable access
  racing/
    types.ts          Raw NA API schemas (Zod) + normalized domain types
    client.ts         RacingApiClient — fetchTodayUSRacecards()
    regions.ts        RegionStrategy: UsRegionStrategy + UkRegionStrategy stub
tests/                Unit + (skippable) live integration tests
```

## Region architecture

The Racing API client returns region-agnostic `Racecard` values. Region-specific
behaviour lives behind the `RegionStrategy` interface in `lib/racing/regions.ts`.
v1 implements `UsRegionStrategy` only; `UkRegionStrategy` is a typed stub that
throws — UK/IE racing is an explicit v1 non-goal.
