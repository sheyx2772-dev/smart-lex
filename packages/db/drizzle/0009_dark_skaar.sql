CREATE TABLE "payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contractor_id" uuid NOT NULL,
	"number" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "currency" DEFAULT 'UZS' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"didox_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payables_tenant_number_uq" ON "payables" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "payables_tenant_due_idx" ON "payables" USING btree ("tenant_id","due_date");