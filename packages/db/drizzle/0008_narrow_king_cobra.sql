CREATE TYPE "public"."financing_listing_status" AS ENUM('listed', 'withdrawn', 'matched', 'completed');--> statement-breakpoint
CREATE TABLE "financing_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"receivable_id" uuid NOT NULL,
	"status" "financing_listing_status" DEFAULT 'listed' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "currency" NOT NULL,
	"risk_score_at_listing" integer NOT NULL,
	"suggested_discount_bps" integer NOT NULL,
	"requested_discount_bps" integer,
	"matched_partner_name" text,
	"matched_discount_bps" integer,
	"notes" text,
	"matched_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financing_listings" ADD CONSTRAINT "financing_listings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_listings" ADD CONSTRAINT "financing_listings_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."receivables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financing_tenant_status_idx" ON "financing_listings" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "financing_tenant_receivable_idx" ON "financing_listings" USING btree ("tenant_id","receivable_id");