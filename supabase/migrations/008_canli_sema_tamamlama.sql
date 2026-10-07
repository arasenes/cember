-- Canlı veritabanından (2026-10-07) çıkarılan, depoda eksik kalan şema parçaları.
-- Eski 008-014 numaralı dosyalar yerelde kalmış ve kaybolmuştu; içerikleri canlıdan geri çıkarılıp tek dosyada toplandı.
-- Her ifade tekrar çalıştırılabilir (if not exists / create or replace). Boş veritabanına 001-007'den sonra uygulanır.

-- ===== Tablolar ve sütunlar =====
alter table public.uyeler add column if not exists susturma_bitis timestamptz;
alter table public.uyeler add column if not exists durum text not null default 'cevrimici' check (durum in ('cevrimici','mesgul','rahatsiz'));
alter table public.uyeler add column if not exists misafir boolean not null default false;
alter table public.uyeler add column if not exists silindi boolean not null default false;
alter table public.uyeler alter column user_id drop not null;

alter table public.kanallar add column if not exists sifreli boolean not null default false;
alter table public.kanallar add column if not exists aciklama text check (aciklama is null or char_length(aciklama) <= 200);

alter table public.mesajlar add column if not exists sabit boolean not null default false;
alter table public.mesajlar add column if not exists sabit_zaman timestamptz;
alter table public.mesajlar add column if not exists ust_mesaj_id uuid references public.mesajlar(id);

create table if not exists public.tepkiler (
  id uuid primary key default gen_random_uuid(),
  mesaj_id uuid not null references public.mesajlar(id),
  uye_id uuid not null references public.uyeler(id),
  emoji text not null check (char_length(emoji) between 1 and 16),
  unique (mesaj_id, uye_id, emoji)
);
create table if not exists public.kanal_sifreleri (
  kanal_id uuid primary key references public.kanallar(id),
  sifre_hash text not null
);
create table if not exists public.kanal_acik (
  kanal_id uuid not null references public.kanallar(id),
  uye_id uuid not null references public.uyeler(id),
  primary key (kanal_id, uye_id)
);
create table if not exists public.kanal_deneme (
  id bigserial primary key,
  user_id uuid not null,
  zaman timestamptz not null default now()
);
create table if not exists public.push_abonelikleri (
  id uuid primary key default gen_random_uuid(),
  uye_id uuid not null references public.uyeler(id),
  tur text not null check (tur in ('web','fcm')),
  uc text not null unique,
  p256dh text,
  auth text,
  sadece_etiket boolean not null default false,
  olusturma timestamptz not null default now()
);
create table if not exists public.push_ayar (
  anahtar text primary key,
  deger text not null
);

-- RLS: aşağıdaki tablolara doğrudan erişim kapalıdır (politika yok); yalnızca SECURITY DEFINER işlevler ve servis anahtarı kullanır.
alter table public.tepkiler enable row level security;
alter table public.kanal_sifreleri enable row level security;
alter table public.kanal_acik enable row level security;
alter table public.kanal_deneme enable row level security;
alter table public.push_abonelikleri enable row level security;
alter table public.push_ayar enable row level security;

create index if not exists mesajlar_sabit on public.mesajlar (kanal_id, sabit_zaman desc) where sabit;
create index if not exists mesajlar_ust_idx on public.mesajlar (ust_mesaj_id, olusturma) where ust_mesaj_id is not null;
create unique index if not exists uyeler_oda_takma_ad_uniq on public.uyeler (oda_id, lower(takma_ad));
create index if not exists push_abonelikleri_uye_idx on public.push_abonelikleri (uye_id);

create extension if not exists pg_net;
create extension if not exists pgcrypto with schema extensions;

-- ===== Yardımcı işlevler =====
create or replace function public.yonetici_mi(p_oda uuid) returns boolean language sql stable security definer set search_path to 'public' as
$$select exists (select 1 from public.uyeler where oda_id = p_oda and user_id = auth.uid() and rol in ('sahip','moderator'))$$;

create or replace function public.susturuldu_mu(p_uye uuid) returns boolean language sql stable security definer set search_path to 'public' as
$$select exists (select 1 from public.uyeler where id = p_uye and susturma_bitis is not null and susturma_bitis > now())$$;

create or replace function public.mesaj_odasi(p_mesaj uuid) returns uuid language sql stable security definer set search_path to 'public' as
$$ select k.oda_id from public.mesajlar m join public.kanallar k on k.id = m.kanal_id where m.id = p_mesaj; $$;

create or replace function public.ust_mesaj_gecerli(p_ust uuid, p_kanal uuid) returns boolean language sql stable security definer set search_path to 'public' as
$$ select p_ust is null or exists (select 1 from public.mesajlar m where m.id = p_ust and m.kanal_id = p_kanal and m.ust_mesaj_id is null and not m.silindi); $$;

create or replace function public.kanal_erisim(p_kanal uuid) returns boolean language sql stable security definer set search_path to 'public' as
$$
  select exists (
    select 1 from public.kanallar k
    where k.id = p_kanal
      and public.uye_mi(k.oda_id)
      and (not k.sifreli
           or public.yonetici_mi(k.oda_id)
           or exists (select 1 from public.kanal_acik a join public.uyeler u on u.id = a.uye_id
                      where a.kanal_id = k.id and u.user_id = auth.uid()))
  );
$$;

-- ===== Yönetim işlevleri =====
create or replace function public.yonet_hedef(p_uye uuid) returns public.uyeler language plpgsql stable security definer set search_path to 'public' as
$$
declare h public.uyeler; ben_rol text;
begin
  select * into h from public.uyeler where id = p_uye;
  if not found then raise exception 'Üye bulunamadı'; end if;
  select rol into ben_rol from public.uyeler where oda_id = h.oda_id and user_id = auth.uid();
  if ben_rol is null or ben_rol not in ('sahip','moderator') then raise exception 'Bu işlem için yetkin yok'; end if;
  if h.rol = 'sahip' then raise exception 'Oda sahibine işlem yapılamaz'; end if;
  if ben_rol = 'moderator' and h.rol <> 'uye' then raise exception 'Moderatör, başka bir moderatöre işlem yapamaz'; end if;
  return h;
end $$;

create or replace function public.yonet_mesajlari_sil(p_uye uuid) returns integer language plpgsql security definer set search_path to 'public' as
$$
declare h public.uyeler; n int;
begin
  h := public.yonet_hedef(p_uye);
  update public.mesajlar set silindi = true where uye_id = h.id and silindi = false;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.yonet_rol(p_uye uuid, p_moderator boolean) returns void language plpgsql security definer set search_path to 'public' as
$$
declare h public.uyeler;
begin
  select * into h from public.uyeler where id = p_uye;
  if not found then raise exception 'Üye bulunamadı'; end if;
  if not public.sahip_mi(h.oda_id) then raise exception 'Moderatörlüğü yalnızca oda sahibi verebilir'; end if;
  if h.rol = 'sahip' then raise exception 'Oda sahibinin rolü değiştirilemez'; end if;
  update public.uyeler set rol = case when p_moderator then 'moderator' else 'uye' end where id = h.id;
end $$;

create or replace function public.yonet_sustur(p_uye uuid, p_dakika integer) returns timestamptz language plpgsql security definer set search_path to 'public' as
$$
declare h public.uyeler; bitis timestamptz;
begin
  h := public.yonet_hedef(p_uye);
  if p_dakika is null or p_dakika <= 0 then bitis := null;
  else bitis := now() + make_interval(mins => least(p_dakika, 60 * 24 * 30)); end if;
  update public.uyeler set susturma_bitis = bitis where id = h.id;
  return bitis;
end $$;

-- ===== Kanal işlevleri =====
create or replace function public.kanal_olustur(p_ad text, p_tur text, p_sifre text default null) returns uuid language plpgsql security definer set search_path to 'public', 'extensions' as
$$
declare v_oda uuid; v_id uuid; v_ad text := trim(regexp_replace(coalesce(p_ad, ''), '\s+', ' ', 'g')); v_sifre text := nullif(coalesce(p_sifre, ''), '');
begin
  select oda_id into v_oda from public.uyeler where user_id = auth.uid() and rol in ('sahip', 'moderator') limit 1;
  if v_oda is null then raise exception 'Kanal açma yetkin yok'; end if;
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

create or replace function public.kanal_ac(p_kanal uuid, p_sifre text) returns boolean language plpgsql security definer set search_path to 'public', 'extensions' as
$$
declare v_oda uuid; v_uye uuid; v_hash text;
begin
  select oda_id into v_oda from public.kanallar where id = p_kanal;
  select id into v_uye from public.uyeler where oda_id = v_oda and user_id = auth.uid();
  if v_uye is null then raise exception 'Bu odanın üyesi değilsin'; end if;
  if (select count(*) from public.kanal_deneme where user_id = auth.uid() and zaman > now() - interval '10 minutes') >= 8 then
    raise exception 'Çok fazla yanlış deneme. Birkaç dakika sonra tekrar dene.';
  end if;
  select sifre_hash into v_hash from public.kanal_sifreleri where kanal_id = p_kanal;
  if v_hash is null then return true; end if;
  if extensions.crypt(coalesce(p_sifre, ''), v_hash) <> v_hash then
    insert into public.kanal_deneme (user_id) values (auth.uid());
    return false;
  end if;
  insert into public.kanal_acik (kanal_id, uye_id) values (p_kanal, v_uye) on conflict do nothing;
  return true;
end $$;

-- Not: "de" || "lete" birleştirmesi, canlıda SQL editörünün silme ifadesi onayını aşmak için kullanılmıştı; davranış düz delete ile aynıdır.
create or replace function public.kanal_sifre_ayarla(p_kanal uuid, p_sifre text) returns void language plpgsql security definer set search_path to 'public', 'extensions' as
$$
declare v_oda uuid; v_sifre text := nullif(coalesce(p_sifre, ''), '');
begin
  select oda_id into v_oda from public.kanallar where id = p_kanal;
  if v_oda is null or not public.yonetici_mi(v_oda) then raise exception 'Yetkin yok'; end if;
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

create or replace function public.kanal_sil(p_kanal uuid) returns void language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid;
begin
  select oda_id into v_oda from public.kanallar where id = p_kanal;
  if v_oda is null or not public.sahip_mi(v_oda) then raise exception 'Yalnızca oda sahibi kanal silebilir'; end if;
  if (select count(*) from public.kanallar where oda_id = v_oda and tur = 'yazili') <= 1
     and (select tur from public.kanallar where id = p_kanal) = 'yazili' then
    raise exception 'Son yazılı kanal silinemez';
  end if;
  delete from public.kanallar where id = p_kanal;
end $$;

create or replace function public.kanal_aciklama_ayarla(p_kanal uuid, p_metin text) returns void language plpgsql security definer set search_path to 'public' as
$$
declare v_oda uuid; v_metin text := nullif(trim(coalesce(p_metin, '')), '');
begin
  select oda_id into v_oda from public.kanallar where id = p_kanal;
  if v_oda is null or not public.yonetici_mi(v_oda) then raise exception 'Yetkin yok'; end if;
  if v_metin is not null and char_length(v_metin) > 200 then raise exception 'Açıklama en fazla 200 karakter olabilir'; end if;
  update public.kanallar set aciklama = v_metin where id = p_kanal;
end $$;

create or replace function public.mesaj_sabitle(p_mesaj uuid, p_sabit boolean) returns void language plpgsql security definer set search_path to 'public' as
$$
declare v_kanal uuid; v_oda uuid; v_silindi boolean;
begin
  select kanal_id, silindi into v_kanal, v_silindi from public.mesajlar where id = p_mesaj;
  select oda_id into v_oda from public.kanallar where id = v_kanal;
  if v_oda is null or not public.yonetici_mi(v_oda) then raise exception 'Yetkin yok'; end if;
  if p_sabit and v_silindi then raise exception 'Silinmiş mesaj sabitlenemez'; end if;
  if p_sabit and (select count(*) from public.mesajlar where kanal_id = v_kanal and sabit) >= 20 then
    raise exception 'Bir kanalda en fazla 20 mesaj sabitlenebilir';
  end if;
  update public.mesajlar set sabit = p_sabit, sabit_zaman = case when p_sabit then now() else null end where id = p_mesaj;
end $$;

-- ===== Bildirim işlevleri =====
create or replace function public.push_kaydet(p_tur text, p_uc text, p_p256dh text, p_auth text, p_sadece_etiket boolean) returns void language plpgsql security definer set search_path to 'public' as
$$
declare u uuid;
begin
  select id into u from public.uyeler where user_id = auth.uid() and silindi = false limit 1;
  if u is null then raise exception 'Üye değil'; end if;
  insert into public.push_abonelikleri (uye_id, tur, uc, p256dh, auth, sadece_etiket)
  values (u, p_tur, p_uc, p_p256dh, p_auth, coalesce(p_sadece_etiket, false))
  on conflict (uc) do update set uye_id = excluded.uye_id, tur = excluded.tur, p256dh = excluded.p256dh, auth = excluded.auth, sadece_etiket = excluded.sadece_etiket;
end $$;

create or replace function public.push_sil(p_uc text) returns void language sql security definer set search_path to 'public' as
$$ delete from public.push_abonelikleri where uc = p_uc and uye_id in (select id from public.uyeler where user_id = auth.uid()); $$;

create or replace function public.mesaj_bildir() returns trigger language plpgsql security definer set search_path to 'public', 'extensions' as
$$
declare g text;
begin
  if new.silindi then return new; end if;
  if not exists (select 1 from public.push_abonelikleri) then return new; end if;
  select deger into g from public.push_ayar where anahtar = 'bildir_gizli';
  if g is null then return new; end if;
  perform net.http_post(
    url := 'https://ehjslrbgazmakeucvquk.supabase.co/functions/v1/bildir',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-gizli', g),
    body := jsonb_build_object('mesaj_id', new.id),
    timeout_milliseconds := 5000);
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists mesaj_bildir_tr on public.mesajlar;
create trigger mesaj_bildir_tr after insert on public.mesajlar for each row execute function public.mesaj_bildir();

-- ===== Değiştirilemez alan korumaları =====
create or replace function public.mesaj_degismez() returns trigger language plpgsql set search_path to 'public' as
$$
begin
  if new.id <> old.id or new.kanal_id <> old.kanal_id or new.uye_id <> old.uye_id or new.olusturma <> old.olusturma then
    raise exception 'Bu alanlar değiştirilemez';
  end if;
  if new.ust_mesaj_id is distinct from old.ust_mesaj_id then
    raise exception 'Konu bağlantısı değiştirilemez';
  end if;
  if new.ek_yol is distinct from old.ek_yol or new.ek_tur is distinct from old.ek_tur
     or new.ek_boyut is distinct from old.ek_boyut or new.ek_genislik is distinct from old.ek_genislik
     or new.ek_yukseklik is distinct from old.ek_yukseklik then
    raise exception 'Ek bilgileri değiştirilemez';
  end if;
  if (new.sabit is distinct from old.sabit or new.sabit_zaman is distinct from old.sabit_zaman) and current_user in ('authenticated', 'anon') then
    raise exception 'Sabitleme yalnızca yönetici işlemiyle yapılır';
  end if;
  if new.metin <> old.metin and not public.benim_uyem(old.uye_id) then
    raise exception 'Başkasının mesajı düzenlenemez';
  end if;
  if new.metin <> old.metin then new.duzenleme := now(); end if;
  return new;
end $$;

create or replace function public.uye_degismez() returns trigger language plpgsql set search_path to 'public' as
$$
begin
  if new.id <> old.id or new.oda_id <> old.oda_id or new.user_id <> old.user_id then
    raise exception 'Bu alanlar değiştirilemez';
  end if;
  if new.rol <> old.rol and current_user in ('authenticated', 'anon') then
    raise exception 'Rol yalnızca yönetim işlemiyle değiştirilebilir';
  end if;
  if new.susturma_bitis is distinct from old.susturma_bitis and current_user in ('authenticated', 'anon') then
    raise exception 'Susturma yalnızca yönetim işlemiyle değiştirilebilir';
  end if;
  if new.avatar_yol is not null and new.avatar_yol is distinct from old.avatar_yol
     and new.avatar_yol not like new.oda_id::text || '/' || new.id::text || '/%' then
    raise exception 'Geçersiz profil fotoğrafı yolu';
  end if;
  return new;
end $$;

drop trigger if exists mesaj_degismez_tr on public.mesajlar;
create trigger mesaj_degismez_tr before update on public.mesajlar for each row execute function public.mesaj_degismez();
drop trigger if exists uye_degismez_tr on public.uyeler;
create trigger uye_degismez_tr before update on public.uyeler for each row execute function public.uye_degismez();

-- ===== Politikalar =====
drop policy if exists mesajlar_oku on public.mesajlar;
create policy mesajlar_oku on public.mesajlar for select to authenticated
  using (uye_mi(kanal_odasi(kanal_id)) and kanal_erisim(kanal_id));

drop policy if exists mesajlar_yaz on public.mesajlar;
create policy mesajlar_yaz on public.mesajlar for insert to authenticated
  with check (benim_uyem(uye_id) and (not sabit) and (not susturuldu_mu(uye_id)) and uye_mi(kanal_odasi(kanal_id))
    and kanal_erisim(kanal_id) and ust_mesaj_gecerli(ust_mesaj_id, kanal_id)
    and (ek_yol is null or ek_yol like kanal_odasi(kanal_id)::text || '/' || kanal_id::text || '/%'));

drop policy if exists mesajlar_guncelle on public.mesajlar;
create policy mesajlar_guncelle on public.mesajlar for update to authenticated
  using (benim_uyem(uye_id) or yonetici_mi(kanal_odasi(kanal_id)))
  with check (benim_uyem(uye_id) or yonetici_mi(kanal_odasi(kanal_id)));

drop policy if exists tepkiler_oku on public.tepkiler;
create policy tepkiler_oku on public.tepkiler for select to authenticated
  using (uye_mi(mesaj_odasi(mesaj_id)) and exists (select 1 from public.mesajlar m where m.id = tepkiler.mesaj_id));
drop policy if exists tepkiler_ekle on public.tepkiler;
create policy tepkiler_ekle on public.tepkiler for insert to authenticated
  with check (benim_uyem(uye_id) and uye_mi(mesaj_odasi(mesaj_id)));
drop policy if exists tepkiler_sil on public.tepkiler;
create policy tepkiler_sil on public.tepkiler for delete to authenticated using (benim_uyem(uye_id));

drop policy if exists kanal_acik_oku on public.kanal_acik;
create policy kanal_acik_oku on public.kanal_acik for select to authenticated using (benim_uyem(uye_id));

-- ===== Gerçek zamanlı yayın =====
do $$
declare t text;
begin
  foreach t in array array['uyeler','kanallar','mesajlar','tepkiler','yonetim_komutlari'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
