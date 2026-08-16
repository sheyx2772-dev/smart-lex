CREATE TABLE "legal_agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"legal_matter_id" uuid,
	"contractor_id" uuid,
	"document_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_agent_tasks" ADD CONSTRAINT "legal_agent_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_agent_tasks" ADD CONSTRAINT "legal_agent_tasks_legal_matter_id_legal_matters_id_fk" FOREIGN KEY ("legal_matter_id") REFERENCES "public"."legal_matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_agent_tasks" ADD CONSTRAINT "legal_agent_tasks_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_agent_tasks" ADD CONSTRAINT "legal_agent_tasks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_agent_tasks_source_uq" ON "legal_agent_tasks" USING btree ("tenant_id","source","source_key");--> statement-breakpoint
CREATE INDEX "legal_agent_tasks_tenant_status_idx" ON "legal_agent_tasks" USING btree ("tenant_id","status");