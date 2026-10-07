-- Canlı veritabanına 023-031 sırayla uygular (022 zaten uygulandı). Supabase SQL editöründe parça parça çalıştır; her parçadan sonra hata olmadığını kontrol et.

-- ===================== 023_arama_ifade_dizini.sql =====================
-- Canlı veritabanını 016'nın son haline getirir: üretilmiş `arama` sütunu kalkar, ifade dizini gelir.
-- (PG 18'e geçişte replica identity FULL + üretilmiş sütun, mesaj UPDATE/DELETE'ini bozardı.)
-- Eski dizin üretilmiş sütunun üstündeydi (aynı ad): önce o gider, sonra ifade dizini kurulur
drop index if exists public.mesajlar_arama_gin;
create index mesajlar_arama_gin on public.mesajlar using gin (to_tsvector('turkish', coalesce(metin, '')));

create or replace function public.mesaj_ara(
  p_oda uuid, p_sorgu text, p_kanal uuid default null, p_uye uuid default null,
  p_bas timestamptz default null, p_son timestamptz default null, p_ekli boolean default null, p_limit integer default 30
) returns setof public.mesajlar
language plpgsql stable security invoker set search_path to 'public' as
$$
declare temiz text; terimler text; sorgu tsquery;
begin
  temiz := trim(regexp_replace(lower(coalesce(p_sorgu, '')), '[^[:alnum:][:space:]]', ' ', 'g'));
  select string_agg(t || ':*', ' & ') into terimler
    from (select t from unnest(regexp_split_to_array(temiz, '\s+')) t where t <> '' limit 8) x;
  if terimler is not null then sorgu := to_tsquery('turkish', terimler); end if;
  return query
    select m.* from public.mesajlar m
    where public.kanal_odasi(m.kanal_id) = p_oda
      and not m.silindi
      and (sorgu is null or to_tsvector('turkish', coalesce(m.metin, '')) @@ sorgu)
      and (p_kanal is null or m.kanal_id = p_kanal)
      and (p_uye is null or m.uye_id = p_uye)
      and (p_bas is null or m.olusturma >= p_bas)
      and (p_son is null or m.olusturma < p_son)
      and (p_ekli is null or (m.ek_yol is not null) = p_ekli)
      and (sorgu is not null or p_kanal is not null or p_uye is not null or p_bas is not null or p_son is not null or p_ekli is not null)
    order by m.olusturma desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50);
end $$;

alter table public.mesajlar drop column if exists arama;

-- ===================== 024_roller_izinler.sql =====================
-- Aşama 4: özel roller ve izinler. İzinler bit maskesi (bigint):
--   1 mesaj_yaz · 2 dosya · 4 ses_konus · 8 ekran_kamera · 16 mesaj_yonet · 32 sustur · 64 yasakla · 128 kanal_yonet · 256 davet
-- Etkin izin = sunucudaki "Herkes" izni | (moderatörse) "Moderatör" izni | atanmış özel rollerin izinleri. Sahip her şeyi yapar.
-- Eski davranış korunur: Herkes=15 (yaz, dosya, konuş, ekran/kamera), Moderatör=447 (+mesaj yönet, sustur, kanal yönet, davet; yasaklama yok).

alter table public.odalar add column if not exists herkes_izin bigint not null default 15;
alter table public.odalar add column if not exists moderator_izin bigint not null default 447;
alter table public.odalar add column if not exists silindi boolean not null default false;
alter table public.odalar add column if not exists ikon_metin text check (ikon_metin is null or char_length(ikon_metin) between 1 and 2);
alter table public.odalar add column if not exists ikon_renk text not null default '#4fd1a5' check (ikon_renk ~ '^#[0-9A-Fa-f]{6}$');

create table if not exists public.roller (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.odalar(id) on delete cascade,
  ad text not null check (char_length(ad) between 1 and 30),
  renk text not null default '#9aa3b5' check (renk ~ '^#[0-9A-Fa-f]{6}$'),
  izinler bigint not null default 15 check (izinler >= 0 and izinler < 512),
  sira integer not null default 0,
  olusturma timestamptz not null default now()
);
create unique index if not exists roller_oda_ad on public.roller (oda_id, lower(ad));
create table if not exists public.uye_rolleri (
  uye_id uuid not null references public.uyeler(id) on delete cascade,
  rol_id uuid not null references public.roller(id) on delete cascade,
  primary key (uye_id, rol_id)
);
create index if not exists uye_rolleri_rol on public.uye_rolleri (rol_id);
alter table public.roller enable row level security;
alter table public.uye_rolleri enable row level security;

create or replace function public.izin_maske(p_ad text) returns bigint language sql immutable as
$$ select case p_ad
     when 'mesaj_yaz' then 1 when 'dosya' then 2 when 'ses_konus' then 4 when 'ekran_kamera' then 8 when 'mesaj_yonet' then 16
     when 'sustur' then 32 when 'yasakla' then 64 when 'kanal_yonet' then 128 when 'davet' then 256 else 0 end::bigint $$;

create or replace function public.uye_oda(p_uye uuid) returns uuid language sql stable security definer set search_path to 'public' as
$$ select oda_id from public.uyeler where id = p_uye; $$;

-- Bu odadaki etkin izin maskem (sahip: tümü). Üye değilsem 0.
create or replace function public.izinlerim(p_oda uuid) returns bigint language sql stable security definer set search_path to 'public' as
$$
  select case when u.rol = 'sahip' then 511::bigint
    else o.herkes_izin
       | (case when u.rol = 'moderator' then o.moderator_izin else 0 end)
       | coalesce((select bit_or(r.izinler) from public.uye_rolleri ur join public.roller r on r.id = ur.rol_id where ur.uye_id = u.id), 0)
    end
  from public.uyeler u join public.odalar o on o.id = u.oda_id
  where u.oda_id = p_oda and u.user_id = auth.uid() and not u.silindi
  limit 1;
$$;

create or replace function public.izin_var(p_oda uuid, p_ad text) returns boolean language sql stable security definer set search_path to 'public' as
$$ select coalesce((public.izinlerim(p_oda) & public.izin_maske(p_ad)) <> 0, false); $$;

-- Okuma politikaları: sunucunun üyeleri rolleri görür
create policy roller_oku on public.roller for select to authenticated using (uye_mi(oda_id));
create policy uye_rolleri_oku on public.uye_rolleri for select to authenticated using (uye_mi(uye_oda(uye_id)));

-- ===== Rol yönetimi (yalnızca sunucu sahibi) =====
create or replace function public.rol_olustur(p_oda uuid, p_ad text, p_renk text, p_izinler bigint) returns uuid
language plpgsql security definer set search_path to 'public' as
$$
declare v_id uuid; v_ad text := trim(coalesce(p_ad, ''));
begin
  if not public.sahip_mi(p_oda) then raise exception 'Rolleri yalnızca sunucu sahibi yönetebilir'; end if;
  if char_length(v_ad) < 1 or char_length(v_ad) > 30 then raise exception 'Rol adı 1-30 karakter olmalı'; end if;
  if (select count(*) from public.roller where oda_id = p_oda) >= 20 then raise exception 'En fazla 20 rol açılabilir'; end if;
  insert into public.roller (oda_id, ad, renk, izinler, sira)
    values (p_oda, v_ad, coalesce(nullif(p_renk, ''), '#9aa3b5'), coalesce(p_izinler, 15) & 511, coalesce((select max(sira) from public.roller where oda_id = p_oda), 0) + 1)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.rol_guncelle(p_rol uuid, p_ad text, p_renk text, p_izinler bigint) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_ad text := trim(coalesce(p_ad, ''));
begin
  select oda_id into v_oda from public.roller where id = p_rol;
  if v_oda is null or not public.sahip_mi(v_oda) then raise exception 'Rolleri yalnızca sunucu sahibi yönetebilir'; end if;
  if char_length(v_ad) < 1 or char_length(v_ad) > 30 then raise exception 'Rol adı 1-30 karakter olmalı'; end if;
  update public.roller set ad = v_ad, renk = coalesce(nullif(p_renk, ''), renk), izinler = coalesce(p_izinler, izinler) & 511 where id = p_rol;
end $$;

create or replace function public.rol_sil(p_rol uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid;
begin
  select oda_id into v_oda from public.roller where id = p_rol;
  if v_oda is null or not public.sahip_mi(v_oda) then raise exception 'Rolleri yalnızca sunucu sahibi yönetebilir'; end if;
  delete from public.roller where id = p_rol;
end $$;

create or replace function public.rol_ata(p_uye uuid, p_rol uuid, p_ver boolean default true) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_uye_oda uuid;
begin
  select oda_id into v_oda from public.roller where id = p_rol;
  select oda_id into v_uye_oda from public.uyeler where id = p_uye;
  if v_oda is null or v_oda is distinct from v_uye_oda then raise exception 'Rol ve üye aynı sunucuda olmalı'; end if;
  if not public.sahip_mi(v_oda) then raise exception 'Rolleri yalnızca sunucu sahibi yönetebilir'; end if;
  if p_ver then insert into public.uye_rolleri (uye_id, rol_id) values (p_uye, p_rol) on conflict do nothing;
  else delete from public.uye_rolleri where uye_id = p_uye and rol_id = p_rol; end if;
end $$;

-- "Herkes" ve "Moderatör" izinleri
create or replace function public.temel_izin_ayarla(p_oda uuid, p_tur text, p_izinler bigint) returns void
language plpgsql security definer set search_path to 'public' as
$$
begin
  if not public.sahip_mi(p_oda) then raise exception 'İzinleri yalnızca sunucu sahibi yönetebilir'; end if;
  if p_tur = 'herkes' then update public.odalar set herkes_izin = coalesce(p_izinler, 15) & 511 where id = p_oda;
  elsif p_tur = 'moderator' then update public.odalar set moderator_izin = coalesce(p_izinler, 447) & 511 where id = p_oda;
  else raise exception 'Geçersiz tür'; end if;
end $$;

-- ===== Mevcut kuralların izne bağlanması =====
alter policy mesajlar_yaz on public.mesajlar
  with check (benim_uyem(uye_id) and (not sabit) and (not susturuldu_mu(uye_id)) and uye_mi(kanal_odasi(kanal_id))
    and kanal_erisim(kanal_id) and izin_var(kanal_odasi(kanal_id), 'mesaj_yaz')
    and ust_mesaj_gecerli(ust_mesaj_id, kanal_id) and yanit_gecerli(yanit_id, kanal_id)
    and (ek_yol is null or (izin_var(kanal_odasi(kanal_id), 'dosya') and ek_yol like kanal_odasi(kanal_id)::text || '/' || kanal_id::text || '/%')));

alter policy mesajlar_guncelle on public.mesajlar
  using (benim_uyem(uye_id) or izin_var(kanal_odasi(kanal_id), 'mesaj_yonet'))
  with check (benim_uyem(uye_id) or izin_var(kanal_odasi(kanal_id), 'mesaj_yonet'));

create or replace function public.mesaj_sabitle(p_mesaj uuid, p_sabit boolean) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_kanal uuid; v_oda uuid; v_silindi boolean;
begin
  select kanal_id, silindi into v_kanal, v_silindi from public.mesajlar where id = p_mesaj;
  select oda_id into v_oda from public.kanallar where id = v_kanal;
  if v_oda is null or not public.izin_var(v_oda, 'mesaj_yonet') then raise exception 'Yetkin yok'; end if;
  if p_sabit and v_silindi then raise exception 'Silinmiş mesaj sabitlenemez'; end if;
  if p_sabit and (select count(*) from public.mesajlar where kanal_id = v_kanal and sabit) >= 20 then
    raise exception 'Bir kanalda en fazla 20 mesaj sabitlenebilir';
  end if;
  update public.mesajlar set sabit = p_sabit, sabit_zaman = case when p_sabit then now() else null end where id = p_mesaj;
end $$;

create or replace function public.anket_olustur(p_kanal uuid, p_soru text, p_secenekler text[], p_sure_dk integer default null, p_coklu boolean default false)
returns uuid language plpgsql security definer set search_path to 'public' as
$$
declare v_uye uuid; v_soru text := trim(coalesce(p_soru, '')); v_secs text[]; v_mesaj uuid; v_anket uuid; i int;
begin
  select u.id into v_uye from public.uyeler u
    where u.user_id = auth.uid() and u.oda_id = public.kanal_odasi(p_kanal) and not u.silindi;
  if v_uye is null or not public.kanal_erisim(p_kanal) or not public.izin_var(public.kanal_odasi(p_kanal), 'mesaj_yaz') then raise exception 'Bu kanala yazamazsın'; end if;
  if public.susturuldu_mu(v_uye) then raise exception 'Susturulduğun için anket açamazsın'; end if;
  if char_length(v_soru) < 1 or char_length(v_soru) > 200 then raise exception 'Soru 1-200 karakter olmalı'; end if;
  select array_agg(trim(s)) into v_secs from unnest(coalesce(p_secenekler, '{}')) s where trim(s) <> '';
  if coalesce(array_length(v_secs, 1), 0) < 2 or array_length(v_secs, 1) > 6 then raise exception 'Anket 2-6 seçenek içermeli'; end if;
  for i in 1..array_length(v_secs, 1) loop
    if char_length(v_secs[i]) > 100 then raise exception 'Seçenek en fazla 100 karakter olabilir'; end if;
  end loop;
  if p_sure_dk is not null and (p_sure_dk < 1 or p_sure_dk > 60 * 24 * 30) then raise exception 'Süre 1 dakika ile 30 gün arasında olmalı'; end if;
  insert into public.mesajlar (kanal_id, uye_id, metin) values (p_kanal, v_uye, v_soru) returning id into v_mesaj;
  insert into public.anketler (mesaj_id, soru, bitis, coklu)
    values (v_mesaj, v_soru, case when p_sure_dk is null then null else now() + make_interval(mins => p_sure_dk) end, coalesce(p_coklu, false))
    returning id into v_anket;
  for i in 1..array_length(v_secs, 1) loop
    insert into public.anket_secenekleri (anket_id, metin, sira) values (v_anket, v_secs[i], i);
  end loop;
  return v_mesaj;
end $$;

-- Eski imzalar kalkar (aynı adlı ikinci bir aşırı yükleme çağrıları belirsiz yapardı)
drop function if exists public.kanal_olustur(text, text, text);
drop function if exists public.yonet_hedef(uuid);

-- Kanal yönetimi: oda parametresi artık açık (çoklu sunucu); verilmezse kanal_yonet iznim olan ilk sunucu
create or replace function public.kanal_olustur(p_ad text, p_tur text, p_sifre text default null, p_oda uuid default null) returns uuid
language plpgsql security definer set search_path to 'public', 'extensions' as
$$
declare v_oda uuid := p_oda; v_id uuid; v_ad text := trim(regexp_replace(coalesce(p_ad, ''), '\s+', ' ', 'g')); v_sifre text := nullif(coalesce(p_sifre, ''), '');
begin
  if v_oda is null then
    select u.oda_id into v_oda from public.uyeler u where u.user_id = auth.uid() and not u.silindi and public.izin_var(u.oda_id, 'kanal_yonet') order by u.olusturma limit 1;
  end if;
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Kanal açma yetkin yok'; end if;
  if char_length(v_ad) < 1 or char_length(v_ad) > 40 then raise exception 'Kanal adı 1-40 karakter olmalı'; end if;
  if p_tur not in ('yazili', 'sesli') then raise exception 'Geçersiz kanal türü'; end if;
  if v_sifre is not null and (char_length(v_sifre) < 3 or char_length(v_sifre) > 40) then raise exception 'Şifre 3-40 karakter olmalı'; end if;
  if (select count(*) from public.kanallar where oda_id = v_oda) >= 40 then raise exception 'En fazla 40 kanal açılabilir'; end if;
  insert into public.kanallar (oda_id, ad, tur, sira, sifreli)
    values (v_oda, v_ad, p_tur, coalesce((select max(sira) from public.kanallar where oda_id = v_oda), 0) + 1, v_sifre is not null)
    returning id into v_id;
  if v_sifre is not null then
    insert into public.kanal_sifreleri (kanal_id, sifre_hash) values (v_id, extensions.crypt(v_sifre, extensions.gen_salt('bf')));
  end if;
  return v_id;
end $$;

create or replace function public.kanal_sifre_ayarla(p_kanal uuid, p_sifre text) returns void
language plpgsql security definer set search_path to 'public', 'extensions' as
$$
declare v_oda uuid; v_sifre text := nullif(coalesce(p_sifre, ''), '');
begin
  select oda_id into v_oda from public.kanallar where id = p_kanal;
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Yetkin yok'; end if;
  if v_sifre is not null and (char_length(v_sifre) < 3 or char_length(v_sifre) > 40) then raise exception 'Şifre 3-40 karakter olmalı'; end if;
  if v_sifre is null then
    update public.kanallar set sifreli = false where id = p_kanal;
    delete from public.kanal_sifreleri where kanal_id = p_kanal;
  else
    insert into public.kanal_sifreleri (kanal_id, sifre_hash) values (p_kanal, extensions.crypt(v_sifre, extensions.gen_salt('bf')))
      on conflict (kanal_id) do update set sifre_hash = excluded.sifre_hash;
    update public.kanallar set sifreli = true where id = p_kanal;
  end if;
  delete from public.kanal_acik where kanal_id = p_kanal;
end $$;

create or replace function public.kanal_sil(p_kanal uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid;
begin
  select oda_id into v_oda from public.kanallar where id = p_kanal;
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Kanal silmek için yetkin yok'; end if;
  if (select count(*) from public.kanallar where oda_id = v_oda and tur = 'yazili') <= 1
     and (select tur from public.kanallar where id = p_kanal) = 'yazili' then
    raise exception 'Son yazılı kanal silinemez';
  end if;
  delete from public.kanallar where id = p_kanal;
end $$;

create or replace function public.kanal_aciklama_ayarla(p_kanal uuid, p_metin text) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_metin text := nullif(trim(coalesce(p_metin, '')), '');
begin
  select oda_id into v_oda from public.kanallar where id = p_kanal;
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Yetkin yok'; end if;
  if v_metin is not null and char_length(v_metin) > 200 then raise exception 'Açıklama en fazla 200 karakter olabilir'; end if;
  update public.kanallar set aciklama = v_metin where id = p_kanal;
end $$;

-- Üye yönetimi: hedefe işlem yapabilmek için ilgili izin gerekir; sahip herkese, diğerleri yalnızca sıradan üyeye (rol 'uye') işlem yapar
create or replace function public.yonet_hedef(p_uye uuid, p_izin text default 'sustur') returns public.uyeler
language plpgsql stable security definer set search_path to 'public' as
$$
declare h public.uyeler; ben_rol text;
begin
  select * into h from public.uyeler where id = p_uye;
  if not found then raise exception 'Üye bulunamadı'; end if;
  select rol into ben_rol from public.uyeler where oda_id = h.oda_id and user_id = auth.uid() and not silindi;
  if ben_rol is null or not public.izin_var(h.oda_id, p_izin) then raise exception 'Bu işlem için yetkin yok'; end if;
  if h.rol = 'sahip' then raise exception 'Oda sahibine işlem yapılamaz'; end if;
  if ben_rol <> 'sahip' and h.rol <> 'uye' then raise exception 'Moderatör, başka bir moderatöre işlem yapamaz'; end if;
  return h;
end $$;

create or replace function public.yonet_mesajlari_sil(p_uye uuid) returns integer
language plpgsql security definer set search_path to 'public' as
$$
declare h public.uyeler; n int;
begin
  h := public.yonet_hedef(p_uye, 'mesaj_yonet');
  update public.mesajlar set silindi = true where uye_id = h.id and silindi = false;
  get diagnostics n = row_count;
  return n;
end $$;

-- ===== Yetkiler =====
revoke execute on function public.izin_maske(text), public.uye_oda(uuid), public.izinlerim(uuid), public.izin_var(uuid, text),
  public.rol_olustur(uuid, text, text, bigint), public.rol_guncelle(uuid, text, text, bigint), public.rol_sil(uuid), public.rol_ata(uuid, uuid, boolean),
  public.temel_izin_ayarla(uuid, text, bigint), public.yonet_hedef(uuid, text), public.kanal_olustur(text, text, text, uuid) from public, anon;
grant execute on function public.izin_maske(text), public.uye_oda(uuid), public.izinlerim(uuid), public.izin_var(uuid, text),
  public.rol_olustur(uuid, text, text, bigint), public.rol_guncelle(uuid, text, text, bigint), public.rol_sil(uuid), public.rol_ata(uuid, uuid, boolean),
  public.temel_izin_ayarla(uuid, text, bigint), public.yonet_hedef(uuid, text), public.kanal_olustur(text, text, text, uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'roller') then
    alter publication supabase_realtime add table public.roller, public.uye_rolleri;
  end if;
end $$;

-- ===================== 025_kategoriler.sql =====================
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

-- ===================== 026_sunucular_davetler.sql =====================
-- Aşama 4: çoklu sunucu ve davet bağlantıları.
-- Davet yalnızca bir sunucuya katılım içindir (eski davet-kodu girişi geri gelmez). Misafir hesaplar sunucu kuramaz / davetle katılamaz.

-- Webhook botları üye satırı olarak tutulur (user_id boş); davet sayımına girmez
alter table public.uyeler add column if not exists bot boolean not null default false;

alter policy odalar_oku on public.odalar using (uye_mi(id) and not silindi);

create table if not exists public.davetler (
  kod text primary key check (kod ~ '^[A-Za-z0-9]{6,16}$'),
  oda_id uuid not null references public.odalar(id) on delete cascade,
  olusturan uuid references public.uyeler(id) on delete set null,
  bitis timestamptz,
  kullanim_limiti integer check (kullanim_limiti is null or kullanim_limiti > 0),
  kullanim integer not null default 0,
  olusturma timestamptz not null default now()
);
create index if not exists davetler_oda on public.davetler (oda_id);
alter table public.davetler enable row level security;
create policy davetler_oku on public.davetler for select to authenticated using (izin_var(oda_id, 'davet'));

create or replace function public.davet_olustur(p_oda uuid, p_gun integer default 7, p_limit integer default null) returns text
language plpgsql security definer set search_path to 'public' as
$$
declare v_kod text; v_uye uuid; i int := 0;
begin
  if not public.izin_var(p_oda, 'davet') then raise exception 'Davet oluşturma yetkin yok'; end if;
  if p_gun is not null and (p_gun < 1 or p_gun > 30) then raise exception 'Süre 1-30 gün olmalı'; end if;
  if p_limit is not null and (p_limit < 1 or p_limit > 1000) then raise exception 'Kullanım sınırı 1-1000 olmalı'; end if;
  if (select count(*) from public.davetler where oda_id = p_oda and (bitis is null or bitis > now())) >= 10 then raise exception 'En fazla 10 geçerli davet olabilir'; end if;
  select id into v_uye from public.uyeler where oda_id = p_oda and user_id = auth.uid() and not silindi;
  loop
    v_kod := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.davetler where kod = v_kod);
    i := i + 1; if i > 5 then raise exception 'Davet kodu üretilemedi'; end if;
  end loop;
  insert into public.davetler (kod, oda_id, olusturan, bitis, kullanim_limiti)
    values (v_kod, p_oda, v_uye, case when p_gun is null then null else now() + make_interval(days => p_gun) end, p_limit);
  return v_kod;
end $$;

create or replace function public.davet_sil(p_kod text) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid;
begin
  select oda_id into v_oda from public.davetler where kod = p_kod;
  if v_oda is null or not public.izin_var(v_oda, 'davet') then raise exception 'Yetkin yok'; end if;
  delete from public.davetler where kod = p_kod;
end $$;

-- Giriş yapmadan da çalışır: davet sayfası sunucu adını ve geçerliliği gösterir (başka hiçbir şey sızmaz)
create or replace function public.davet_bilgi(p_kod text) returns table (oda_ad text, uye_sayisi integer, gecerli boolean)
language sql stable security definer set search_path to 'public' as
$$
  select o.ad, (select count(*)::int from public.uyeler u where u.oda_id = o.id and not u.silindi and not u.bot),
         (not o.silindi and (d.bitis is null or d.bitis > now()) and (d.kullanim_limiti is null or d.kullanim < d.kullanim_limiti))
  from public.davetler d join public.odalar o on o.id = d.oda_id where d.kod = upper(p_kod);
$$;

-- Davetle katıl: mevcut hesabın takma adıyla (çakışırsa başka ad gerekir)
create or replace function public.davet_katil(p_kod text, p_takma_ad text default null) returns uuid
language plpgsql security definer set search_path to 'public' as
$$
declare v_d public.davetler; v_ad text; v_renk text; v_say int; v_oda uuid;
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın'; end if;
  if exists (select 1 from public.uyeler where user_id = auth.uid() and misafir) then raise exception 'Misafir hesaplar davetle katılamaz; Google ile giriş yap'; end if;
  select * into v_d from public.davetler where kod = upper(p_kod) for update;
  if not found then raise exception 'Davet geçersiz ya da süresi dolmuş'; end if;
  v_oda := v_d.oda_id;
  -- Zaten üyeysen davet tükenmiş olsa bile sorunsuz döner
  if exists (select 1 from public.uyeler where oda_id = v_oda and user_id = auth.uid() and not silindi) then return v_oda; end if;
  if (v_d.bitis is not null and v_d.bitis <= now()) or (v_d.kullanim_limiti is not null and v_d.kullanim >= v_d.kullanim_limiti) then raise exception 'Davet geçersiz ya da süresi dolmuş'; end if;
  if (select silindi from public.odalar where id = v_oda) then raise exception 'Bu sunucu artık yok'; end if;
  v_ad := trim(regexp_replace(coalesce(nullif(trim(p_takma_ad), ''), (select takma_ad from public.uyeler where user_id = auth.uid() and not silindi order by olusturma limit 1)), '\s+', ' ', 'g'));
  if v_ad is null or char_length(v_ad) < 2 or char_length(v_ad) > 24 then raise exception 'Takma ad 2-24 karakter olmalı'; end if;
  if exists (select 1 from public.uyeler where oda_id = v_oda and lower(takma_ad) = lower(v_ad)) then raise exception 'Bu takma ad bu sunucuda kullanılıyor, başka bir tane seç'; end if;
  if exists (select 1 from public.yasaklar where oda_id = v_oda and lower(takma_ad) = lower(v_ad)) then raise exception 'Bu sunucuya girişin engellendi'; end if;
  select count(*) into v_say from public.uyeler where oda_id = v_oda and not silindi and not bot;
  if v_say >= 50 then raise exception 'Sunucu dolu'; end if;
  select renk into v_renk from public.uyeler where user_id = auth.uid() and not silindi order by olusturma limit 1;
  insert into public.uyeler (oda_id, user_id, takma_ad, renk, rol) values (v_oda, auth.uid(), v_ad, coalesce(v_renk, '#4fd1a5'), 'uye');
  update public.davetler set kullanim = kullanim + 1 where kod = v_d.kod;
  return v_oda;
end $$;

-- Yeni sunucu: kurucu sahip olur; "genel-sohbet" ve "Salon" kanalları hazır gelir
create or replace function public.sunucu_olustur(p_ad text) returns uuid
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_ad text := trim(regexp_replace(coalesce(p_ad, ''), '\s+', ' ', 'g')); v_u public.uyeler;
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın'; end if;
  select * into v_u from public.uyeler where user_id = auth.uid() and not silindi order by olusturma limit 1;
  if not found then raise exception 'Önce bir sunucuya üye olmalısın'; end if;
  if v_u.misafir then raise exception 'Misafir hesaplar sunucu kuramaz; Google ile giriş yap'; end if;
  if char_length(v_ad) < 2 or char_length(v_ad) > 40 then raise exception 'Sunucu adı 2-40 karakter olmalı'; end if;
  if (select count(*) from public.odalar where olusturan = auth.uid() and not silindi) >= 5 then raise exception 'En fazla 5 sunucu kurabilirsin'; end if;
  insert into public.odalar (ad, davet_kodu, olusturan, ikon_metin) values (v_ad, 'S-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), auth.uid(), upper(left(v_ad, 1))) returning id into v_oda;
  insert into public.uyeler (oda_id, user_id, takma_ad, renk, rol) values (v_oda, auth.uid(), v_u.takma_ad, v_u.renk, 'sahip');
  insert into public.kanallar (oda_id, ad, tur, sira) values (v_oda, 'genel-sohbet', 'yazili', 1), (v_oda, 'Salon', 'sesli', 2);
  return v_oda;
end $$;

create or replace function public.sunucu_ayarla(p_oda uuid, p_ad text, p_ikon_metin text, p_ikon_renk text) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_ad text := trim(regexp_replace(coalesce(p_ad, ''), '\s+', ' ', 'g'));
begin
  if not public.sahip_mi(p_oda) then raise exception 'Sunucu ayarlarını yalnızca sahip değiştirebilir'; end if;
  if char_length(v_ad) < 2 or char_length(v_ad) > 40 then raise exception 'Sunucu adı 2-40 karakter olmalı'; end if;
  update public.odalar set ad = v_ad, ikon_metin = nullif(left(trim(coalesce(p_ikon_metin, '')), 2), ''), ikon_renk = coalesce(nullif(p_ikon_renk, ''), ikon_renk) where id = p_oda;
end $$;

-- Sunucuyu sil (gizler): varsayılan (ilk) sunucu silinemez
create or replace function public.sunucu_sil(p_oda uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
begin
  if not public.sahip_mi(p_oda) then raise exception 'Sunucuyu yalnızca sahip silebilir'; end if;
  if p_oda = (select id from public.odalar order by olusturma limit 1) then raise exception 'Varsayılan sunucu silinemez'; end if;
  update public.odalar set silindi = true where id = p_oda;
end $$;

revoke execute on function public.davet_olustur(uuid, integer, integer), public.davet_sil(text), public.davet_bilgi(text), public.davet_katil(text, text),
  public.sunucu_olustur(text), public.sunucu_ayarla(uuid, text, text, text), public.sunucu_sil(uuid) from public, anon;
grant execute on function public.davet_olustur(uuid, integer, integer), public.davet_sil(text), public.davet_katil(text, text),
  public.sunucu_olustur(text), public.sunucu_ayarla(uuid, text, text, text), public.sunucu_sil(uuid) to authenticated;
grant execute on function public.davet_bilgi(text) to anon, authenticated;

-- ===================== 027_denetim_kaydi.sql =====================
-- Aşama 4: denetim kaydı. Yöneticilerin eylemleri veritabanı tetikleyicileriyle otomatik yazılır; yalnızca yetkililer okur.
-- Servis anahtarıyla yapılan eylemler (üye atma, yasaklama, sesten atma) `yonet` edge function'ı tarafından yazılır.
create table if not exists public.denetim_kaydi (
  id bigserial primary key,
  oda_id uuid not null references public.odalar(id) on delete cascade,
  eyleyen uuid references public.uyeler(id) on delete set null,
  eylem text not null check (char_length(eylem) between 1 and 40),
  hedef text check (hedef is null or char_length(hedef) <= 80),
  ayrinti jsonb not null default '{}'::jsonb,
  zaman timestamptz not null default now()
);
create index if not exists denetim_kaydi_oda_zaman on public.denetim_kaydi (oda_id, zaman desc);
alter table public.denetim_kaydi enable row level security;
-- Okuma: mesaj_yonet (16) | sustur (32) | yasakla (64) | kanal_yonet (128) izinlerinden biri
create policy denetim_kaydi_oku on public.denetim_kaydi for select to authenticated using ((izinlerim(oda_id) & 240) <> 0);

-- Şu anki kullanıcının bu sunucudaki üye kimliği
create or replace function public.benim_uyem_oda(p_oda uuid) returns uuid language sql stable security definer set search_path to 'public' as
$$ select id from public.uyeler where oda_id = p_oda and user_id = auth.uid() and not silindi limit 1; $$;

create or replace function public.denetim_yaz(p_oda uuid, p_eylem text, p_hedef text, p_ayrinti jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path to 'public' as
$$
begin
  insert into public.denetim_kaydi (oda_id, eyleyen, eylem, hedef, ayrinti)
  values (p_oda, public.benim_uyem_oda(p_oda), p_eylem, left(p_hedef, 80), coalesce(p_ayrinti, '{}'::jsonb));
end $$;

-- Başkasının mesajını silme (kendi mesajını silmek kayda girmez)
create or replace function public.denetim_mesaj() returns trigger language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_ben uuid;
begin
  if new.silindi and not old.silindi and auth.uid() is not null then
    v_oda := public.kanal_odasi(new.kanal_id);
    v_ben := public.benim_uyem_oda(v_oda);
    if v_ben is not null and v_ben <> new.uye_id then
      perform public.denetim_yaz(v_oda, 'mesaj_sil', (select takma_ad from public.uyeler where id = new.uye_id), jsonb_build_object('kanal', (select ad from public.kanallar where id = new.kanal_id)));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists denetim_mesaj_tr on public.mesajlar;
create trigger denetim_mesaj_tr after update of silindi on public.mesajlar for each row execute function public.denetim_mesaj();

-- Susturma ve rol değişikliği
create or replace function public.denetim_uye() returns trigger language plpgsql security definer set search_path to 'public' as
$$
begin
  if auth.uid() is null or public.benim_uyem_oda(new.oda_id) is not distinct from new.id then return new; end if;
  if new.susturma_bitis is distinct from old.susturma_bitis then
    perform public.denetim_yaz(new.oda_id, case when new.susturma_bitis is null or new.susturma_bitis <= now() then 'sustur_kaldir' else 'sustur' end, new.takma_ad,
      jsonb_build_object('bitis', new.susturma_bitis));
  end if;
  if new.rol is distinct from old.rol then
    perform public.denetim_yaz(new.oda_id, 'rol_degis', new.takma_ad, jsonb_build_object('eski', old.rol, 'yeni', new.rol));
  end if;
  return new;
end $$;
drop trigger if exists denetim_uye_tr on public.uyeler;
create trigger denetim_uye_tr after update of susturma_bitis, rol on public.uyeler for each row execute function public.denetim_uye();

create or replace function public.denetim_uye_rolu() returns trigger language plpgsql security definer set search_path to 'public' as
$$
declare v_uye uuid := coalesce(new.uye_id, old.uye_id); v_rol uuid := coalesce(new.rol_id, old.rol_id); v_oda uuid;
begin
  select oda_id into v_oda from public.uyeler where id = v_uye;
  if v_oda is not null and auth.uid() is not null then
    perform public.denetim_yaz(v_oda, case when tg_op = 'INSERT' then 'rol_ver' else 'rol_al' end, (select takma_ad from public.uyeler where id = v_uye),
      jsonb_build_object('rol', (select ad from public.roller where id = v_rol)));
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists denetim_uye_rolu_tr on public.uye_rolleri;
create trigger denetim_uye_rolu_tr after insert or delete on public.uye_rolleri for each row execute function public.denetim_uye_rolu();

create or replace function public.denetim_rol() returns trigger language plpgsql security definer set search_path to 'public' as
$$
declare r public.roller := coalesce(new, old);
begin
  if auth.uid() is not null then
    perform public.denetim_yaz(r.oda_id, case tg_op when 'INSERT' then 'rol_olustur' when 'UPDATE' then 'rol_guncelle' else 'rol_sil' end, r.ad,
      case when tg_op = 'UPDATE' then jsonb_build_object('izinler', new.izinler) else '{}'::jsonb end);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists denetim_rol_tr on public.roller;
create trigger denetim_rol_tr after insert or update or delete on public.roller for each row execute function public.denetim_rol();

create or replace function public.denetim_kanal() returns trigger language plpgsql security definer set search_path to 'public' as
$$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then perform public.denetim_yaz(new.oda_id, 'kanal_ekle', new.ad, jsonb_build_object('tur', new.tur));
  elsif tg_op = 'DELETE' then perform public.denetim_yaz(old.oda_id, 'kanal_sil', old.ad, jsonb_build_object('tur', old.tur));
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists denetim_kanal_tr on public.kanallar;
create trigger denetim_kanal_tr after insert or delete on public.kanallar for each row execute function public.denetim_kanal();

create or replace function public.denetim_davet() returns trigger language plpgsql security definer set search_path to 'public' as
$$
begin
  if auth.uid() is not null then perform public.denetim_yaz(new.oda_id, 'davet_olustur', new.kod, jsonb_build_object('bitis', new.bitis, 'limit', new.kullanim_limiti)); end if;
  return new;
end $$;
drop trigger if exists denetim_davet_tr on public.davetler;
create trigger denetim_davet_tr after insert on public.davetler for each row execute function public.denetim_davet();

create or replace function public.denetim_oda() returns trigger language plpgsql security definer set search_path to 'public' as
$$
begin
  if auth.uid() is not null and (new.ad is distinct from old.ad or new.herkes_izin is distinct from old.herkes_izin or new.moderator_izin is distinct from old.moderator_izin) then
    perform public.denetim_yaz(new.id, 'sunucu_ayar', new.ad, jsonb_build_object('herkes', new.herkes_izin, 'moderator', new.moderator_izin));
  end if;
  return new;
end $$;
drop trigger if exists denetim_oda_tr on public.odalar;
create trigger denetim_oda_tr after update on public.odalar for each row execute function public.denetim_oda();

revoke execute on function public.benim_uyem_oda(uuid), public.denetim_yaz(uuid, text, text, jsonb) from public, anon;
grant execute on function public.benim_uyem_oda(uuid) to authenticated;
revoke execute on function public.denetim_mesaj(), public.denetim_uye(), public.denetim_uye_rolu(), public.denetim_rol(), public.denetim_kanal(), public.denetim_davet(), public.denetim_oda() from public, anon, authenticated;

-- ===================== 028_moderasyon_webhook.sql =====================
-- Aşama 4: yavaş mod, yasaklı kelimeler, hoş geldin mesajı, webhook botları.

-- ===== Yavaş mod =====
alter table public.kanallar add column if not exists yavas_mod integer not null default 0 check (yavas_mod between 0 and 21600);

-- Üyenin (oturumdan bağımsız) etkin izin maskesi; kuralları tetikleyicilerde kullanmak için
create or replace function public.uye_izni(p_uye uuid) returns bigint language sql stable security definer set search_path to 'public' as
$$
  select case when u.rol = 'sahip' then 511::bigint
    else o.herkes_izin
       | (case when u.rol = 'moderator' then o.moderator_izin else 0 end)
       | coalesce((select bit_or(r.izinler) from public.uye_rolleri ur join public.roller r on r.id = ur.rol_id where ur.uye_id = u.id), 0)
    end
  from public.uyeler u join public.odalar o on o.id = u.oda_id where u.id = p_uye;
$$;

create or replace function public.yavas_mod_uygun(p_kanal uuid, p_uye uuid) returns boolean language sql stable security definer set search_path to 'public' as
$$
  select case
    when k.yavas_mod = 0 then true
    when (coalesce(public.uye_izni(p_uye), 0) & 16) <> 0 then true  -- mesaj_yonet izni olanlar yavaş moda takılmaz
    else not exists (select 1 from public.mesajlar m where m.kanal_id = p_kanal and m.uye_id = p_uye and m.olusturma > now() - make_interval(secs => k.yavas_mod))
  end
  from public.kanallar k where k.id = p_kanal;
$$;

alter policy mesajlar_yaz on public.mesajlar
  with check (benim_uyem(uye_id) and (not sabit) and (not susturuldu_mu(uye_id)) and uye_mi(kanal_odasi(kanal_id))
    and kanal_erisim(kanal_id) and izin_var(kanal_odasi(kanal_id), 'mesaj_yaz') and yavas_mod_uygun(kanal_id, uye_id)
    and ust_mesaj_gecerli(ust_mesaj_id, kanal_id) and yanit_gecerli(yanit_id, kanal_id)
    and (ek_yol is null or (izin_var(kanal_odasi(kanal_id), 'dosya') and ek_yol like kanal_odasi(kanal_id)::text || '/' || kanal_id::text || '/%')));

create or replace function public.kanal_yavas_mod_ayarla(p_kanal uuid, p_sn integer) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_eski integer;
begin
  select oda_id, yavas_mod into v_oda, v_eski from public.kanallar where id = p_kanal;
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Yetkin yok'; end if;
  if p_sn is null or p_sn < 0 or p_sn > 21600 then raise exception 'Yavaş mod 0-21600 saniye olmalı'; end if;
  update public.kanallar set yavas_mod = p_sn where id = p_kanal;
  if p_sn is distinct from v_eski then
    perform public.denetim_yaz(v_oda, 'yavas_mod', (select ad from public.kanallar where id = p_kanal), jsonb_build_object('sn', p_sn));
  end if;
end $$;

-- ===== Yasaklı kelimeler ve hoş geldin mesajı =====
alter table public.odalar add column if not exists yasakli_kelimeler text[] not null default '{}';
alter table public.odalar add column if not exists hosgeldin_mesaji text check (hosgeldin_mesaji is null or char_length(hosgeldin_mesaji) <= 300);
alter table public.odalar add column if not exists hosgeldin_kanal uuid references public.kanallar(id) on delete set null;

-- Türkçe büyük/küçük harf farkları (İ, ı) kelime eşleşmesini bozmasın
create or replace function public.kelime_norm(p text) returns text language sql immutable as
$$ select replace(translate(lower(coalesce(p, '')), 'ıİ', 'ii'), E'̇', '') $$;

create or replace function public.moderasyon_ayarla(p_oda uuid, p_kelimeler text[], p_hosgeldin text, p_hosgeldin_kanal uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_k text[];
begin
  if not public.sahip_mi(p_oda) then raise exception 'Bu ayarları yalnızca sunucu sahibi değiştirebilir'; end if;
  select coalesce(array_agg(distinct public.kelime_norm(trim(x))) filter (where trim(x) <> ''), '{}') into v_k from unnest(coalesce(p_kelimeler, '{}')) x;
  if coalesce(array_length(v_k, 1), 0) > 100 then raise exception 'En fazla 100 yasaklı kelime olabilir'; end if;
  if exists (select 1 from unnest(v_k) x where char_length(x) > 40) then raise exception 'Kelime en fazla 40 karakter olabilir'; end if;
  if p_hosgeldin_kanal is not null and not exists (select 1 from public.kanallar where id = p_hosgeldin_kanal and oda_id = p_oda and tur = 'yazili') then raise exception 'Hoş geldin kanalı bu sunucuda bir yazılı kanal olmalı'; end if;
  update public.odalar set yasakli_kelimeler = v_k, hosgeldin_mesaji = nullif(trim(coalesce(p_hosgeldin, '')), ''), hosgeldin_kanal = p_hosgeldin_kanal where id = p_oda;
end $$;

-- Yasaklı kelime içeren mesaj (mesaj_yonet izni olmayanlardan) yazılamaz ya da düzenlenemez
create or replace function public.kelime_filtresi() returns trigger language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_k text[]; w text; m text := public.kelime_norm(new.metin);
begin
  if tg_op = 'UPDATE' and new.metin is not distinct from old.metin then return new; end if;
  v_oda := public.kanal_odasi(new.kanal_id);
  select yasakli_kelimeler into v_k from public.odalar where id = v_oda;
  if coalesce(array_length(v_k, 1), 0) = 0 then return new; end if;
  if (coalesce(public.uye_izni(new.uye_id), 0) & 16) <> 0 then return new; end if;
  foreach w in array v_k loop
    if m ~ ('(^|[^[:alnum:]])' || regexp_replace(w, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '([^[:alnum:]]|$)') then
      raise exception 'Mesajında bu sunucuda yasaklı bir kelime var';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists kelime_filtresi_tr on public.mesajlar;
create trigger kelime_filtresi_tr before insert or update of metin on public.mesajlar for each row execute function public.kelime_filtresi();

-- Yeni üye gelince hoş geldin mesajı: sunucu sahibi adına, seçili ya da ilk yazılı kanala
create or replace function public.hosgeldin_mesaji_yaz() returns trigger language plpgsql security definer set search_path to 'public' as
$$
declare o public.odalar; v_sahip uuid; v_kanal uuid;
begin
  if new.bot or new.rol = 'sahip' then return new; end if;
  select * into o from public.odalar where id = new.oda_id;
  if o.hosgeldin_mesaji is null then return new; end if;
  select id into v_sahip from public.uyeler where oda_id = new.oda_id and rol = 'sahip' and not silindi order by olusturma limit 1;
  v_kanal := coalesce(o.hosgeldin_kanal, (select id from public.kanallar where oda_id = new.oda_id and tur = 'yazili' order by sira limit 1));
  if v_sahip is null or v_kanal is null then return new; end if;
  insert into public.mesajlar (kanal_id, uye_id, metin) values (v_kanal, v_sahip, left(replace(o.hosgeldin_mesaji, '{ad}', new.takma_ad), 4000));
  return new;
end $$;
drop trigger if exists hosgeldin_tr on public.uyeler;
create trigger hosgeldin_tr after insert on public.uyeler for each row execute function public.hosgeldin_mesaji_yaz();

-- ===== Webhook =====
create table if not exists public.webhooklar (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.odalar(id) on delete cascade,
  kanal_id uuid not null references public.kanallar(id) on delete cascade,
  bot_uye uuid not null references public.uyeler(id) on delete cascade,
  ad text not null check (char_length(ad) between 2 and 24),
  sifre_hash text not null,
  olusturma timestamptz not null default now()
);
alter table public.webhooklar enable row level security;
revoke select on public.webhooklar from authenticated, anon;
grant select (id, oda_id, kanal_id, ad, olusturma) on public.webhooklar to authenticated;
create policy webhooklar_oku on public.webhooklar for select to authenticated using (izin_var(oda_id, 'kanal_yonet'));

-- Dönen şifre yalnızca burada bir kez görünür (veritabanında özeti saklanır)
create or replace function public.webhook_olustur(p_kanal uuid, p_ad text) returns table (id uuid, sifre text)
language plpgsql security definer set search_path to 'public', 'extensions' as
$$
declare v_oda uuid; v_ad text := trim(regexp_replace(coalesce(p_ad, ''), '\s+', ' ', 'g')); v_bot uuid; v_id uuid; v_sifre text;
begin
  select k.oda_id into v_oda from public.kanallar k where k.id = p_kanal and k.tur = 'yazili';
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Yetkin yok'; end if;
  if char_length(v_ad) < 2 or char_length(v_ad) > 24 then raise exception 'Webhook adı 2-24 karakter olmalı'; end if;
  if (select count(*) from public.webhooklar where oda_id = v_oda) >= 10 then raise exception 'En fazla 10 webhook açılabilir'; end if;
  if exists (select 1 from public.uyeler where oda_id = v_oda and lower(takma_ad) = lower(v_ad)) then raise exception 'Bu ad sunucuda kullanılıyor'; end if;
  insert into public.uyeler (oda_id, user_id, takma_ad, renk, rol, bot) values (v_oda, null, v_ad, '#9aa3b5', 'uye', true) returning uyeler.id into v_bot;
  v_sifre := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.webhooklar (oda_id, kanal_id, bot_uye, ad, sifre_hash) values (v_oda, p_kanal, v_bot, v_ad, encode(extensions.digest(v_sifre, 'sha256'), 'hex')) returning webhooklar.id into v_id;
  return query select v_id, v_sifre;
end $$;

create or replace function public.webhook_sil(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare w public.webhooklar;
begin
  select * into w from public.webhooklar where webhooklar.id = p_id;
  if w.id is null or not public.izin_var(w.oda_id, 'kanal_yonet') then raise exception 'Yetkin yok'; end if;
  delete from public.webhooklar where webhooklar.id = p_id;
  update public.uyeler set silindi = true, takma_ad = 'silindi-' || left(w.bot_uye::text, 8) where id = w.bot_uye;
end $$;

revoke execute on function public.uye_izni(uuid), public.yavas_mod_uygun(uuid, uuid), public.kanal_yavas_mod_ayarla(uuid, integer), public.moderasyon_ayarla(uuid, text[], text, uuid),
  public.webhook_olustur(uuid, text), public.webhook_sil(uuid) from public, anon;
grant execute on function public.uye_izni(uuid), public.yavas_mod_uygun(uuid, uuid), public.kanal_yavas_mod_ayarla(uuid, integer), public.moderasyon_ayarla(uuid, text[], text, uuid),
  public.webhook_olustur(uuid, text), public.webhook_sil(uuid) to authenticated;
revoke execute on function public.kelime_filtresi(), public.hosgeldin_mesaji_yaz() from public, anon, authenticated;

-- ===================== 029_dm_coklu_sunucu.sql =====================
-- Aşama 4: DM, grup DM ve arkadaşlıklar sunucu bağlamında çalışır. Bir kişinin her sunucuda ayrı üye kaydı olduğundan,
-- işlevler üye kimliğini "ilk kayıt" yerine hedefin/ DM'in sunucusundan türetir.

alter table public.dm_kanallari add column if not exists oda_id uuid references public.odalar(id) on delete cascade;
update public.dm_kanallari k set oda_id = (select u.oda_id from public.uyeler u where u.id = k.olusturan) where k.oda_id is null and k.olusturan is not null;
create index if not exists dm_kanallari_oda on public.dm_kanallari (oda_id);

drop function if exists public.uye_kimligim();
create or replace function public.uye_kimligim(p_oda uuid default null) returns uuid
language sql stable security definer set search_path to 'public' as
$$
  select id from public.uyeler where user_id = auth.uid() and not silindi and (p_oda is null or oda_id = p_oda) order by olusturma limit 1;
$$;

-- ===== Arkadaşlık =====
create or replace function public.arkadas_istek(p_hedef uuid) returns text
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim(public.uye_oda(p_hedef)); h public.uyeler; mevcut public.arkadasliklar;
begin
  if ben is null then raise exception 'Üye değilsin'; end if;
  select * into h from public.uyeler where id = p_hedef and not silindi and not bot and oda_id = (select oda_id from public.uyeler where id = ben);
  if not found or h.id = ben then raise exception 'Kişi bulunamadı'; end if;
  if public.engelli_mi(ben, p_hedef) then raise exception 'Bu kişiye istek gönderemezsin'; end if;
  select * into mevcut from public.arkadasliklar where durum <> 'engelli' and least(a, b) = least(ben, p_hedef) and greatest(a, b) = greatest(ben, p_hedef);
  if found then
    if mevcut.durum = 'kabul' then return 'zaten'; end if;
    if mevcut.a = ben then return 'bekliyor'; end if;
    update public.arkadasliklar set durum = 'kabul' where id = mevcut.id;
    return 'kabul';
  end if;
  if (select count(*) from public.arkadasliklar where a = ben and durum = 'bekliyor') >= 50 then raise exception 'En fazla 50 bekleyen istek olabilir'; end if;
  insert into public.arkadasliklar (a, b, durum) values (ben, p_hedef, 'bekliyor');
  return 'bekliyor';
end $$;

create or replace function public.arkadas_yanit(p_id uuid, p_kabul boolean) returns void
language plpgsql security definer set search_path to 'public' as
$$
begin
  if p_kabul then
    update public.arkadasliklar set durum = 'kabul'
      where id = p_id and durum = 'bekliyor' and b in (select id from public.uyeler where user_id = auth.uid() and not silindi);
  else
    delete from public.arkadasliklar
      where id = p_id and durum = 'bekliyor' and b in (select id from public.uyeler where user_id = auth.uid() and not silindi);
  end if;
end $$;

create or replace function public.arkadas_sil(p_hedef uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim(public.uye_oda(p_hedef));
begin
  delete from public.arkadasliklar where durum <> 'engelli' and ((a = ben and b = p_hedef) or (a = p_hedef and b = ben));
end $$;

create or replace function public.engelle(p_hedef uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim(public.uye_oda(p_hedef));
begin
  if ben is null or ben = p_hedef or not exists (select 1 from public.uyeler where id = p_hedef) then raise exception 'Kişi bulunamadı'; end if;
  perform public.arkadas_sil(p_hedef);
  insert into public.arkadasliklar (a, b, durum) values (ben, p_hedef, 'engelli') on conflict (a, b) do nothing;
end $$;

create or replace function public.engel_kaldir(p_hedef uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim(public.uye_oda(p_hedef));
begin
  delete from public.arkadasliklar where a = ben and b = p_hedef and durum = 'engelli';
end $$;

-- ===== DM =====
create or replace function public.dm_ac(p_hedef uuid) returns uuid
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid := public.uye_oda(p_hedef); ben uuid := public.uye_kimligim(public.uye_oda(p_hedef)); anahtar text; v_id uuid;
begin
  if ben is null then raise exception 'Üye değilsin'; end if;
  if p_hedef = ben or not exists (select 1 from public.uyeler h where h.id = p_hedef and not h.silindi and not h.bot and h.oda_id = v_oda) then
    raise exception 'Kişi bulunamadı';
  end if;
  if public.engelli_mi(ben, p_hedef) then raise exception 'Bu kişiye mesaj gönderemezsin'; end if;
  anahtar := least(ben, p_hedef)::text || '-' || greatest(ben, p_hedef)::text;
  select id into v_id from public.dm_kanallari where ikili_anahtar = anahtar;
  if v_id is not null then return v_id; end if;
  insert into public.dm_kanallari (tur, olusturan, ikili_anahtar, oda_id) values ('ikili', ben, anahtar, v_oda)
    on conflict (ikili_anahtar) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.dm_kanallari where ikili_anahtar = anahtar; return v_id; end if;
  insert into public.dm_uyeleri (dm_id, uye_id) values (v_id, ben), (v_id, p_hedef);
  return v_id;
end $$;

create or replace function public.dm_grup_olustur(p_ad text, p_uyeler uuid[]) returns uuid
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; ben uuid; v_ad text := nullif(trim(coalesce(p_ad, '')), ''); digerleri uuid[]; v_id uuid; u uuid;
begin
  if p_uyeler is null or array_length(p_uyeler, 1) is null then raise exception 'Grup DM için 2-9 kişi seç (en fazla 10 kişi)'; end if;
  v_oda := public.uye_oda(p_uyeler[1]);
  ben := public.uye_kimligim(v_oda);
  if ben is null then raise exception 'Üye değilsin'; end if;
  select array_agg(distinct x) into digerleri from unnest(p_uyeler) x where x <> ben;
  if coalesce(array_length(digerleri, 1), 0) < 2 or array_length(digerleri, 1) > 9 then raise exception 'Grup DM için 2-9 kişi seç (en fazla 10 kişi)'; end if;
  if v_ad is not null and char_length(v_ad) > 40 then raise exception 'Grup adı en fazla 40 karakter olabilir'; end if;
  foreach u in array digerleri loop
    if not exists (select 1 from public.uyeler h where h.id = u and not h.silindi and not h.bot and h.oda_id = v_oda) then raise exception 'Kişi bulunamadı'; end if;
    if public.engelli_mi(ben, u) then raise exception 'Engelli bir kişiyi gruba ekleyemezsin'; end if;
  end loop;
  insert into public.dm_kanallari (tur, ad, olusturan, oda_id) values ('grup', v_ad, ben, v_oda) returning id into v_id;
  insert into public.dm_uyeleri (dm_id, uye_id) select v_id, x from unnest(digerleri || ben) x;
  return v_id;
end $$;

create or replace function public.dm_grup_uye_ekle(p_dm uuid, p_uye uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; ben uuid;
begin
  select oda_id into v_oda from public.dm_kanallari where id = p_dm and tur = 'grup';
  ben := public.uye_kimligim(v_oda);
  if v_oda is null or not exists (select 1 from public.dm_kanallari where id = p_dm and olusturan = ben) then raise exception 'Yalnızca grubu kuran kişi ekleyebilir'; end if;
  if (select count(*) from public.dm_uyeleri where dm_id = p_dm) >= 10 then raise exception 'Grup en fazla 10 kişi olabilir'; end if;
  if public.engelli_mi(ben, p_uye) or not exists (select 1 from public.uyeler h where h.id = p_uye and not h.silindi and not h.bot and h.oda_id = v_oda) then
    raise exception 'Bu kişi eklenemez';
  end if;
  insert into public.dm_uyeleri (dm_id, uye_id) values (p_dm, p_uye) on conflict do nothing;
end $$;

create or replace function public.dm_okundu(p_dm uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
begin
  update public.dm_uyeleri set son_okuma = now() where dm_id = p_dm and uye_id in (select id from public.uyeler where user_id = auth.uid());
end $$;

create or replace function public.dm_okunmamis() returns table (dm_id uuid, n integer)
language sql stable security definer set search_path to 'public' as
$$
  select d.dm_id, count(m.id)::int
  from public.dm_uyeleri d
  join public.uyeler u on u.id = d.uye_id and u.user_id = auth.uid()
  join public.dm_mesajlari m on m.dm_id = d.dm_id and m.olusturma > d.son_okuma and m.uye_id <> d.uye_id and not m.silindi
  group by d.dm_id;
$$;

revoke execute on function public.uye_kimligim(uuid) from public, anon;
grant execute on function public.uye_kimligim(uuid) to authenticated;

-- ===================== 030_kanal_izinleri.sql =====================
-- Kanal bazlı izin geçersiz kılma (Discord "kanal izinleri"): bir kanalda Herkes / Moderatör / özel rol için
-- mesaj_yaz (1), dosya (2), ses_konus (4), ekran_kamera (8) izinleri verilebilir ya da kısılabilir.
-- Etkin kanal izni: sunucu izni → "Herkes" geçersiz kılması → üyenin rollerinin geçersiz kılmaları (önce kısıt, sonra izin). Sahip her şeyi yapar.

create table if not exists public.kanal_izinleri (
  id uuid primary key default gen_random_uuid(),
  kanal_id uuid not null references public.kanallar(id) on delete cascade,
  hedef text not null check (hedef in ('herkes', 'moderator', 'rol')),
  rol_id uuid references public.roller(id) on delete cascade,
  ver bigint not null default 0 check (ver >= 0 and ver < 16),
  yasak bigint not null default 0 check (yasak >= 0 and yasak < 16),
  check ((hedef = 'rol') = (rol_id is not null))
);
create unique index if not exists kanal_izinleri_hedef on public.kanal_izinleri (kanal_id, hedef, coalesce(rol_id, '00000000-0000-0000-0000-000000000000'::uuid));
alter table public.kanal_izinleri enable row level security;
create policy kanal_izinleri_oku on public.kanal_izinleri for select to authenticated using (uye_mi(kanal_odasi(kanal_id)));

-- Bir üyenin bir kanaldaki etkin izin maskesi
create or replace function public.uye_kanal_izni(p_uye uuid, p_kanal uuid) returns bigint
language plpgsql stable security definer set search_path to 'public' as
$$
declare
  v_rol text; v_m bigint; v_ver bigint; v_yasak bigint;
begin
  select u.rol into v_rol from public.uyeler u where u.id = p_uye;
  if v_rol is null then return 0; end if;
  v_m := coalesce(public.uye_izni(p_uye), 0);
  if v_rol = 'sahip' then return v_m; end if;
  select coalesce(bit_or(ver), 0), coalesce(bit_or(yasak), 0) into v_ver, v_yasak from public.kanal_izinleri where kanal_id = p_kanal and hedef = 'herkes';
  v_m := (v_m & ~v_yasak) | v_ver;
  select coalesce(bit_or(ki.ver), 0), coalesce(bit_or(ki.yasak), 0) into v_ver, v_yasak
    from public.kanal_izinleri ki
    where ki.kanal_id = p_kanal and (
      (ki.hedef = 'moderator' and v_rol = 'moderator')
      or (ki.hedef = 'rol' and ki.rol_id in (select ur.rol_id from public.uye_rolleri ur where ur.uye_id = p_uye)));
  return (v_m & ~v_yasak) | v_ver;
end $$;

-- Benim bu kanaldaki etkin iznim (istemci bunu yazı alanı ve sesli oda için kullanır)
create or replace function public.kanal_izni(p_kanal uuid) returns bigint
language sql stable security definer set search_path to 'public' as
$$
  select public.uye_kanal_izni(u.id, p_kanal)
  from public.uyeler u
  where u.oda_id = public.kanal_odasi(p_kanal) and u.user_id = auth.uid() and not u.silindi
  limit 1;
$$;

alter policy mesajlar_yaz on public.mesajlar
  with check (benim_uyem(uye_id) and (not sabit) and (not susturuldu_mu(uye_id)) and uye_mi(kanal_odasi(kanal_id))
    and kanal_erisim(kanal_id) and (uye_kanal_izni(uye_id, kanal_id) & 1) <> 0 and yavas_mod_uygun(kanal_id, uye_id)
    and ust_mesaj_gecerli(ust_mesaj_id, kanal_id) and yanit_gecerli(yanit_id, kanal_id)
    and (ek_yol is null or ((uye_kanal_izni(uye_id, kanal_id) & 2) <> 0 and ek_yol like kanal_odasi(kanal_id)::text || '/' || kanal_id::text || '/%')));

-- Ayarlama: yalnızca "kanalları yönet" izni olanlar. ver = yasak = 0 ise satır silinir.
create or replace function public.kanal_izin_ayarla(p_kanal uuid, p_hedef text, p_rol uuid, p_ver bigint, p_yasak bigint) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare
  v_oda uuid := public.kanal_odasi(p_kanal);
begin
  if v_oda is null or not public.izin_var(v_oda, 'kanal_yonet') then raise exception 'Kanal izinlerini değiştirme yetkin yok'; end if;
  if p_hedef not in ('herkes', 'moderator', 'rol') then raise exception 'Geçersiz hedef'; end if;
  if p_hedef = 'rol' and (p_rol is null or not exists (select 1 from public.roller r where r.id = p_rol and r.oda_id = v_oda)) then raise exception 'Geçersiz rol'; end if;
  if p_hedef <> 'rol' then p_rol := null; end if;
  if p_ver < 0 or p_ver > 15 or p_yasak < 0 or p_yasak > 15 then raise exception 'Geçersiz izin'; end if;
  p_yasak := p_yasak & ~p_ver;  -- aynı bit hem verilip hem kısılamaz: izin kazanır
  delete from public.kanal_izinleri where kanal_id = p_kanal and hedef = p_hedef and rol_id is not distinct from p_rol;
  if p_ver <> 0 or p_yasak <> 0 then
    insert into public.kanal_izinleri (kanal_id, hedef, rol_id, ver, yasak) values (p_kanal, p_hedef, p_rol, p_ver, p_yasak);
  end if;
  insert into public.denetim_kaydi (oda_id, eyleyen, eylem, hedef, ayrinti)
    select v_oda, u.id, 'kanal_izin', (select ad from public.kanallar where id = p_kanal), jsonb_build_object('hedef', p_hedef, 'rol', p_rol, 'ver', p_ver, 'yasak', p_yasak)
    from public.uyeler u where u.oda_id = v_oda and u.user_id = auth.uid() limit 1;
end $$;

revoke all on function public.uye_kanal_izni(uuid, uuid), public.kanal_izni(uuid), public.kanal_izin_ayarla(uuid, text, uuid, bigint, bigint) from public, anon;
grant execute on function public.kanal_izni(uuid), public.kanal_izin_ayarla(uuid, text, uuid, bigint, bigint) to authenticated;
grant execute on function public.uye_kanal_izni(uuid, uuid) to authenticated, service_role;

-- ===================== 031_eski_artiklari_temizle.sql =====================
-- Eski davet kodu düzeninden kalan, artık hiçbir yerde çağrılmayan işlevler (davet bağlantıları: davetler tablosu, 026).
drop function if exists public.davet_kodu_getir(uuid);
drop function if exists public.yonet_kod_yenile(uuid);
-- Kullanılmayan yönetici kodu satırları (tablo yalnızca canlıda vardır)
do $$ begin
  if to_regclass('public.yonetici_kodlari') is not null then execute 'delete from public.yonetici_kodlari'; end if;
end $$;
