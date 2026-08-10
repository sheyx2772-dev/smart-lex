import { encryptSecret, isEncrypted } from "@lex/shared/secrets";
import { eq } from "drizzle-orm";
import { getDb, tenants, users, withTenant } from "./client";

/**
 * BIR MARTALIK skript: production'da hozirgi ochiq matnda saqlangan tenant sirlarini
 * (Click/Payme merchant kaliti, Didox token, bank/SMS/Telegram kaliti) shifrlaydi.
 * SECRETS_ENCRYPTION_KEY o'rnatilgandan KEYIN, bir marta qo'lda ishga tushiriladi:
 *   corepack pnpm --filter @lex/db exec tsx src/migrate-secrets.ts
 * Idempotent — allaqachon shifrlangan qiymatlarga tegmaydi (qayta ishga tushirish xavfsiz).
 */
const SECRET_MERCHANT_FIELDS = ["click.secretKey", "payme.secretKey"] as const;
const SECRET_INTEGRATION_FIELDS = ["didoxToken", "bankApiKey", "smsApiKey", "telegramBotToken"] as const;

async function main(): Promise<void> {
  const db = getDb();
  const rows = await db.select({ id: tenants.id, settings: tenants.settings }).from(tenants);

  let changed = 0;
  for (const row of rows) {
    const settings = { ...((row.settings ?? {}) as Record<string, unknown>) };
    let dirty = false;

    const merchant = { ...((settings.merchant ?? {}) as Record<string, Record<string, string> | undefined>) };
    for (const path of SECRET_MERCHANT_FIELDS) {
      const [provider, field] = path.split(".") as [string, string];
      const providerObj = merchant[provider];
      const value = providerObj?.[field];
      if (value && !isEncrypted(value)) {
        merchant[provider] = { ...providerObj, [field]: encryptSecret(value) };
        dirty = true;
      }
    }
    if (dirty) settings.merchant = merchant;

    const integrations = { ...((settings.integrations ?? {}) as Record<string, string>) };
    let intDirty = false;
    for (const field of SECRET_INTEGRATION_FIELDS) {
      const value = integrations[field];
      if (value && !isEncrypted(value)) {
        integrations[field] = encryptSecret(value);
        intDirty = true;
      }
    }
    if (intDirty) {
      settings.integrations = integrations;
      dirty = true;
    }

    if (dirty) {
      await db.update(tenants).set({ settings }).where(eq(tenants.id, row.id));
      changed++;
      console.log(`  tenant ${row.id}: sirlar shifrlandi`);
    }

    // cabinet.sud.uz sessiya tokeni — users jadvali RLS bilan himoyalangan, shuning
    // uchun withTenant() orqali (users tenant_scoped table ro'yxatida).
    const userRows = await withTenant(row.id, (tx) => tx.select({ id: users.id, courtAuthToken: users.courtAuthToken }).from(users));
    for (const u of userRows) {
      if (u.courtAuthToken && !isEncrypted(u.courtAuthToken)) {
        await withTenant(row.id, (tx) => tx.update(users).set({ courtAuthToken: encryptSecret(u.courtAuthToken) }).where(eq(users.id, u.id)));
        changed++;
        console.log(`  user ${u.id}: sud tokeni shifrlandi`);
      }
    }
  }

  console.log(`✓ Tayyor. ${changed} ta yozuv yangilandi (${rows.length} tenant tekshirildi).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ Xato:", err);
    process.exit(1);
  });
