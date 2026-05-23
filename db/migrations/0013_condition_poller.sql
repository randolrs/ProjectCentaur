CREATE TABLE "condition_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meet_id" uuid NOT NULL,
	"track_canonical" text NOT NULL,
	"race_date" date NOT NULL,
	"surface_kind" text NOT NULL,
	"condition" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "condition_alerts_meet_surface_condition" UNIQUE("meet_id","surface_kind","condition")
);
--> statement-breakpoint
ALTER TABLE "condition_alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "surface_condition" text;--> statement-breakpoint
ALTER TABLE "condition_alerts" ADD CONSTRAINT "condition_alerts_meet_id_meets_id_fk" FOREIGN KEY ("meet_id") REFERENCES "public"."meets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "condition_alerts_pending_idx" ON "condition_alerts" USING btree ("notified_at");--> statement-breakpoint
CREATE POLICY "condition_alerts_select_all" ON "condition_alerts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);