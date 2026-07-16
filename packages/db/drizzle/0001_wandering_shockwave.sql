ALTER TABLE "tenants" ADD COLUMN "legal_address" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "bank_mfo" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;