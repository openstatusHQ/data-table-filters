CREATE TYPE "public"."level" AS ENUM('success', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."method" AS ENUM('GET', 'POST', 'PUT', 'DELETE');--> statement-breakpoint
CREATE TABLE "logs" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" "level" NOT NULL,
	"method" "method" NOT NULL,
	"host" text NOT NULL,
	"pathname" text NOT NULL,
	"status" integer NOT NULL,
	"latency" integer NOT NULL,
	"regions" text[] NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"timing_dns" integer NOT NULL,
	"timing_connection" integer NOT NULL,
	"timing_tls" integer NOT NULL,
	"timing_ttfb" integer NOT NULL,
	"timing_transfer" integer NOT NULL,
	"headers" jsonb NOT NULL,
	"message" text
);
