import { sql } from 'drizzle-orm';
import {
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase';

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

export type UserRow = typeof users.$inferSelect;
export type UserPreferencesRow = typeof userPreferences.$inferSelect;
export type EmailSignupRow = typeof emailSignups.$inferSelect;
