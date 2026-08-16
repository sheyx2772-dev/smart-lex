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
  "payables",
  "payments",
  "receivables",
  "collection_rules",
  "reminders",
  "approval_requests",
  "audit_logs",
  "agent_tasks",
  "debt_cases",
  "recovery_playbooks",
  "case_events",
  "pending_overrides",
  "chain_anchors",
  "payment_promises",
  "financing_listings",
  "legal_matters",
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

    // ── One-ID (SSO): tenant konteksti hali yo'q. Bu funksiyalar login oqimida
    //    RLS'ni nazorat ostida chetlab o'tadi (owner huquqi bilan), boshqa hech narsani ochmaydi.

    // Tashkilotni STIR (tenants.tin) bo'yicha topish — One-ID legal_info.tin bilan mos.
    `CREATE OR REPLACE FUNCTION auth_find_tenant_by_tin(p_tin text)
     RETURNS TABLE(id uuid, default_locale text)
     LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
       SELECT id, default_locale::text FROM tenants WHERE tin = p_tin LIMIT 1;
     $$;`,
    `REVOKE ALL ON FUNCTION auth_find_tenant_by_tin(text) FROM PUBLIC;`,
    `GRANT EXECUTE ON FUNCTION auth_find_tenant_by_tin(text) TO lex_app;`,

    // Foydalanuvchini One-ID PIN (JShShIR) bo'yicha tashkilot ichida topish.
    `CREATE OR REPLACE FUNCTION auth_find_user_by_oneid(p_tenant uuid, p_pin text)
     RETURNS TABLE(id uuid, tenant_id uuid, role text, locale text, full_name text, is_active boolean)
     LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
       SELECT id, tenant_id, role::text, locale::text, full_name, is_active
       FROM users WHERE tenant_id = p_tenant AND oneid_pin = p_pin LIMIT 1;
     $$;`,
    `REVOKE ALL ON FUNCTION auth_find_user_by_oneid(uuid, text) FROM PUBLIC;`,
    `GRANT EXECUTE ON FUNCTION auth_find_user_by_oneid(uuid, text) TO lex_app;`,

    // Mavjud (parolli) foydalanuvchini birinchi One-ID kirishда PIN bilan bog'lash —
    // email bo'yicha topib, oneid_pin bo'sh bo'lsa to'ldiradi. Aks holda hech nima.
    `CREATE OR REPLACE FUNCTION auth_link_oneid_by_email(p_tenant uuid, p_email text, p_pin text, p_sub text)
     RETURNS TABLE(id uuid, tenant_id uuid, role text, locale text, full_name text, is_active boolean)
     LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
       UPDATE users SET oneid_pin = p_pin, oneid_sub = p_sub, updated_at = now()
       WHERE tenant_id = p_tenant AND lower(email) = lower(p_email) AND oneid_pin IS NULL
       RETURNING id, tenant_id, role::text, locale::text, full_name, is_active;
     $$;`,
    `REVOKE ALL ON FUNCTION auth_link_oneid_by_email(uuid, text, text, text) FROM PUBLIC;`,
    `GRANT EXECUTE ON FUNCTION auth_link_oneid_by_email(uuid, text, text, text) TO lex_app;`,

    // Yangi One-ID foydalanuvchisini yaratish (avtomatik provisioning yoqilganда).
    // Parolsiz (password_hash NULL). Default rol 'viewer'. Email bo'lmasa PIN'dan yasaladi.
    `CREATE OR REPLACE FUNCTION auth_create_oneid_user(p_tenant uuid, p_pin text, p_sub text, p_full_name text, p_email text, p_locale text)
     RETURNS TABLE(id uuid, tenant_id uuid, role text, locale text, full_name text, is_active boolean)
     LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
     DECLARE r record;
     BEGIN
       INSERT INTO users (tenant_id, email, password_hash, full_name, role, locale, is_active, oneid_pin, oneid_sub)
       VALUES (p_tenant, coalesce(nullif(p_email, ''), p_pin || '@oneid.local'), NULL, p_full_name,
               'viewer', coalesce(nullif(p_locale, ''), 'uz')::locale, true, p_pin, p_sub)
       RETURNING users.id, users.tenant_id, users.role::text, users.locale::text, users.full_name, users.is_active
       INTO r;
       RETURN QUERY SELECT r.id, r.tenant_id, r.role, r.locale, r.full_name, r.is_active;
     END;
     $$;`,
    `REVOKE ALL ON FUNCTION auth_create_oneid_user(uuid, text, text, text, text, text) FROM PUBLIC;`,
    `GRANT EXECUTE ON FUNCTION auth_create_oneid_user(uuid, text, text, text, text, text) TO lex_app;`,
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
