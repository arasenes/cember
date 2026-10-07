-- Aşama 4: kanal kategorileri (daraltılabilir gruplar). Yönetim "kanal_yonet" iznine bağlıdır.
create table if not exists public.kategoriler (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.odalar(id) on delete cascade,
  ad text not null check (char_length(ad) between 1 and 30),
  sira integer not null default 0
);
create index if not exists kategoriler_oda on public.kategoriler (oda_id, sira);
alter table public.kategoriler enable row level security;
create policy kategoriler_oku on public.kategoriler for select to authenticated using (uye_mi(oda_id));

alter table public.kanallar add column if not exists kategori_id uuid references public.kategoriler(id) on delete set null;
create index if not exists kanallar_kategori on public.kanallar (kategori_id);

create or replace function public.kategori_olustur(p_oda uuid, p_ad text) returns uuid
language plpgsql security definer set search_path to 'public' as
$$
declare v_id uuid; v_ad text := trim(regexp_replace(coalesce(p_ad, ''), '\s+', ' ', 'g'));
begin
  if not public.izin_var(p_oda, 'kanal_yonet') then raise exception 'Kategori açma yetkin yok'; end if;
  if char_length(v_ad) < 1 or char_length(v_ad) > 30 then raise exception 'Kategori adı 1-30 karakter olmalı'; end if;
  if (select count(*) from public.kategoriler where oda_id = p_oda) >= 20 then raise exception 'En fazla 20 kategori açılabilir'; end if;
  insert into public.kategoriler (oda_id, ad, sira) values (p_oda, v_ad, coalesce((select max(sira) from public.kategoriler where oda_id = p_oda), 0) + 1) returning id into v_id;
  return v_id;
end $$;

create or replace function public.kategori_guncelle(p_id uuid, p_ad text) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_ad text := trim(regexp_replace(coalesce(p_ad, ''), '\s+', ' ', 'g'));
begin
  select oda_id into v_oda from public.kategoriler where id = p_id;
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Yetkin yok'; end if;
  if char_length(v_ad) < 1 or char_length(v_ad) > 30 then raise exception 'Kategori adı 1-30 karakter olmalı'; end if;
  update public.kategoriler set ad = v_ad where id = p_id;
end $$;

create or replace function public.kategori_sil(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid;
begin
  select oda_id into v_oda from public.kategoriler where id = p_id;
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Yetkin yok'; end if;
  delete from public.kategoriler where id = p_id;  -- kanalların kategori_id'si boşalır
end $$;

-- Sürükle-bırak sonucu: kanalların kategori ve sırası, kategorilerin sırası tek seferde (hepsi aynı sunucuda olmalı)
-- p_kanallar: [{"id": "...", "kategori_id": "..."|null, "sira": 1}], p_kategoriler: [{"id": "...", "sira": 1}]
create or replace function public.kanallari_duzenle(p_oda uuid, p_kanallar jsonb, p_kategoriler jsonb) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare k jsonb;
begin
  if not public.izin_var(p_oda, 'kanal_yonet') then raise exception 'Kanalları düzenlemek için yetkin yok'; end if;
  for k in select * from jsonb_array_elements(coalesce(p_kategoriler, '[]'::jsonb)) loop
    update public.kategoriler set sira = (k->>'sira')::int where id = (k->>'id')::uuid and oda_id = p_oda;
    if not found then raise exception 'Kategori bu sunucuda değil'; end if;
  end loop;
  for k in select * from jsonb_array_elements(coalesce(p_kanallar, '[]'::jsonb)) loop
    if (k->>'kategori_id') is not null and not exists (select 1 from public.kategoriler where id = (k->>'kategori_id')::uuid and oda_id = p_oda) then
      raise exception 'Kategori bu sunucuda değil';
    end if;
    update public.kanallar set sira = (k->>'sira')::int, kategori_id = nullif(k->>'kategori_id', '')::uuid where id = (k->>'id')::uuid and oda_id = p_oda;
    if not found then raise exception 'Kanal bu sunucuda değil'; end if;
  end loop;
end $$;

revoke execute on function public.kategori_olustur(uuid, text), public.kategori_guncelle(uuid, text), public.kategori_sil(uuid), public.kanallari_duzenle(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.kategori_olustur(uuid, text), public.kategori_guncelle(uuid, text), public.kategori_sil(uuid), public.kanallari_duzenle(uuid, jsonb, jsonb) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kategoriler') then
    alter publication supabase_realtime add table public.kategoriler;
  end if;
end $$;
