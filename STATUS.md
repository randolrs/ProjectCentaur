# Project Status

## M0 — Skeleton

**State:** Complete. Deployed to a Vercel preview against a hosted Supabase
project. Awaiting founder review before M1.

_Last updated: 2026-05-17 · branch `claude/setup-nextjs-supabase-vDrl1`_

### Shipped

- Next.js 15 App Router project, TypeScript strict mode, Tailwind CSS v4.
- Placeholder landing page at `/` — renders `[PRODUCT_NAME] — coming soon.`
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
