import { users, withTenant } from "@lex/db";
import { eq } from "drizzle-orm";

/** cabinet.sud.uz X-AUTH-TOKEN'ni foydalanuvchiga saqlaydi (POST /court/token va WS oqimi ikkalasi ham shu funksiyani ishlatadi). */
export async function saveCourtToken(tenantId: string, userId: string, token: string): Promise<void> {
  await withTenant(tenantId, (tx) =>
    tx.update(users).set({ courtAuthToken: token, courtAuthTokenAt: new Date() }).where(eq(users.id, userId)),
  );
}
