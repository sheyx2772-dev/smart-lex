ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oneid_pin" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oneid_sub" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_oneid_uq" ON "users" USING btree ("tenant_id","oneid_pin");
