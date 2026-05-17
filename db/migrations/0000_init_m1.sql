CREATE TABLE "email_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_signups_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "email_signups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tracks" text[] NOT NULL,
	"race_classes" text[] NOT NULL,
	"distance_ranges" text[] NOT NULL,
	"surfaces" text[] NOT NULL,
	"field_size_band" text NOT NULL,
	"bet_types" text[] NOT NULL,
	"bankroll_tier" text NOT NULL,
	"days_per_week" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"timezone" text,
	"digest_delivery_hour" integer DEFAULT 7 NOT NULL,
	"regions" text[] DEFAULT '{us}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "user_preferences_select_own" ON "user_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "user_preferences"."user_id");--> statement-breakpoint
CREATE POLICY "user_preferences_insert_own" ON "user_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "user_preferences"."user_id");--> statement-breakpoint
CREATE POLICY "user_preferences_update_own" ON "user_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "user_preferences"."user_id") WITH CHECK ((select auth.uid()) = "user_preferences"."user_id");--> statement-breakpoint
CREATE POLICY "users_select_own" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "users"."id");--> statement-breakpoint
CREATE POLICY "users_update_own" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "users"."id") WITH CHECK ((select auth.uid()) = "users"."id");