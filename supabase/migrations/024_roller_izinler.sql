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
drop policy if exists roller_oku on public.roller;
create policy roller_oku on public.roller for select to authenticated using (uye_mi(oda_id));
drop policy if exists uye_rolleri_oku on public.uye_rolleri;
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
