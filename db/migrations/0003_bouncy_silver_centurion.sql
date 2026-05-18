CREATE TABLE "races" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"source" text DEFAULT 'theracingapi' NOT NULL,
	"region" text NOT NULL,
	"race_date" date NOT NULL,
	"track" text NOT NULL,
	"race_number" integer,
	"post_time" text,
	"post_timestamp" bigint,
	"surface" text,
	"surface_canonical" text NOT NULL,
	"distance" text,
	"distance_furlongs" double precision,
	"race_class" text,
	"race_class_canonical" text NOT NULL,
	"conditions" text,
	"purse" integer,
	"field_size" integer DEFAULT 0 NOT NULL,
	"runners" jsonb NOT NULL,
	"raw_data" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "races_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "races" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "races_date_track_idx" ON "races" USING btree ("race_date","track");--> statement-breakpoint
CREATE POLICY "races_select_all" ON "races" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);