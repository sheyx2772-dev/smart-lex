/**
 * Multi-tenant RLS siyosatlari. Har bir tenant-scoped jadval faqat
 * `app.current_tenant` kontekstidagi qatorlarni ko'rsatadi/o'zgartiradi.
 *
 * `current_setting(..., true)` o'rnatilmagan bo'lsa NULL qaytadi => hech qanday qator
 * ko'rinmaydi (fail-closed). `FORCE ROW LEVEL SECURITY` — jadval egasi (owner) ham
 * siyosatga bo'ysunadi, ya'ni ilova owner sifatida ulansa ham izolyatsiya ishlaydi.
 */
export const TENANT_SCOPED_TABLES = [
  "users",
  "contractors",
  "contracts",
  "documents",
  "invoices",
  "payments",
  "receivables",
  "collection_rules",
  "reminders",
  "approval_requests",
  "audit_logs",
] as const;

/**
 * Ilova roli (`lex_app`) — NOSUPERUSER NOBYPASSRLS. Superuser RLS'ni chetlab o'tadi,
 * shuning uchun ilova HECH QACHON owner/superuser bilan ulanmaydi. Migratsiya owner
 * bilan, ilova (api/worker/seed) shu cheklangan rol bilan ishlaydi.
 */
export function appRoleStatements(appPassword = "lex_app"): string[] {
  return [
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lex_app') THEN
         CREATE ROLE lex_app LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
       END IF;
     END $$;`,
    `GRANT USAGE ON SCHEMA public TO lex_app;`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lex_app;`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lex_app;`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lex_app;`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lex_app;`,
  ];
}

/**
 * Login uchun email bo'yicha user topish — tenant konteksti hali yo'q, `users` esa RLS
 * bilan himoyalangan. SECURITY DEFINER funksiya faqat SHU bitta operatsiya uchun
 * nazorat ostida RLS'ni chetlab o'tadi (owner huquqi bilan). Boshqa hech narsa ochilmaydi.
 */
export function authFunctionStatements(): string[] {
  return [
    `CREATE OR REPLACE FUNCTION auth_find_user(p_email text)
     RETURNS TABLE(id uuid, tenant_id uuid, password_hash text, role text, locale text, full_name text, is_active boolean)
     LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
       SELECT id, tenant_id, password_hash, role::text, locale::text, full_name, is_active
       FROM users WHERE email = p_email AND is_active = true LIMIT 1;
     $$;`,
    `REVOKE ALL ON FUNCTION auth_find_user(text) FROM PUBLIC;`,
    `GRANT EXECUTE ON FUNCTION auth_find_user(text) TO lex_app;`,
  ];
}

export function rlsStatements(): string[] {
  const stmts: string[] = [];
  for (const table of TENANT_SCOPED_TABLES) {
    stmts.push(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    stmts.push(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    stmts.push(`DROP POLICY IF EXISTS tenant_isolation ON "${table}";`);
    // NULLIF(..., '') — bo'sh string uuid'ga cast bo'lmasligi uchun (pool artefakti);
    // qiymat yo'q bo'lsa NULL => hech qanday qator ko'rinmaydi (fail-closed).
    const tenantExpr = `NULLIF(current_setting('app.current_tenant', true), '')::uuid`;
    stmts.push(
      `CREATE POLICY tenant_isolation ON "${table}" ` +
        `USING (tenant_id = ${tenantExpr}) ` +
        `WITH CHECK (tenant_id = ${tenantExpr});`,
    );
  }
  return stmts;
}
