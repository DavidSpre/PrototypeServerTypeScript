CREATE SCHEMA "buch";
--> statement-breakpoint
CREATE TYPE "buch"."buchart" AS ENUM('EPUB', 'HARDCOVER', 'PAPERBACK');--> statement-breakpoint
CREATE TABLE "buch"."abbildung" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "buch"."abbildung_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1),
	"beschriftung" text NOT NULL,
	"content_type" text NOT NULL,
	"buch_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buch"."buch" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "buch"."buch_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1),
	"version" integer DEFAULT 0 NOT NULL,
	"isbn" text NOT NULL CONSTRAINT "buch_isbn_key" UNIQUE,
	"rating" integer NOT NULL,
	"art" "buch"."buchart",
	"preis" numeric(8,2) NOT NULL,
	"rabatt" numeric(4,3) NOT NULL,
	"lieferbar" boolean DEFAULT false NOT NULL,
	"datum" date,
	"homepage" text,
	"schlagwoerter" jsonb,
	"erzeugt" timestamp DEFAULT now() NOT NULL,
	"aktualisiert" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buch_rating_check" CHECK (((rating >= 0) AND (rating <= 5)))
);
--> statement-breakpoint
CREATE TABLE "buch"."buch_file" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "buch"."buch_file_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1),
	"data" bytea NOT NULL,
	"filename" text NOT NULL,
	"mimetype" text,
	"buch_id" integer NOT NULL CONSTRAINT "buch_file_buch_id_key" UNIQUE
);
--> statement-breakpoint
CREATE TABLE "buch"."titel" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "buch"."titel_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1),
	"titel" text NOT NULL,
	"untertitel" text,
	"buch_id" integer NOT NULL CONSTRAINT "titel_buch_id_key" UNIQUE
);
--> statement-breakpoint
CREATE INDEX "abbildung_buch_id_idx" ON "buch"."abbildung" ("buch_id");--> statement-breakpoint
CREATE INDEX "buch_file_buch_id_idx" ON "buch"."buch_file" ("buch_id");--> statement-breakpoint
ALTER TABLE "buch"."titel" ADD CONSTRAINT "titel_buch_id_fkey" FOREIGN KEY ("buch_id") REFERENCES "buch"."buch"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "buch"."abbildung" ADD CONSTRAINT "abbildung_buch_id_fkey" FOREIGN KEY ("buch_id") REFERENCES "buch"."buch"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "buch"."buch_file" ADD CONSTRAINT "buch_file_buch_id_fkey" FOREIGN KEY ("buch_id") REFERENCES "buch"."buch"("id") ON DELETE CASCADE;