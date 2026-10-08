-- Çember: palet kaydı (035) ve komut botu (036)

-- ===================== 035_kullanici_ayarlari.sql =====================
-- Kullanıcı başına ayarlar (şimdilik palet): cihazlar arası aynı görünüm. Yalnızca kendi satırını okur/yazar.
create table if not exists public.kullanici_ayarlari (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tema text check (tema is null or tema in ('mint-gece','mor-gece','derin-mavi','sicak-mercan','acik-tema','gul-gecesi','komur-turuncu','neon-limon','orman-altin','acik-mercan')),
  guncelleme timestamptz not null default now()
);
alter table public.kullanici_ayarlari enable row level security;
drop policy if exists kullanici_ayarlari_oku on public.kullanici_ayarlari;
create policy kullanici_ayarlari_oku on public.kullanici_ayarlari for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists kullanici_ayarlari_ekle on public.kullanici_ayarlari;
create policy kullanici_ayarlari_ekle on public.kullanici_ayarlari for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists kullanici_ayarlari_guncelle on public.kullanici_ayarlari;
create policy kullanici_ayarlari_guncelle on public.kullanici_ayarlari for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.kullanici_ayarlari from anon, public;
grant select, insert, update on public.kullanici_ayarlari to authenticated;

-- ===================== 036_cember_bot.sql =====================
-- Çember Bot: sunucu içinde çalışan komut botu. Kanala "/zar", "/yazitura", "/sec a, b, c" gibi bir mesaj yazılınca bot, o mesaja yanıt olarak cevap yazar.
-- Her sunucuda bir "Çember Bot" üyesi (bot=true, hesapsız) kendiliğinden açılır. Bot mesajlarına cevap vermez (döngü yok), kanalda çok sık cevap yazmaz.

create or replace function public.oda_botu(p_oda uuid) returns uuid
language plpgsql security definer set search_path to 'public' as
$$
declare v_id uuid;
begin
  select id into v_id from public.uyeler where oda_id = p_oda and bot and not silindi and takma_ad = 'Çember Bot' limit 1;
  if v_id is not null then return v_id; end if;
  begin
    insert into public.uyeler (oda_id, user_id, takma_ad, renk, rol, bot) values (p_oda, null, 'Çember Bot', '#ff9f1c', 'uye', true) returning id into v_id;
  exception when unique_violation then
    insert into public.uyeler (oda_id, user_id, takma_ad, renk, rol, bot) values (p_oda, null, 'Çember Bot (bot)', '#ff9f1c', 'uye', true) returning id into v_id;
  end;
  return v_id;
end $$;

create or replace function public.bot_komutu() returns trigger
language plpgsql security definer set search_path to 'public' as
$$
declare
  m text := btrim(coalesce(new.metin, ''));
  komut text; arg text; cevap text; u public.uyeler; v_oda uuid; v_bot uuid;
  n int; secenekler text[]; ad text;
  toplar text[] := array['Kesinlikle evet.', 'Bence evet.', 'Büyük ihtimalle.', 'Şu an belli değil, tekrar sor.', 'Pek sanmam.', 'Hayır.', 'Kesinlikle hayır.', 'Sonra konuşalım.'];
begin
  if left(m, 1) <> '/' or new.silindi then return new; end if;
  select * into u from public.uyeler where id = new.uye_id;
  if u.id is null or u.bot then return new; end if;
  komut := lower(split_part(m, ' ', 1));
  arg := btrim(substr(m, length(split_part(m, ' ', 1)) + 1));
  ad := u.takma_ad;

  if komut = '/yardim' then
    cevap := E'Komutlar:\n/zar [yüzey sayısı] · zar at (varsayılan 6)\n/yazitura · yazı tura at\n/sec a, b, c · birini seç\n/8top soru · sihirli 8 top\n/saat · şu an saat kaç\n/kim · şansı yaver giden kişi';
  elsif komut = '/zar' then
    n := 6;
    if arg <> '' then
      if arg !~ '^[0-9]{1,4}$' or arg::int < 2 or arg::int > 1000 then cevap := 'Zar için 2 ile 1000 arası bir sayı yaz. Örnek: /zar 20'; end if;
      if cevap is null then n := arg::int; end if;
    end if;
    if cevap is null then cevap := ad || ' zar attı: **' || (1 + floor(random() * n))::int || '** (1-' || n || ')'; end if;
  elsif komut = '/yazitura' then
    cevap := ad || ' yazı tura attı: **' || case when random() < 0.5 then 'Yazı' else 'Tura' end || '**';
  elsif komut = '/sec' then
    if position(',' in arg) > 0 then secenekler := regexp_split_to_array(arg, '\s*,\s*');
    else secenekler := regexp_split_to_array(arg, '\s+'); end if;
    secenekler := array(select btrim(x) from unnest(secenekler) x where btrim(x) <> '');
    if coalesce(array_length(secenekler, 1), 0) < 2 then cevap := 'En az iki seçenek yaz. Örnek: /sec pizza, hamburger, lahmacun';
    else cevap := 'Seçimim: **' || left(secenekler[1 + floor(random() * array_length(secenekler, 1))::int], 100) || '**'; end if;
  elsif komut = '/8top' then
    if arg = '' then cevap := 'Bir soru sor. Örnek: /8top bu akşam oyun var mı?';
    else cevap := '🎱 ' || toplar[1 + floor(random() * array_length(toplar, 1))::int]; end if;
  elsif komut = '/saat' then
    cevap := 'Saat şu an **' || to_char(now() at time zone 'Europe/Istanbul', 'HH24:MI') || '** (' || to_char(now() at time zone 'Europe/Istanbul', 'DD.MM.YYYY') || ')';
  elsif komut = '/kim' then
    select takma_ad into ad from public.uyeler where oda_id = u.oda_id and not silindi and not bot order by random() limit 1;
    cevap := 'Şansı yaver giden: **' || coalesce(ad, 'kimse') || '**';
  else
    return new;  -- bilinmeyen komut: bot susar (kullanıcı mesajı normal mesaj gibi kalır)
  end if;

  select oda_id into v_oda from public.kanallar where id = new.kanal_id;
  -- Hız sınırı: kanalda son 10 saniyede 6'dan fazla bot cevabı varsa sus
  if (select count(*) from public.mesajlar mm join public.uyeler uu on uu.id = mm.uye_id where mm.kanal_id = new.kanal_id and uu.bot and mm.olusturma > now() - interval '10 seconds') >= 6 then return new; end if;
  begin
    v_bot := public.oda_botu(v_oda);
    insert into public.mesajlar (kanal_id, uye_id, metin, yanit_id) values (new.kanal_id, v_bot, left(cevap, 1000), new.id);
  exception when others then
    null;  -- bot cevabı yazılamazsa (ör. yasaklı kelime filtresi) kullanıcının mesajı yine de kalır
  end;
  return new;
end $$;

drop trigger if exists bot_komutu_tr on public.mesajlar;
create trigger bot_komutu_tr after insert on public.mesajlar for each row execute function public.bot_komutu();

revoke all on function public.oda_botu(uuid), public.bot_komutu() from public, anon, authenticated;
