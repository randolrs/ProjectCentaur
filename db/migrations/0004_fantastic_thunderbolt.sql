CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"race_date" date NOT NULL,
	"status" text NOT NULL,
	"race_count" integer DEFAULT 0 NOT NULL,
	"subject" text,
	"content" jsonb,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"resend_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digests_user_date_key" UNIQUE("user_id","race_date")
);
--> statement-breakpoint
ALTER TABLE "digests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "digests_select_own" ON "digests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "digests"."user_id");