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
drop policy if exists webhooklar_oku on public.webhooklar;
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
