CREATE TYPE "public"."actor_type" AS ENUM('user', 'ai_agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('demand_letter', 'court_claim', 'write_off');--> statement-breakpoint
CREATE TYPE "public"."collection_stage" AS ENUM('soft_reminder', 'firm_reminder', 'demand_letter', 'court');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('UZS', 'USD', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('contract', 'supplementary_agreement', 'invoice', 'act', 'reconciliation_act', 'ttn', 'demand_letter', 'court_claim', 'other');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('uz', 'ru', 'en');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('expected', 'received', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."receivable_status" AS ENUM('pending', 'partial', 'paid', 'overdue', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."reminder_channel" AS ENUM('sms', 'email', 'telegram', 'hybrid_post');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tenant_type" AS ENUM('company', 'marketplace', 'bank', 'government');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'finance', 'legal', 'viewer');--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "approval_type" NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"receivable_id" uuid,
	"document_id" uuid,
	"payload" jsonb NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tin" text NOT NULL,
	"legal_address" text,
	"bank_account" text,
	"bank_mfo" text,
	"phone" text,
	"email" text,
	"telegram_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contractor_id" uuid NOT NULL,
	"number" text NOT NULL,
	"signed_at" timestamp with time zone,
	"currency" "currency" DEFAULT 'UZS' NOT NULL,
	"penalty_daily_bps" integer DEFAULT 0 NOT NULL,
	"penalty_cap_bps" integer,
	"jurisdiction_note" text,
	"didox_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"contract_id" uuid,
	"contractor_id" uuid,
	"title" text NOT NULL,
	"s3_key" text,
	"didox_id" text,
	"extracted" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contract_id" uuid,
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
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "currency" DEFAULT 'UZS' NOT NULL,
	"status" "payment_status" DEFAULT 'received' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"contractor_id" uuid NOT NULL,
	"status" "receivable_status" NOT NULL,
	"outstanding_minor" bigint NOT NULL,
	"penalty_minor" bigint DEFAULT 0 NOT NULL,
	"currency" "currency" DEFAULT 'UZS' NOT NULL,
	"overdue_days" integer DEFAULT 0 NOT NULL,
	"aging_bucket" text DEFAULT 'current' NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"executed_stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"receivable_id" uuid NOT NULL,
	"stage" "collection_stage" NOT NULL,
	"channel" "reminder_channel" NOT NULL,
	"status" "reminder_status" DEFAULT 'queued' NOT NULL,
	"address" text NOT NULL,
	"body" text NOT NULL,
	"payment_link" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "tenant_type" NOT NULL,
	"name" text NOT NULL,
	"tin" text NOT NULL,
	"default_locale" "locale" DEFAULT 'uz' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"locale" "locale" DEFAULT 'uz' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."receivables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_rules" ADD CONSTRAINT "collection_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."receivables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_tenant_status_idx" ON "approval_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "audit_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contractors_tenant_tin_uq" ON "contractors" USING btree ("tenant_id","tin");--> statement-breakpoint
CREATE INDEX "contractors_tenant_idx" ON "contractors" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_tenant_number_uq" ON "contracts" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "contracts_tenant_contractor_idx" ON "contracts" USING btree ("tenant_id","contractor_id");--> statement-breakpoint
CREATE INDEX "documents_tenant_type_idx" ON "documents" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_tenant_number_uq" ON "invoices" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "invoices_tenant_due_idx" ON "invoices" USING btree ("tenant_id","due_date");--> statement-breakpoint
CREATE INDEX "payments_tenant_invoice_idx" ON "payments" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receivables_invoice_uq" ON "receivables" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "receivables_tenant_status_idx" ON "receivables" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "reminders_tenant_receivable_idx" ON "reminders" USING btree ("tenant_id","receivable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email_uq" ON "users" USING btree ("tenant_id","email");