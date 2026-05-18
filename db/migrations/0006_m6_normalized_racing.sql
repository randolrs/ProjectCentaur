CREATE TABLE "horses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sire_name" text,
	"dam_name" text,
	"natural_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "horses_natural_key_unique" UNIQUE("natural_key")
);
--> statement-breakpoint
ALTER TABLE "horses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jockeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text,
	"name" text NOT NULL,
	"natural_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jockeys_natural_key_unique" UNIQUE("natural_key")
);
--> statement-breakpoint
ALTER TABLE "jockeys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_meet_id" text NOT NULL,
	"track_id" uuid NOT NULL,
	"race_date" date NOT NULL,
	"region" text NOT NULL,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meets_provider_meet_id_unique" UNIQUE("provider_meet_id")
);
--> statement-breakpoint
ALTER TABLE "meets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "race_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"race_id" uuid NOT NULL,
	"horse_id" uuid NOT NULL,
	"jockey_id" uuid,
	"trainer_id" uuid,
	"program_number" text,
	"post_position" text,
	"morning_line_odds" text,
	"weight" text,
	"medication" text,
	"equipment" text,
	"scratched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "race_entries_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "race_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_track_id" text,
	"name" text NOT NULL,
	"name_canonical" text NOT NULL,
	"region" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracks_name_canonical_unique" UNIQUE("name_canonical")
);
--> statement-breakpoint
ALTER TABLE "tracks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trainers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text,
	"name" text NOT NULL,
	"natural_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trainers_natural_key_unique" UNIQUE("natural_key")
);
--> statement-breakpoint
ALTER TABLE "trainers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DELETE FROM "races";--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "meet_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "day_evening" text;--> statement-breakpoint
ALTER TABLE "meets" ADD CONSTRAINT "meets_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_entries" ADD CONSTRAINT "race_entries_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_entries" ADD CONSTRAINT "race_entries_horse_id_horses_id_fk" FOREIGN KEY ("horse_id") REFERENCES "public"."horses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_entries" ADD CONSTRAINT "race_entries_jockey_id_jockeys_id_fk" FOREIGN KEY ("jockey_id") REFERENCES "public"."jockeys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_entries" ADD CONSTRAINT "race_entries_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meets_date_idx" ON "meets" USING btree ("race_date");--> statement-breakpoint
CREATE INDEX "race_entries_race_idx" ON "race_entries" USING btree ("race_id");--> statement-breakpoint
CREATE INDEX "race_entries_horse_idx" ON "race_entries" USING btree ("horse_id");--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_meet_id_meets_id_fk" FOREIGN KEY ("meet_id") REFERENCES "public"."meets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "horses_select_all" ON "horses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "jockeys_select_all" ON "jockeys" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "meets_select_all" ON "meets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "race_entries_select_all" ON "race_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "tracks_select_all" ON "tracks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "trainers_select_all" ON "trainers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);