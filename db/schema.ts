import { sql } from 'drizzle-orm';
import {
  bigint,
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
// races — racecards ingested from the Racing API, one row per race.
//
// Carries both the raw provider payload (`raw_data`) and structured,
// queryable columns (canonical surface / class, distance in furlongs) so the
// M4 digest pipeline can filter races against user preferences in SQL. Shared
// reference data: RLS allows any authenticated user to read; ingestion writes
// only via the trusted server path (Drizzle owner role).
// ---------------------------------------------------------------------------

export const races = pgTable(
  'races',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Idempotency key `region|date|track|raceNumber`: re-ingesting a racing
    // day updates the existing row instead of inserting a duplicate.
    key: text('key').notNull().unique(),
    source: text('source').notNull().default('theracingapi'),
    region: text('region').notNull(),
    raceDate: date('race_date', { mode: 'string' }).notNull(),
    track: text('track').notNull(),
    raceNumber: integer('race_number'),
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
    index('races_date_track_idx').on(table.raceDate, table.track),
    pgPolicy('races_select_all', {
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
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
export type RaceRow = typeof races.$inferSelect;
export type NewRaceRow = typeof races.$inferInsert;
export type DigestRow = typeof digests.$inferSelect;
export type NewDigestRow = typeof digests.$inferInsert;
