CREATE TYPE "public"."case_state" AS ENUM('created', 'intake_complete', 'scoring', 'strategy_assigned', 'pre_legal', 'debtor_responded', 'negotiation', 'escalate', 'legal', 'court_filed', 'judgment', 'enforcement', 'settled', 'recovered', 'closed', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."strategy_type" AS ENUM('soft_escalation', 'standard', 'aggressive', 'legal');--> statement-breakpoint
CREATE TYPE "public"."override_type" AS ENUM('settlement', 'court_filing', 'write_off', 'strategy_change');--> statement-breakpoint
CREATE TYPE "public"."override_status" AS ENUM('pending', 'approved', 'rejected', 'auto_executed', 'expired');--> statement-breakpoint
CREATE TABLE "debt_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"receivable_id" uuid NOT NULL,
	"case_number" text NOT NULL,
	"state" "case_state" DEFAULT 'created' NOT NULL,
	"ds_score" integer DEFAULT 0 NOT NULL,
	"recovery_probability" integer DEFAULT 0 NOT NULL,
	"recommended_strategy" "strategy_type" DEFAULT 'standard' NOT NULL,
	"recommended_channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"optimal_settlement_pct" integer DEFAULT 85 NOT NULL,
	"estimated_recovery_days" integer DEFAULT 30 NOT NULL,
	"priority_rank" integer DEFAULT 999 NOT NULL,
	"current_phase" integer DEFAULT 1 NOT NULL,
	"score_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "recovery_playbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"debt_case_id" uuid NOT NULL,
	"strategy_type" "strategy_type" NOT NULL,
	"phases" jsonb NOT NULL,
	"exit_conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_phase" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"debt_case_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" "actor_type" DEFAULT 'ai_agent' NOT NULL,
	"actor_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "pending_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"debt_case_id" uuid NOT NULL,
	"type" "override_type" NOT NULL,
	"status" "override_status" DEFAULT 'pending' NOT NULL,
	"ai_recommendation" jsonb NOT NULL,
	"debtor_message" text,
	"auto_execute_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "debt_cases" ADD CONSTRAINT "debt_cases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_cases" ADD CONSTRAINT "debt_cases_receivable_id_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."receivables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_playbooks" ADD CONSTRAINT "recovery_playbooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_playbooks" ADD CONSTRAINT "recovery_playbooks_debt_case_id_debt_cases_id_fk" FOREIGN KEY ("debt_case_id") REFERENCES "public"."debt_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_debt_case_id_debt_cases_id_fk" FOREIGN KEY ("debt_case_id") REFERENCES "public"."debt_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_overrides" ADD CONSTRAINT "pending_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_overrides" ADD CONSTRAINT "pending_overrides_debt_case_id_debt_cases_id_fk" FOREIGN KEY ("debt_case_id") REFERENCES "public"."debt_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_overrides" ADD CONSTRAINT "pending_overrides_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "debt_cases_receivable_uq" ON "debt_cases" USING btree ("receivable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "debt_cases_tenant_number_uq" ON "debt_cases" USING btree ("tenant_id","case_number");--> statement-breakpoint
CREATE INDEX "debt_cases_tenant_state_idx" ON "debt_cases" USING btree ("tenant_id","state");--> statement-breakpoint
CREATE INDEX "debt_cases_tenant_priority_idx" ON "debt_cases" USING btree ("tenant_id","priority_rank");--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_playbooks_case_uq" ON "recovery_playbooks" USING btree ("debt_case_id");--> statement-breakpoint
CREATE INDEX "case_events_case_created_idx" ON "case_events" USING btree ("debt_case_id","created_at");--> statement-breakpoint
CREATE INDEX "pending_overrides_tenant_status_idx" ON "pending_overrides" USING btree ("tenant_id","status");
