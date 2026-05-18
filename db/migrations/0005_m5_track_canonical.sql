DROP INDEX "races_date_track_idx";--> statement-breakpoint
ALTER TABLE "races" ADD COLUMN "track_canonical" text;--> statement-breakpoint
UPDATE "races" SET "track_canonical" = CASE lower(btrim("track"))
	WHEN 'belmont at the big a' THEN 'Belmont Park'
	WHEN 'santa anita' THEN 'Santa Anita Park'
	WHEN 'gulfstream' THEN 'Gulfstream Park'
	WHEN 'gulfstream park west' THEN 'Gulfstream Park'
	WHEN 'oaklawn' THEN 'Oaklawn Park'
	WHEN 'saratoga race course' THEN 'Saratoga'
	WHEN 'aqueduct racetrack' THEN 'Aqueduct'
	WHEN 'del mar thoroughbred club' THEN 'Del Mar'
	WHEN 'fair grounds race course' THEN 'Fair Grounds'
	ELSE btrim("track")
END;--> statement-breakpoint
ALTER TABLE "races" ALTER COLUMN "track_canonical" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "races_date_track_canonical_idx" ON "races" USING btree ("race_date","track_canonical");
