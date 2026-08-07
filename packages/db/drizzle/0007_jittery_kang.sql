CREATE TYPE "public"."promise_status" AS ENUM('pending', 'kept', 'broken');--> statement-breakpoint
CREATE TYPE "public"."promise_type" AS ENUM('settlement', 'installment');--> statement-breakpoint
CREATE TABLE "payment_promises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"receivable_id" uuid NOT NULL,
	"type" "promise_type" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" "promise_status" DEFAULT 'pending' NOT NULL,
	"offer_text" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."receivables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promises_tenant_receivable_idx" ON "payment_promises" USING btree ("tenant_id","receivable_id");--> statement-breakpoint
CREATE INDEX "promises_tenant_status_due_idx" ON "payment_promises" USING btree ("tenant_id","status","due_date");