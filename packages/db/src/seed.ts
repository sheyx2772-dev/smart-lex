import { DEFAULT_COLLECTION_STEPS } from "@lex/core";
import { hashPassword } from "@lex/shared/auth";
import { closeDb, getDb, withTenant } from "./client";
import { collectionRules, contractors, contracts, documents, invoices, payments, tenants, users } from "./schema/index";

/**
 * Demo ma'lumot — 2 tenant (izolyatsiya testi uchun), turli debitorlik ssenariylari.
 * Idempotent: har ishga tushganda tozalab qayta yaratadi.
 * Sanalar `now`ga nisbatan (overdue/pending/paid holatlari deterministik chiqishi uchun).
 */
async function main(): Promise<void> {
  const db = getDb();
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const daysAhead = (n: number) => new Date(now.getTime() + n * 86_400_000);

  console.log("→ Eski ma'lumot tozalanmoqda...");
  await db.delete(tenants); // cascade barcha bog'liq jadvallarni tozalaydi

  // ── Tenant A: kompaniya ─────────────────────────────────
  const [tenantA] = await db
    .insert(tenants)
    .values({ type: "company", name: 'ALFA TRADE MCHJ', tin: "301234567" })
    .returning();
  // ── Tenant B: bank (izolyatsiya testi uchun) ────────────
  const [tenantB] = await db
    .insert(tenants)
    .values({ type: "bank", name: "BETA BANK ATB", tin: "207654321" })
    .returning();
  if (!tenantA || !tenantB) throw new Error("tenant yaratilmadi");

  const passwordHash = await hashPassword("Parol123!");

  await withTenant(tenantA.id, async (tx) => {
    await tx.insert(users).values({
      tenantId: tenantA.id,
      email: "rahbar@alfatrade.uz",
      passwordHash,
      fullName: "Alisher Karimov",
      role: "owner",
      locale: "uz",
    });

    await tx.insert(collectionRules).values({
      tenantId: tenantA.id,
      name: "Standart siyosat (5/15/30/60)",
      steps: DEFAULT_COLLECTION_STEPS,
      isDefault: true,
    });

    // Kontragentlar
    const contractorRows = await tx
      .insert(contractors)
      .values([
        {
          tenantId: tenantA.id,
          name: 'GLOBAL SNAB MCHJ',
          tin: "305111222",
          legalAddress: "Toshkent sh., Chilonzor t., 12-uy",
          phone: "+998901112233",
          email: "info@globalsnab.uz",
        },
        {
          tenantId: tenantA.id,
          name: 'MEGA BUILD MCHJ',
          tin: "306333444",
          legalAddress: "Samarqand sh., Registon ko'ch., 5-uy",
          phone: "+998907778899",
          email: "buy@megabuild.uz",
        },
        {
          tenantId: tenantA.id,
          name: 'ORIENT LOGISTIC MCHJ',
          tin: "307555666",
          legalAddress: "Buxoro sh., Mustaqillik ko'ch., 44-uy",
          phone: "+998905556677",
        },
      ])
      .returning();
    const [c1, c2, c3] = contractorRows;
    if (!c1 || !c2 || !c3) throw new Error("kontragent yaratilmadi");

    // Shartnomalar (0.05%/kun penya, cap 50%)
    const contractRows = await tx
      .insert(contracts)
      .values([
        { tenantId: tenantA.id, contractorId: c1.id, number: "SH-2026-001", signedAt: daysAgo(120), penaltyDailyBps: 5, penaltyCapBps: 5000 },
        { tenantId: tenantA.id, contractorId: c2.id, number: "SH-2026-002", signedAt: daysAgo(90), penaltyDailyBps: 5, penaltyCapBps: 5000 },
        { tenantId: tenantA.id, contractorId: c3.id, number: "SH-2026-003", signedAt: daysAgo(60), penaltyDailyBps: 3, penaltyCapBps: 3000 },
      ])
      .returning();
    const [k1, k2, k3] = contractRows;
    if (!k1 || !k2 || !k3) throw new Error("shartnoma yaratilmadi");

    // Invoicelar — turli holatlar
    const invoiceRows = await tx
      .insert(invoices)
      .values([
        // 45 kun muddati o'tgan, to'lanmagan => overdue (talabnoma bosqichi yaqin)
        { tenantId: tenantA.id, contractId: k1.id, contractorId: c1.id, number: "INV-1001", amountMinor: 5_000_000_00n, issuedAt: daysAgo(60), dueDate: daysAgo(45) },
        // 5 kun o'tgan, qisman to'langan => overdue
        { tenantId: tenantA.id, contractId: k2.id, contractorId: c2.id, number: "INV-1002", amountMinor: 12_000_000_00n, issuedAt: daysAgo(35), dueDate: daysAgo(5) },
        // muddati 10 kundan keyin => pending
        { tenantId: tenantA.id, contractId: k3.id, contractorId: c3.id, number: "INV-1003", amountMinor: 3_500_000_00n, issuedAt: daysAgo(5), dueDate: daysAhead(10) },
        // to'liq to'langan => paid
        { tenantId: tenantA.id, contractId: k1.id, contractorId: c1.id, number: "INV-1004", amountMinor: 2_000_000_00n, issuedAt: daysAgo(50), dueDate: daysAgo(20) },
      ])
      .returning();
    const [i1, i2, i3, i4] = invoiceRows;
    if (!i1 || !i2 || !i3 || !i4) throw new Error("invoice yaratilmadi");

    // To'lovlar
    await tx.insert(payments).values([
      { tenantId: tenantA.id, invoiceId: i2.id, amountMinor: 4_000_000_00n, status: "received", paidAt: daysAgo(8) }, // qisman
      { tenantId: tenantA.id, invoiceId: i4.id, amountMinor: 2_000_000_00n, status: "received", paidAt: daysAgo(18) }, // to'liq
    ]);

    // Hujjatlar ombori — Didox'dan olingan hujjatlar (mock; token kelganda real bilan almashadi).
    await tx.insert(documents).values([
      { tenantId: tenantA.id, type: "contract", contractId: k1.id, contractorId: c1.id, title: "Yetkazib berish shartnomasi SH-2026-001", didoxId: "DX-CTR-1001", createdAt: daysAgo(120), extracted: { signedAt: daysAgo(120).toISOString(), penaltyDailyBps: 5 } },
      { tenantId: tenantA.id, type: "contract", contractId: k2.id, contractorId: c2.id, title: "Yetkazib berish shartnomasi SH-2026-002", didoxId: "DX-CTR-1002", createdAt: daysAgo(90), extracted: { signedAt: daysAgo(90).toISOString(), penaltyDailyBps: 5 } },
      { tenantId: tenantA.id, type: "contract", contractId: k3.id, contractorId: c3.id, title: "Xizmat ko'rsatish shartnomasi SH-2026-003", didoxId: "DX-CTR-1003", createdAt: daysAgo(60) },
      { tenantId: tenantA.id, type: "invoice", contractId: k1.id, contractorId: c1.id, title: "Hisob-faktura INV-1001", didoxId: "DX-INV-1001", createdAt: daysAgo(60), extracted: { amount: "5 000 000,00 UZS" } },
      { tenantId: tenantA.id, type: "invoice", contractId: k2.id, contractorId: c2.id, title: "Hisob-faktura INV-1002", didoxId: "DX-INV-1002", createdAt: daysAgo(35), extracted: { amount: "12 000 000,00 UZS" } },
      { tenantId: tenantA.id, type: "invoice", contractId: k3.id, contractorId: c3.id, title: "Hisob-faktura INV-1003", didoxId: "DX-INV-1003", createdAt: daysAgo(5), extracted: { amount: "3 500 000,00 UZS" } },
      { tenantId: tenantA.id, type: "act", contractId: k1.id, contractorId: c1.id, title: "Bajarilgan ishlar dalolatnomasi #1001", didoxId: "DX-ACT-1001", createdAt: daysAgo(58) },
      { tenantId: tenantA.id, type: "reconciliation_act", contractId: k2.id, contractorId: c2.id, title: "Solishtirma dalolatnoma (akt-sverka)", didoxId: "DX-REC-2002", createdAt: daysAgo(30) },
      { tenantId: tenantA.id, type: "ttn", contractId: k1.id, contractorId: c1.id, title: "Yuk xati TTN-5567", didoxId: "DX-TTN-5567", createdAt: daysAgo(59) },
    ]);
  });

  // Tenant B: minimal (izolyatsiya testi uchun bitta kontragent)
  await withTenant(tenantB.id, async (tx) => {
    await tx.insert(users).values({
      tenantId: tenantB.id,
      email: "admin@betabank.uz",
      passwordHash,
      fullName: "Dilnoza Yusupova",
      role: "owner",
      locale: "ru",
    });
    await tx.insert(contractors).values({
      tenantId: tenantB.id,
      name: 'KREDIT MIJOZ MCHJ',
      tin: "308999000",
      legalAddress: "Toshkent sh., Yunusobod t.",
    });
  });

  console.log(`✓ Seed tayyor.`);
  console.log(`  Tenant A (company): ${tenantA.id}  — rahbar@alfatrade.uz / Parol123!`);
  console.log(`  Tenant B (bank):    ${tenantB.id}  — admin@betabank.uz / Parol123!`);
  await closeDb();
}

main().catch(async (err) => {
  console.error("✗ Seed xatosi:", err);
  await closeDb();
  process.exit(1);
});
