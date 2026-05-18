import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase';
import type { RenderedDigest } from '@/lib/digest/schema';
import type { Runner } from '@/lib/racing/types';

// Shape of one stored conversation turn (see lib/onboarding/schema.ts).
type StoredTurn = { role: 'assistant' | 'user'; content: string; timestamp: string };

// ---------------------------------------------------------------------------
// users — extends Supabase `auth.users` with product profile fields.
// The row is created automatically by the `handle_new_user` trigger
// (see migration 0001_auth_user_trigger.sql) on signup.
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    timezone: text('timezone'),
    digestDeliveryHour: integer('digest_delivery_hour').notNull().default(7),
    regions: text('regions')
      .array()
      .notNull()
      .default(sql`'{us}'::text[]`),
    // Onboarding progress: 'incomplete' | 'structured_complete' | 'conversation_complete'.
    onboardingStatus: text('onboarding_status')
      .notNull()
      .default('structured_complete'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    pgPolicy('users_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.id}`,
    }),
    pgPolicy('users_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.id}`,
      withCheck: sql`(select auth.uid()) = ${table.id}`,
    }),
  ],
);

// ---------------------------------------------------------------------------
// user_preferences — deterministic onboarding answers, one row per user.
// ---------------------------------------------------------------------------

export const userPreferences = pgTable(
  'user_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    tracks: text('tracks').array().notNull(),
    raceClasses: text('race_classes').array().notNull(),
    distanceRanges: text('distance_ranges').array().notNull(),
    surfaces: text('surfaces').array().notNull(),
    fieldSizeBand: text('field_size_band').notNull(),
    betTypes: text('bet_types').array().notNull(),
    bankrollTier: text('bankroll_tier').notNull(),
    daysPerWeek: integer('days_per_week').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('user_preferences_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('user_preferences_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('user_preferences_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ],
);

// ---------------------------------------------------------------------------
// email_signups — lightweight landing-page capture (no account).
// RLS is enabled with no policies: the auto-exposed REST API is fully
// denied; writes happen only via trusted server actions (Drizzle owner role).
// ---------------------------------------------------------------------------

export const emailSignups = pgTable('email_signups', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  source: text('source'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

// ---------------------------------------------------------------------------
// handicapper_profile — the structured output of the M2 LLM-driven
// conversational onboarding. One row per user.
// ---------------------------------------------------------------------------

export const handicapperProfile = pgTable(
  'handicapper_profile',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    styleSummary: text('style_summary').notNull(),
    lovedSetups: jsonb('loved_setups').notNull().$type<string[]>(),
    avoidedSetups: jsonb('avoided_setups').notNull().$type<string[]>(),
    valueThreshold: text('value_threshold').notNull(),
    preferredValueRange: text('preferred_value_range'),
    experienceLevel: text('experience_level').notNull(),
    primaryBetOrientation: text('primary_bet_orientation').notNull(),
    notableTracksMentioned: jsonb('notable_tracks_mentioned')
      .notNull()
      .$type<string[]>(),
    notableTrainersMentioned: jsonb('notable_trainers_mentioned')
      .notNull()
      .$type<string[]>(),
    notableAnglesMentioned: jsonb('notable_angles_mentioned')
      .notNull()
      .$type<string[]>(),
    // Full transcript, preserved for debugging and future model retraining.
    rawConversationLog: jsonb('raw_conversation_log')
      .notNull()
      .$type<StoredTurn[]>(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy('handicapper_profile_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('handicapper_profile_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
    pgPolicy('handicapper_profile_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
      withCheck: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ],
);

// ---------------------------------------------------------------------------
// onboarding_conversations — transient state for an in-progress M2
// conversation. One row per user; deleted once the profile is finalized.
// RLS is enabled with no policies: the auto-exposed REST API is fully
// denied; access happens only via trusted server actions (Drizzle owner role).
// ---------------------------------------------------------------------------

export const onboardingConversations = pgTable('onboarding_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  turns: jsonb('turns').notNull().$type<StoredTurn[]>(),
  costUsd: doublePrecision('cost_usd').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}).enableRLS();

// ---------------------------------------------------------------------------
// Racing reference data — a normalized hierarchy ingested from the Racing API:
//
//   tracks -> meets -> races -> race_entries
//
// with horses / jockeys / trainers as dimension entities the entries point
// at. Records are upserted on first encounter and deduped on a stable key:
// provider ids where the feed supplies them, synthesized natural keys where
// it does not (horses have no provider id; owners are absent entirely). All
// of it is shared reference data — RLS allows any authenticated user to read;
// ingestion writes only via the trusted server path (Drizzle owner role).
// ---------------------------------------------------------------------------

const referenceSelectAll = (name: string) =>
  pgPolicy(name, { for: 'select', to: authenticatedRole, using: sql`true` });

export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Provider track id (e.g. "GP"); informational — the feed omits it often.
    providerTrackId: text('provider_track_id'),
    // First-seen provider display name.
    name: text('name').notNull(),
    // Canonical name (onboarding vocabulary); the natural key tracks dedupe on.
    nameCanonical: text('name_canonical').notNull().unique(),
    region: text('region').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [referenceSelectAll('tracks_select_all')],
);

export const meets = pgTable(
  'meets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Provider meet id — always present; the meet's natural key.
    providerMeetId: text('provider_meet_id').notNull().unique(),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    raceDate: date('race_date', { mode: 'string' }).notNull(),
    region: text('region').notNull(),
    country: text('country'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('meets_date_idx').on(table.raceDate),
    referenceSelectAll('meets_select_all'),
  ],
);

export const horses = pgTable(
  'horses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    sireName: text('sire_name'),
    damName: text('dam_name'),
    // The feed gives horses no id; the natural key is the normalized
    // name + sire + dam (see lib/racing/canonical.ts `horseNaturalKey`).
    naturalKey: text('natural_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [referenceSelectAll('horses_select_all')],
);

export const jockeys = pgTable(
  'jockeys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Provider person id (e.g. "jky_na_441324") when supplied.
    providerId: text('provider_id'),
    name: text('name').notNull(),
    // Provider id, or "name:<normalized>" when the feed omits the id.
    naturalKey: text('natural_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [referenceSelectAll('jockeys_select_all')],
);

export const trainers = pgTable(
  'trainers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Provider person id (e.g. "trn_na_8563491") when supplied.
    providerId: text('provider_id'),
    name: text('name').notNull(),
    // Provider id, or "name:<normalized>" when the feed omits the id.
    naturalKey: text('natural_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [referenceSelectAll('trainers_select_all')],
);

// ---------------------------------------------------------------------------
// races — one row per race, belonging to a meet.
//
// Carries the raw provider payload (`raw_data`) and structured, queryable
// columns (canonical surface / class, distance in furlongs); `race_date` and
// `track_canonical` are denormalized from the meet/track so the digest can
// filter in a single-table query. Runner detail lives in `race_entries`.
// ---------------------------------------------------------------------------

export const races = pgTable(
  'races',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Idempotency key `region|date|track|raceNumber|dayEvening`: re-ingesting
    // a racing day updates the existing row instead of inserting a duplicate.
    key: text('key').notNull().unique(),
    meetId: uuid('meet_id')
      .notNull()
      .references(() => meets.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('theracingapi'),
    region: text('region').notNull(),
    raceDate: date('race_date', { mode: 'string' }).notNull(),
    track: text('track').notNull(),
    // Provider track name collapsed onto the onboarding vocabulary; the
    // digest matches a user's followed tracks against this column.
    trackCanonical: text('track_canonical').notNull(),
    raceNumber: integer('race_number'),
    // Provider day/evening card marker (e.g. "D" / "E").
    dayEvening: text('day_evening'),
    postTime: text('post_time'),
    postTimestamp: bigint('post_timestamp', { mode: 'number' }),
    surface: text('surface'),
    surfaceCanonical: text('surface_canonical').notNull(),
    distance: text('distance'),
    distanceFurlongs: doublePrecision('distance_furlongs'),
    raceClass: text('race_class'),
    raceClassCanonical: text('race_class_canonical').notNull(),
    conditions: text('conditions'),
    purse: integer('purse'),
    fieldSize: integer('field_size').notNull().default(0),
    runners: jsonb('runners').notNull().$type<Runner[]>(),
    rawData: jsonb('raw_data').notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('races_date_track_canonical_idx').on(
      table.raceDate,
      table.trackCanonical,
    ),
    referenceSelectAll('races_select_all'),
  ],
);

// ---------------------------------------------------------------------------
// race_entries — one row per horse entered in a race; the join between a
// race and the horse / jockey / trainer dimensions.
// ---------------------------------------------------------------------------

export const raceEntries = pgTable(
  'race_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Idempotency key `raceKey|programNumber`.
    key: text('key').notNull().unique(),
    raceId: uuid('race_id')
      .notNull()
      .references(() => races.id, { onDelete: 'cascade' }),
    horseId: uuid('horse_id')
      .notNull()
      .references(() => horses.id, { onDelete: 'cascade' }),
    jockeyId: uuid('jockey_id').references(() => jockeys.id, {
      onDelete: 'set null',
    }),
    trainerId: uuid('trainer_id').references(() => trainers.id, {
      onDelete: 'set null',
    }),
    programNumber: text('program_number'),
    postPosition: text('post_position'),
    morningLineOdds: text('morning_line_odds'),
    weight: text('weight'),
    medication: text('medication'),
    equipment: text('equipment'),
    scratched: boolean('scratched').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('race_entries_race_idx').on(table.raceId),
    index('race_entries_horse_idx').on(table.horseId),
    referenceSelectAll('race_entries_select_all'),
  ],
);

// ---------------------------------------------------------------------------
// digests — one row per (user, racing day) recording the personalized
// morning digest: the rendered content, delivery status, and LLM cost.
//
// The unique (user_id, race_date) constraint makes the digest pipeline
// idempotent — a day that already has a row is never processed twice.
// Per-user data: RLS allows the owner to read their own digests; the
// pipeline writes only via the trusted server path (Drizzle owner role).
// ---------------------------------------------------------------------------

export const digests = pgTable(
  'digests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    raceDate: date('race_date', { mode: 'string' }).notNull(),
    // 'sent' | 'skipped_no_races' | 'failed'.
    status: text('status').notNull(),
    raceCount: integer('race_count').notNull().default(0),
    subject: text('subject'),
    content: jsonb('content').$type<RenderedDigest>(),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    // Resend message id once the email is accepted for delivery.
    resendId: text('resend_id'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique('digests_user_date_key').on(table.userId, table.raceDate),
    pgPolicy('digests_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(select auth.uid()) = ${table.userId}`,
    }),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type UserPreferencesRow = typeof userPreferences.$inferSelect;
export type EmailSignupRow = typeof emailSignups.$inferSelect;
export type HandicapperProfileRow = typeof handicapperProfile.$inferSelect;
export type OnboardingConversationRow =
  typeof onboardingConversations.$inferSelect;
export type TrackRow = typeof tracks.$inferSelect;
export type NewTrackRow = typeof tracks.$inferInsert;
export type MeetRow = typeof meets.$inferSelect;
export type NewMeetRow = typeof meets.$inferInsert;
export type HorseRow = typeof horses.$inferSelect;
export type NewHorseRow = typeof horses.$inferInsert;
export type JockeyRow = typeof jockeys.$inferSelect;
export type NewJockeyRow = typeof jockeys.$inferInsert;
export type TrainerRow = typeof trainers.$inferSelect;
export type NewTrainerRow = typeof trainers.$inferInsert;
export type RaceEntryRow = typeof raceEntries.$inferSelect;
export type NewRaceEntryRow = typeof raceEntries.$inferInsert;
export type RaceRow = typeof races.$inferSelect;
export type NewRaceRow = typeof races.$inferInsert;
export type DigestRow = typeof digests.$inferSelect;
export type NewDigestRow = typeof digests.$inferInsert;
