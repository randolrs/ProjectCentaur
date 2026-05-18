# Project Status

## M6 — Subscription billing

**State:** Code-complete; production build, typecheck, and unit suites pass
locally. Migration `0007_m7_subscriptions.sql` is applied to the hosted
Supabase project. Non-functional until the founder completes the Stripe
dashboard setup and sets the env vars below.

_Last updated: 2026-05-18 · branch `claude/apply-m1-migration-KNaf6`_

### Shipped

- Stripe subscription billing with the **Payment Element** — `/subscribe`
  collects payment on our own page; the paywall sits after onboarding.
- `subscriptions` table mirroring Stripe state; `/api/stripe/webhook`
  (signature-verified) is the sole writer of subscription status.
- The digest pipeline gates delivery on an active subscription —
  `getDigestEligibleUsers` left-joins `subscriptions`, and only `active` /
  `past_due` users receive a digest.
- Dashboard shows subscription status with a Customer Portal "Manage
  billing" link; unsubscribed users see a Subscribe prompt.

### Decisions

- **Paid from day one, no trial** — the digest gates on `active`/`past_due`
  (a short grace window for a failed charge while Stripe retries).
- Webhook is the source of truth for `status`; `createSubscription` writes a
  row only so the webhook has one to update.
- The admin "Send a digest to one email" control bypasses the gate, so an
  unpaid test user can still be exercised.

### Deferred — founder action required

- **Stripe dashboard setup.** Create the product + a recurring monthly
  Price; register a webhook endpoint at `/api/stripe/webhook`. Then set in
  Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Configure the Customer Portal.

## M5 — Normalized racing data model

**State:** Code-complete; production build, typecheck, and unit suites pass
locally. Migration `0006_m6_normalized_racing.sql` is applied to the hosted
Supabase project. The migration wipes the `races` table (stale ingest data) to
add a non-null `meet_id`, so the racing tables are empty until ingestion is
re-run from `/admin`.

_Last updated: 2026-05-18 · branch `claude/apply-m1-migration-KNaf6`_

### Shipped

- Normalized the flat `races` table into a hierarchy: `tracks` → `meets` →
  `races` → `race_entries`, with `horses` / `jockeys` / `trainers` as
  dimension entities the entries reference.
- Ingestion upserts every entity on its natural key — provider ids for
  meets/jockeys/trainers, synthesized keys for tracks (canonical name) and
  horses (name + sire + dam) — in one dependency-ordered transaction.
- `races` keeps its denormalized digest-facing columns (`race_date`,
  `track_canonical`, canonical surface/class) so the digest query is
  unchanged; runner detail now also lives in `race_entries`.

### Decisions

- **Owners are not modeled.** The provider's entries feed carries no owner
  data; revisit if a source becomes available.
- **Horse identity** is `normalize(name) | sire | dam` — the feed gives
  horses no id, and North American horse names are registered-unique.
- The migration wipes `races` rather than backfilling a synthetic meet for
  stale rows — the data is regenerable by re-ingesting.

### Deferred — founder action required

- **Re-ingest.** The racing tables are empty post-migration; run "Ingest
  today's races" from `/admin` to repopulate the normalized hierarchy.

## M4 — Digest pipeline

**State:** Code-complete; production build, typecheck, and the unit test
suites pass locally. The `digests` migration (`0004_fantastic_thunderbolt.sql`)
is applied to the hosted Supabase project. Live end-to-end delivery is pending
founder action — the sandbox blocks the Anthropic API and outbound email, and
Resend is not yet configured.

_Last updated: 2026-05-17 · branch `claude/apply-m1-migration-KNaf6`_

### Shipped

- **`digests` table** (`db/schema.ts`, migration `0004`). One row per
  (user, racing day): the rendered digest (`content` jsonb), delivery status,
  Resend message id, and LLM cost. A unique `(user_id, race_date)` constraint
  makes the pipeline idempotent; owner-only RLS for reads.
- **Race selection** (`lib/digest/select.ts`) — `selectRacesForUser`, a pure
  deterministic filter narrowing a user's followed-track races to those
  matching their structured preferences (surface, class, distance range,
  field-size band), each carrying plain-language match reasons.
- **Digest LLM** (`lib/digest/llm.ts`) — `generateDigest` wraps Claude
  Sonnet 4.6: one call writes the whole digest (intro + per-race headline and
  reasoning). Prompt caching on the system prompt, adaptive thinking, retry on
  transient/parse failure, per-run token + USD cost tracking.
- **Assembly + fallback** (`lib/digest/render.ts`) — `buildRenderedDigest`
  merges model prose with the structured race fields; on model failure it
  builds a deterministic digest from the match reasons, so a user always gets
  a usable digest.
- **Email** (`lib/digest/email.ts`, `lib/email/resend.ts`) — inline-styled
  HTML + plain-text rendering; delivery via a dependency-free `fetch` wrapper
  over the Resend REST API.
- **Pipeline** (`lib/digest/pipeline.ts`) — `runHourlyDigest` walks every
  onboarded user, delivers to those for whom it is currently their delivery
  hour (`lib/digest/schedule.ts`, per-user timezone), skips any user who
  already has a digest for their local racing day, and isolates each user in
  a try/catch.
- **Cron** — `GET /api/cron/digest` (hourly) and the existing
  `/api/cron/ingest` (daily) are scheduled in `vercel.json`; both share the
  `CRON_SECRET` bearer guard (`lib/cron.ts`).
- **Tests** — `tests/digest-select.test.ts`, `tests/digest-schedule.test.ts`,
  `tests/digest-render.test.ts`, `tests/unit/digest-llm.test.ts`.

### Decisions

- **Deterministic filter, LLM reasoning.** The structured filter decides
  *which* races qualify; the LLM only explains *why* they fit this
  handicapper. The model never sees a race that failed the filter, so it
  cannot pad the digest.
- **One LLM call per user per day.** All selected races (capped at 10) go in
  one request, so the model can compare races and cost is one call. Sonnet
  4.6, consistent with M2.
- **Hourly cron, per-user delivery hour.** The digest cron runs hourly; each
  run delivers to users whose local time equals their `digest_delivery_hour`.
  This honours the per-user timezone + hour already in the schema. (Hourly
  Vercel Cron needs a Pro plan; Hobby runs cron once daily — see Deferred.)
- **Idempotent on (user, race_date).** A digest row — sent, skipped, or
  failed — blocks reprocessing for that user's racing day. A failed send is
  not auto-retried within the day, by design (no risk of duplicate emails).
- **No SDK dependency for email.** Resend is called via `fetch`, matching the
  Racing API client; no new package.

### Deferred — founder action required

- **Configure Resend.** Set `RESEND_API_KEY` in the Vercel project env (and
  locally). `DIGEST_FROM_EMAIL` defaults to Resend's shared dev sender
  (`onboarding@resend.dev`), which delivers only to the Resend account owner —
  enough for testing. For real delivery, verify a sender domain in Resend and
  set `DIGEST_FROM_EMAIL` to an address on it.
- **Vercel plan for hourly cron.** `vercel.json` schedules the digest cron
  hourly. Vercel Hobby runs cron at most once per day; hourly per-user
  delivery needs a Pro plan. On Hobby, either upgrade or change the digest
  schedule to a single fixed hour.
- **Live end-to-end run.** Once ingestion has populated `races` and Resend is
  configured, trigger `GET /api/cron/digest` with the bearer token — or use the
  admin console at `/admin` — and confirm an email is delivered and a `digests`
  row is written.
- **Configure admin access.** Set `ADMIN_EMAILS` (comma-separated) in the
  Vercel project env to the addresses allowed to reach `/admin`, the console
  for manually triggering ingestion and digest delivery. Unset means no admin.
- **Prompt-quality review.** Read generated digests against real race data and
  tune `lib/llm/prompts/us/digest_system.ts` — the digest is the product's
  core value and the prompt has not been exercised live.

## M3 — Race ingestion & query layer

**State:** Code-complete; production build, typecheck, and the unit +
integration test suites pass locally. The `races` migration
(`0003_bouncy_silver_centurion.sql`) is applied to the hosted Supabase
project. Live ingestion against the Racing API is pending: the sandbox blocks
`api.theracingapi.com` (the M0 deferral).

_Last updated: 2026-05-17 · branch `claude/apply-m1-migration-KNaf6`_

### Shipped

- **Corrected NA wire schemas.** M0 hand-guessed the theracingapi.com North
  America shapes because the docs were gated. The real OpenAPI 3.1 spec is now
  in hand, and `lib/racing/types.ts` + the normalizer in `lib/racing/regions.ts`
  are rewritten to match it: race number is nested in `race_key.race_number`;
  surface/distance are `surface_description` / `distance_description`;
  `jockey`/`trainer` are person objects (flattened to display names); the meets
  endpoint paginates (`limit` ≤ 50, `skip`). Runner-level scratches are tracked
  and excluded from `fieldSize`.
- **`races` table** (`db/schema.ts`, migration `0003`). One row per race,
  carrying the raw provider payload (`raw_data` jsonb) alongside structured,
  queryable columns — canonical surface / class, `distance_furlongs`,
  `post_timestamp`, `field_size`, `purse` — so the M4 digest can filter in SQL.
  Idempotency key `region|date|track|raceNumber`. RLS on; authenticated users
  may read; ingestion writes via the Drizzle owner role.
- **Canonicalization** (`lib/racing/canonical.ts`) — pure `canonicalSurface`,
  `canonicalRaceClass`, and `parseDistanceFurlongs` helpers that collapse the
  provider's free-form strings onto the fixed onboarding vocabulary
  (`lib/onboarding/options.ts`).
- **Ingestion** (`lib/racing/ingest.ts`) — `racecardToRow` /
  `racecardsToRows` (de-duplicated by natural key) and `ingestRacecards`, an
  idempotent `INSERT … ON CONFLICT DO UPDATE` upsert. `ingestTodaysUsRaces`
  fetches, normalizes, and persists today's US cards.
- **Trigger route** — `GET /api/cron/ingest`, guarded by a `CRON_SECRET`
  bearer token (the header Vercel Cron attaches automatically). M4 wires the
  actual schedule.
- **Query layer** (`db/queries.ts`) — `getRacesForDate` and
  `getRacesForTracks` (the digest's per-user followed-track scope).
- **Tests** — `tests/fixtures/racing/*.json` (real-shape captured-style
  meets + entries fixtures); `tests/racing.test.ts` rewritten for the real
  wire format; `tests/racing-ingest.test.ts` covers canonicalizers, the
  racecard→row mapping, key stability, and natural-key de-duplication.

### Decisions

- **Data source unchanged.** theracingapi.com remains the upstream; the
  founder's `beethoven` project was used only as a reference for how its
  racing data is modelled and consumed.
- **Single `races` table, runners as jsonb.** No separate `race_entries` /
  `tracks` tables — the digest scores whole racecards, and track is already a
  text field on user preferences. (`beethoven` splits these because it serves
  per-horse pages, which this product does not.)
- **Canonical fields are stored, not computed.** The digest filters races
  against user preferences; persisting `surface_canonical`,
  `race_class_canonical`, and `distance_furlongs` keeps that filtering in SQL.
- **Ingest route is `GET`.** Vercel Cron triggers via GET and attaches the
  `CRON_SECRET` bearer automatically; the upsert is idempotent regardless.

### Deferred — founder action required

- **Live ingestion verification.** Allowlist `api.theracingapi.com` on the
  environment's network policy (or run locally with `RACING_API_*` set), then
  hit `GET /api/cron/ingest` with the bearer token and confirm rows land in
  `races`. The fixtures match the published OpenAPI schema, but real-data
  field *values* (e.g. exact `surface_description` / `race_class` strings)
  should still be spot-checked on the first live run.

## M2 — Conversational onboarding

**State:** Code-complete; production build, typecheck, and the unit +
integration test suites pass locally. The M2 database migration is applied to
the hosted Supabase project. Live LLM verification and the three founder
prompt-quality tests are pending founder action — this sandbox's network policy
blocks the Anthropic API, and the quality bar is a human judgement.

_Last updated: 2026-05-17 · branch `claude/apply-m1-migration-KNaf6`_

### Shipped

- **Data model** — `handicapper_profile` (the structured conversation output,
  one row per user, owner-only RLS) and `onboarding_conversations` (transient
  per-user transcript, RLS-on with no policies). `users.onboarding_status`
  tracks `structured_complete` -> `conversation_complete`. Migration
  `0002_m2_handicapper_profile.sql`, applied to the hosted DB.
- **LLM layer** — `lib/onboarding/llm.ts` wraps Claude Sonnet 4.6
  (`claude-sonnet-4-6`) via the official `@anthropic-ai/sdk`. One call advances
  the conversation one turn; the static system prompt + few-shot examples are
  sent with `cache_control` for prompt caching; 30s timeout, SDK retry on 5xx,
  plus a parse-failure retry. Per-conversation token spend and USD cost are
  logged; a conversation over $1 logs a COST ALERT.
- **Prompts** — `lib/llm/prompts/us/` holds the racing-specific system prompt,
  the deterministic opener, and few-shot profile examples;
  `lib/onboarding/prompts.ts` is the region-agnostic accessor.
- **Conversation flow** — `/onboarding/conversation` runs a 4-6 turn interview
  (hard cap 8), one question at a time, rendered styled (not chat-bubble). The
  model returns either the next question or `done` with the synthesized
  profile. On repeated parse failure, an API error, or the hard cap, the flow
  falls back to a profile synthesized from the M1 structured answers, so
  onboarding always terminates with a usable profile.
- **Review** — `/onboarding/review` shows the captured profile in plain
  English with "Looks right" (-> dashboard) and "Edit" (a structured-field form
  validated against the Zod schema).
- **Gating** — M1 structured save -> `/onboarding/conversation`; the dashboard
  requires a finished `handicapper_profile`.
- **Tests** — `tests/unit/onboarding-schema.test.ts` (schema + JSON parsing),
  `tests/unit/onboarding-llm.test.ts` (Sonnet wrapper, mocked SDK, retry and
  failure paths), `tests/integration/onboarding-flow.test.ts` (full multi-turn
  happy path, mocked LLM).

### Decisions

- **Conversation state** — stored server-side in the transient
  `onboarding_conversations` table (one row per user, deleted on finalize),
  not client-held. Server-authoritative, survives reload; the 30-minute idle
  expiry is enforced from the row's `updated_at`.
- **Adaptive thinking** — the Sonnet calls run with `thinking: adaptive` so the
  model reasons before each question and before synthesizing the profile,
  prioritizing prompt quality over cost. `max_tokens` is 16000 and the request
  timeout is 60s to give thinking room. This pushes per-conversation cost above
  the spec's original ~$0.20-0.40 estimate (founder-approved ceiling ~$2); the
  $1 per-conversation COST ALERT log still fires as a spend tripwire.
- **JSON contract** — the model is prompted (not structured-output-constrained)
  to return one of two JSON shapes; `parseTurnResponse` tolerantly extracts and
  Zod-validates them, matching the spec's "if parsing fails twice, fall back".
- **`onboarding_status` default** — `structured_complete`, per the spec. The
  real structured-onboarding gate is the presence of a `user_preferences` row;
  `onboarding_status` meaningfully tracks only the conversation step.

### Deferred — founder action required

- **Live verification** on the Vercel preview: signup -> structured onboarding
  -> conversation -> review -> dashboard, plus the edit form.
- **Prompt-quality bar (blocks M2 close).** Run the three founder tests from
  the spec: the vocabulary test, the differentiation test (two synthetic users
  must produce visibly different profiles), and the "yeah, that's me" test.
  Tune `lib/llm/prompts/us/onboarding_system.ts` until all three pass.
- **Competitive calibration (blocks M2 close).** Document, from the founder's
  Railbird AI / Probatrix usage: what they capture via structured inputs that
  our conversation must also capture; what our conversation captures that they
  structurally cannot; and one user-facing artifact (e.g. a profile-summary
  screenshot) that demonstrates the difference.

## M1 — Auth + deterministic onboarding

**State:** Code-complete and locally verified (build, typecheck, tests). The
database migration and live auth verification are pending founder action —
this sandbox's network policy blocks Supabase (`Host not in allowlist`), so
migrations can't be applied and auth can't be exercised from here.

_Last updated: 2026-05-17 · branch `claude/setup-nextjs-supabase-vDrl1`_

### Shipped

- **Supabase Auth (email + password)** wired with `@supabase/ssr`: browser
  client (`lib/supabase/client.ts`), server client (`lib/supabase/server.ts`),
  and `middleware.ts` that refreshes the session and gates routes
  (unauthenticated users can't reach `/onboarding` or `/dashboard`; signed-in
  users are bounced off `/login` and `/signup`).
- **Pages:** `/login`, `/signup`, `/onboarding`, `/dashboard`, plus an
  `/auth/confirm` route handler for email-confirmation links. The landing `/`
  now carries the lightweight email-capture form.
- **Schema (`db/schema.ts`) + migrations:**
  - `users` — extends `auth.users` (timezone, digest_delivery_hour default 7,
    regions default `{us}`).
  - `user_preferences` — the deterministic onboarding answers, one row per user.
  - `email_signups` — landing-page email capture (no account).
  - Migration `0000_init_m1.sql` (tables + RLS) and `0001_auth_user_trigger.sql`
    (the `handle_new_user` trigger that creates the `public.users` row on
    signup) are generated and checked in.
- **RLS:** enabled on all three tables. `users` / `user_preferences` have
  owner-only `select`/`insert`/`update` policies keyed on `auth.uid()`;
  `email_signups` has RLS on with no policies (REST API fully denied).
- **Deterministic onboarding form** — tracks, race classes, distance ranges,
  surfaces, field size band, bet types, bankroll tier, days per week, timezone.
  Submits to a server action that validates with Zod (`lib/onboarding/options.ts`)
  and persists `user_preferences` (+ the user's timezone).
- Tests: `onboardingSchema` validation unit tests; M0 racing tests still pass.

### Verified (in sandbox)

- `npm run typecheck` — clean.
- `npm run build` — succeeds; 7 routes + middleware compile.
- `npm test` — 12 unit tests pass; 2 live integration tests skip cleanly.

### Decisions

- **Email capture included** (founder choice): the landing `/` has an
  email-only capture form writing to `email_signups`. Captured addresses sit
  unused until the digest pipeline (M4).
- **Signup trigger** (founder choice): a Postgres trigger on `auth.users`
  creates the `public.users` row. The onboarding action also upserts that row
  defensively.
- **RLS vs. Drizzle access:** server actions read/write via Drizzle over
  `DATABASE_URL`, which connects as the table-owner role and bypasses RLS —
  every query is explicitly scoped by the authenticated user's id. RLS is
  defense-in-depth for the auto-exposed Supabase REST API (anon / authenticated
  keys), which is what the policies protect.

### Deferred (need founder action — Supabase unreachable from sandbox)

- **Apply migrations.** Run `npm run db:migrate` against the hosted DB (or
  paste `db/migrations/0000_init_m1.sql` then `0001_auth_user_trigger.sql` into
  the Supabase SQL Editor in order). Nothing works until the tables exist.
- **Supabase Auth config.** In the Supabase dashboard set the Site URL and
  redirect URLs to the Vercel preview domain. Decide whether to keep email
  confirmation on: if on, the `/auth/confirm` flow handles the link (the email
  template must use `token_hash`); if off, signup logs the user straight in.
- **Manual verification on the preview:** signup → onboarding → save → dashboard,
  login, logout, email capture, and that a second account cannot read the first
  account's rows.

## M0 — Skeleton

**State:** Complete. Deployed to a Vercel preview against a hosted Supabase
project. Awaiting founder review before M1.

_Last updated: 2026-05-17 · branch `claude/setup-nextjs-supabase-vDrl1`_

### Shipped

- Next.js 15 App Router project, TypeScript strict mode, Tailwind CSS v4.
- Placeholder landing page at `/` — renders `Furlong — coming soon.`
- Drizzle ORM wired to Supabase Postgres via `DATABASE_URL`
  (`drizzle.config.ts`, lazy client in `db/index.ts`). `db/schema.ts` is
  intentionally empty — table definitions begin in M1. `db/migrations/` is
  created with a placeholder; the first migration is generated in M1.
- `.env.example` with placeholders for `DATABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, the Racing API credentials, `ANTHROPIC_API_KEY`,
  `RESEND_API_KEY`, and `STRIPE_SECRET_KEY` (with a `TODO(M5)` note).
- Typed Racing API client (`lib/racing/client.ts`) — `fetchTodayUSRacecards()`
  hits the theracingapi.com North America add-on (`/v1/north-america/meets` +
  `/meets/{id}/entries`), validates with Zod, and returns normalized,
  region-agnostic `Racecard` values. The raw US wire format is translated at
  the client boundary and never leaks into domain types.
- `RegionStrategy` interface (`lib/racing/regions.ts`) covering `dataFetch`,
  `raceNormalization`, `vocabulary`, `defaultDigestDeliveryHour`, and
  `suggestedBetTypes`. `UsRegionStrategy` is implemented; `UkRegionStrategy` is
  a typed stub that throws `"UK racing not yet supported"` on every member.
- Tests: deterministic unit tests for normalization, region strategies, the UK
  stub, and the client's auth/error handling; plus a live integration test
  that fetches today's US cards (and Gulfstream Park specifically) and skips
  gracefully when no Racing API credentials are present.
- `README.md` with local dev, Supabase local startup, env list, and commands.

### Verified

- `npm run build` — Next.js production build succeeds.
- `npm run typecheck` — clean (`tsc --noEmit`, strict).
- `npm test` — 6 unit tests pass; 2 live integration tests skip cleanly
  without credentials.
- **Vercel preview deploy** — `randolrs/projectcentaur` imported into Vercel;
  the placeholder page renders on the preview URL (`*-randolrs-projects.vercel.app`).
- **Hosted Supabase** — project `yzngwuywrjbxoyysgngi` created; the Vercel
  project's `DATABASE_URL` points at the pooled hosted connection
  (`...pooler.supabase.com:6543`), and the Supabase API/keys env vars are set.
  No runtime DB call exists in M0; the first live query lands in M1.

### Decisions / deviations from the task brief

- **Racing API auth:** the task's `.env.example` listed a single
  `RACING_API_KEY`. theracingapi.com actually authenticates with an HTTP Basic
  **username + password** pair, so (per founder confirmation) the env uses
  `RACING_API_USERNAME` + `RACING_API_PASSWORD` and the client sends Basic auth.
- **Raw NA response shape:** the theracingapi.com NA endpoint schema could not
  be fetched (docs are gated). The Zod schemas in `lib/racing/types.ts` are
  deliberately tolerant (all fields optional) and the original race JSON is
  retained on `Racecard.raw` for the M3 `races.raw_data` column. Endpoint paths
  and field mappings should be confirmed on the first live run.
- No `SPEC.md` / `CLAUDE.md` files existed in the repo; the product spec was
  provided in the task conversation and used as the source of truth.

### Deferred (not blocking M0)

- **Local Supabase CLI.** `npx supabase init && npx supabase start` was not run
  here (Docker unavailable in the sandbox); steps are documented in `README.md`.
  Not required for M0 — the Vercel preview uses the hosted project.
- **Live Racing API verification.** Attempted in the sandbox with founder-
  supplied credentials, but the remote environment's network policy blocks
  outbound requests to `api.theracingapi.com` (proxy returns `403 Host not in
  allowlist`). To verify: either add `api.theracingapi.com` to the environment's
  network allowlist, or run `npm test` locally with `RACING_API_USERNAME` /
  `RACING_API_PASSWORD` set. This exercises the integration test against the
  real API and confirms the NA endpoint paths + field mappings.

### v1 track data today (2026-05-17)

Pending — the live Racing API run is blocked by the sandbox network policy
(see _Deferred_ above). The integration test enumerates today's US cards; once
it is run (locally or after allowlisting the host), record here which of the 12
v1 track names
(Saratoga, Belmont Park, Aqueduct, Churchill Downs, Keeneland, Del Mar,
Santa Anita Park, Gulfstream Park, Oaklawn Park, Fair Grounds, Tampa Bay Downs,
Kentucky Downs) returned non-empty cards. Coverage is season-dependent — most
tracks do not run every day.

### Next

M1 — Auth + deterministic onboarding. M0 is deployed and verified; start M1
once the founder has reviewed.
