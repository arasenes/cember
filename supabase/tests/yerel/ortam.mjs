// Yerel Postgres (pglite) ortamı: Supabase'e dokunmadan migration'ları ve yetki (RLS) testlerini çalıştırır.
// Kurulum: `npm install --no-save @electric-sql/pglite` ; çalıştırma: `node supabase/tests/yerel/calistir.mjs supabase/tests/dm_rls.sql`
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const kok = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Supabase'in sağladığı ama depoda olmayan parçaların basit karşılıkları
const TASLAK = `
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), instance_id uuid, aud text, role text, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
alter table storage.objects enable row level security;
create schema realtime;
create table realtime.messages (extension text);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$ select null::text $$;
create publication supabase_realtime;
create schema net;
create function net.http_post(url text, headers jsonb default '{}'::jsonb, body jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000) returns bigint language sql as $$ select 1::bigint $$;
grant usage on schema public, auth, storage, realtime, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant all on all tables in schema storage, realtime, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth, realtime, extensions to anon, authenticated, service_role;
`;

export async function yeniVeritabani({ migrationSonu = Infinity } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(TASLAK);
  const dosyalar = readdirSync(join(kok, "migrations")).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  for (const f of dosyalar) {
    const no = Number(f.split("_")[0]);
    if (no > migrationSonu) break;
    try {
      // pg_net yerelde yok: tetikleyicinin çağırdığı net.http_post taslağı yeterli
      await db.exec(readFileSync(join(kok, "migrations", f), "utf8").split("create extension if not exists pg_net;").join(""));
    } catch (e) {
      throw new Error(`Migration hatası (${f}): ${e.message}`);
    }
  }
  // Not: Supabase, varsayılan yetkileri tablo oluşurken verir (alter default privileges); migration'daki revoke'lar sonradan geçerlidir.
  return db;
}

/** Bir test SQL dosyasını çalıştırır; dosya sonunda bilerek verdiği hata metni rapordur. */
export async function testCalistir(db, dosya) {
  const sql = readFileSync(dosya, "utf8");
  try {
    await db.exec(sql);
    return "(test hata vermedi; rapor yok)";
  } catch (e) {
    return String(e.message ?? e);
  }
}
