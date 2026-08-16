CREATE TYPE "public"."legal_matter_status" AS ENUM('new', 'in_review', 'in_progress', 'waiting_for_approval', 'filed', 'in_court', 'decision', 'execution', 'closed');--> statement-breakpoint
ALTER TYPE "public"."approval_type" ADD VALUE 'matter_action';--> statement-breakpoint
CREATE TABLE "legal_matters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"matter_number" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"status" "legal_matter_status" DEFAULT 'new' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"risk_level" text,
	"contractor_id" uuid,
	"contract_id" uuid,
	"document_id" uuid,
	"assigned_user_id" uuid,
	"description" text,
	"due_date" timestamp with time zone,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_matters" ADD CONSTRAINT "legal_matters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD CONSTRAINT "legal_matters_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD CONSTRAINT "legal_matters_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD CONSTRAINT "legal_matters_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_matters" ADD CONSTRAINT "legal_matters_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_matters_tenant_number_uq" ON "legal_matters" USING btree ("tenant_id","matter_number");--> statement-breakpoint
CREATE INDEX "legal_matters_tenant_status_idx" ON "legal_matters" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "legal_matters_tenant_due_idx" ON "legal_matters" USING btree ("tenant_id","due_date");