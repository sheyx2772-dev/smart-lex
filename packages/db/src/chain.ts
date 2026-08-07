/**
 * O'ZGARTIRIB BO'LMAYDIGAN ZANJIR (immutable audit chain).
 *
 * `audit_logs` va `documents` uchun DB TRIGGER orqali (ilova kodida emas —
 * shuning uchun HECH BIR route buni chetlab o'ta olmaydi) har bir yozuvga
 * SHA-256 hash biriktiriladi, tenant bo'yicha zanjir sifatida (har yozuv
 * o'zidan oldingisining hash'iga bog'langan). Birorta yozuv orqadan
 * o'zgartirilsa (UPDATE) — trigger buni FAQAT INSERT'da ishlaydi, ya'ni
 * keyingi UPDATE hash'ni yangilamaydi va zanjirni tekshirish (verifyChain)
 * paytida saqlangan hash bilan haqiqiy tarkib mos kelmasligi ANIQLANADI.
 */
export function chainStatements(): string[] {
  return [
    `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,

    // ── audit_logs zanjiri ──────────────────────────────────────────────
    // Zanjir "uchi" (tip) alohida jadvalda, per-tenant SATR sifatida saqlanadi va
    // har bir insert'da SELECT ... FOR UPDATE bilan qulflanadi. Bu — bir nechta
    // qatorli INSERT (bitta statement ichida) va bir vaqtdagi (concurrent)
    // tranzaksiyalarni ATOM ravishda ketma-ketlashtiradi (serialize qiladi):
    // oddiy "ORDER BY created_at DESC LIMIT 1" audit_logs jadvalining o'zidan
    // o'qish ishonchsiz — bitta statement ichidagi bir-nechta qatorli INSERT'da
    // oldingi qator hali ko'rinmasligi mumkin (MVCC statement-snapshot sababli),
    // natijada ikkita qator bir xil prev_hash'ga ega bo'lib, zanjir "shoxlanadi".
    `CREATE TABLE IF NOT EXISTS audit_chain_tip (
       tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
       tip_hash text
     );`,
    `CREATE OR REPLACE FUNCTION compute_audit_hash() RETURNS trigger
     LANGUAGE plpgsql AS $$
     DECLARE prev text;
     BEGIN
       INSERT INTO audit_chain_tip (tenant_id, tip_hash) VALUES (NEW.tenant_id, NULL)
         ON CONFLICT (tenant_id) DO NOTHING;

       SELECT tip_hash INTO prev FROM audit_chain_tip WHERE tenant_id = NEW.tenant_id FOR UPDATE;

       NEW.prev_hash := prev;
       NEW.record_hash := encode(
         digest(
           coalesce(prev, 'GENESIS') || '|' || NEW.tenant_id::text || '|' ||
           NEW.actor_type::text || '|' || coalesce(NEW.actor_id, '') || '|' ||
           NEW.action || '|' || coalesce(NEW.entity_type, '') || '|' ||
           coalesce(NEW.entity_id::text, '') || '|' || coalesce(NEW.detail::text, '') || '|' ||
           NEW.created_at::text,
           'sha256'
         ),
         'hex'
       );

       UPDATE audit_chain_tip SET tip_hash = NEW.record_hash WHERE tenant_id = NEW.tenant_id;

       RETURN NEW;
     END;
     $$;`,
    `DROP TRIGGER IF EXISTS trg_audit_hash ON audit_logs;`,
    `CREATE TRIGGER trg_audit_hash BEFORE INSERT ON audit_logs
       FOR EACH ROW EXECUTE FUNCTION compute_audit_hash();`,
    // Zanjirni prev_hash ko'rsatkichi bo'yicha yurish (verify_audit_chain) uchun.
    `CREATE INDEX IF NOT EXISTS audit_logs_tenant_prevhash_idx ON audit_logs (tenant_id, prev_hash);`,

    // ── documents barmoq izi (identifikatsiya maydonlari — INSERT'dagi holat) ──
    `CREATE OR REPLACE FUNCTION compute_document_hash() RETURNS trigger
     LANGUAGE plpgsql AS $$
     BEGIN
       NEW.content_hash := encode(
         digest(
           NEW.tenant_id::text || '|' || NEW.type::text || '|' || NEW.title || '|' ||
           coalesce(NEW.s3_key, '') || '|' || NEW.created_at::text,
           'sha256'
         ),
         'hex'
       );
       RETURN NEW;
     END;
     $$;`,
    `DROP TRIGGER IF EXISTS trg_document_hash ON documents;`,
    `CREATE TRIGGER trg_document_hash BEFORE INSERT ON documents
       FOR EACH ROW EXECUTE FUNCTION compute_document_hash();`,

    // ── Zanjirni SERVERDA tekshirish (SECURITY DEFINER — ilova rlsdan mustaqil
    //    ravishda BUTUN tarixni qayta hisoblab, saqlangan hash bilan solishtiradi).
    //    MUHIM #1: created_at/id bo'yicha SARALASH ISHONCH BERMAYDI — bir tranzaksiya
    //    ichidagi qatorlar bir xil created_at'ga ega bo'lishi mumkin (now() bitta
    //    tranzaksiya ichida muzlatilgan), id esa tasodifiy UUID. Shuning uchun
    //    haqiqiy tartib faqat prev_hash -> record_hash BOG'LANGAN ZANJIR (linked
    //    list) bo'yicha tiklanadi: genesis'dan (prev_hash IS NULL) boshlab, har
    //    safar "keyingi" qatorni prev_hash = joriy record_hash orqali topamiz.
    //    MUHIM #2: faqat `record_hash IS NOT NULL` yozuvlar tekshiriladi — trigger
    //    o'rnatilgunga QADAR yaratilgan eski yozuvlar hech qachon hash olmagan
    //    (retroaktiv hisoblab bo'lmaydi), shuning uchun ular "buzilgan" deb SANALMAYDI:
    //    zanjir shunchaki trigger o'rnatilgan kundan boshlab kuchda.
    `CREATE OR REPLACE FUNCTION verify_audit_chain(p_tenant uuid)
     RETURNS TABLE(total_records bigint, broken_at_id uuid, broken_at_created timestamptz, is_valid boolean)
     LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
     DECLARE
       r record;
       cur_hash text := NULL;
       expected text;
       cnt bigint := 0;
       total bigint;
       genesis_count bigint;
       bad_id uuid := NULL;
       bad_created timestamptz := NULL;
     BEGIN
       SELECT count(*) INTO total FROM audit_logs WHERE tenant_id = p_tenant AND record_hash IS NOT NULL;
       SELECT count(*) INTO genesis_count FROM audit_logs WHERE tenant_id = p_tenant AND record_hash IS NOT NULL AND prev_hash IS NULL;

       IF total > 0 AND genesis_count <> 1 THEN
         -- Noto'g'ri son boshlang'ich (genesis) yozuv — zanjir buzilgan yoki shoxlangan.
         SELECT id, created_at INTO bad_id, bad_created FROM audit_logs
           WHERE tenant_id = p_tenant AND record_hash IS NOT NULL AND prev_hash IS NULL ORDER BY created_at ASC LIMIT 1;
         RETURN QUERY SELECT total, bad_id, bad_created, false;
         RETURN;
       END IF;

       LOOP
         SELECT id, tenant_id, actor_type, actor_id, action, entity_type, entity_id, detail, created_at, record_hash, prev_hash
           INTO r
           FROM audit_logs
           WHERE tenant_id = p_tenant AND record_hash IS NOT NULL AND prev_hash IS NOT DISTINCT FROM cur_hash
           LIMIT 1;

         EXIT WHEN NOT FOUND;

         cnt := cnt + 1;
         expected := encode(
           digest(
             coalesce(cur_hash, 'GENESIS') || '|' || r.tenant_id::text || '|' ||
             r.actor_type::text || '|' || coalesce(r.actor_id, '') || '|' ||
             r.action || '|' || coalesce(r.entity_type, '') || '|' ||
             coalesce(r.entity_id::text, '') || '|' || coalesce(r.detail::text, '') || '|' ||
             r.created_at::text,
             'sha256'
           ),
           'hex'
         );
         IF r.record_hash IS DISTINCT FROM expected THEN
           bad_id := r.id;
           bad_created := r.created_at;
           EXIT;
         END IF;
         cur_hash := r.record_hash;
       END LOOP;

       -- Zanjir tugadi-yu, hali barcha yozuvlarga yetib bormagan bo'lsak (masalan,
       -- biror qator hech kimning prev_hash'i orqali ko'rsatilmagan/yetim) — buzilgan.
       RETURN QUERY SELECT total, bad_id, bad_created, (bad_id IS NULL AND cnt = total);
     END;
     $$;`,
    `REVOKE ALL ON FUNCTION verify_audit_chain(uuid) FROM PUBLIC;`,
    `GRANT EXECUTE ON FUNCTION verify_audit_chain(uuid) TO lex_app;`,
  ];
}
