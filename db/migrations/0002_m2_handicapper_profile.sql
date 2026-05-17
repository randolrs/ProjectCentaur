CREATE TABLE "handicapper_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"style_summary" text NOT NULL,
	"loved_setups" jsonb NOT NULL,
	"avoided_setups" jsonb NOT NULL,
	"value_threshold" text NOT NULL,
	"preferred_value_range" text,
	"experience_level" text NOT NULL,
	"primary_bet_orientation" text NOT NULL,
	"notable_tracks_mentioned" jsonb NOT NULL,
	"notable_trainers_mentioned" jsonb NOT NULL,
	"notable_angles_mentioned" jsonb NOT NULL,
	"raw_conversation_log" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handicapper_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "handicapper_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "onboarding_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"turns" jsonb NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_conversations_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "onboarding_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_status" text DEFAULT 'structured_complete' NOT NULL;--> statement-breakpoint
ALTER TABLE "handicapper_profile" ADD CONSTRAINT "handicapper_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_conversations" ADD CONSTRAINT "onboarding_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "handicapper_profile_select_own" ON "handicapper_profile" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "handicapper_profile"."user_id");--> statement-breakpoint
CREATE POLICY "handicapper_profile_insert_own" ON "handicapper_profile" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "handicapper_profile"."user_id");--> statement-breakpoint
CREATE POLICY "handicapper_profile_update_own" ON "handicapper_profile" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "handicapper_profile"."user_id") WITH CHECK ((select auth.uid()) = "handicapper_profile"."user_id");