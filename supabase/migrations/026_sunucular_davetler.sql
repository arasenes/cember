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
drop policy if exists davetler_oku on public.davetler;
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
