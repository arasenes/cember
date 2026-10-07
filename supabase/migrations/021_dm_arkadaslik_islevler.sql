-- Aşama 2: yardımcılar, politikalar, işlevler, tetikleyiciler. (020 tabloları gerekir.)

-- ===== Yardımcılar =====
create or replace function public.uye_kimligim() returns uuid
language sql stable security definer set search_path to 'public' as
$$ select id from public.uyeler where user_id = auth.uid() and not silindi order by olusturma limit 1; $$;

create or replace function public.dm_uyesi(p_dm uuid) returns boolean
language sql stable security definer set search_path to 'public' as
$$ select exists (select 1 from public.dm_uyeleri d join public.uyeler u on u.id = d.uye_id where d.dm_id = p_dm and u.user_id = auth.uid()); $$;

-- İki üye arasında (herhangi bir yönde) engel var mı?
create or replace function public.engelli_mi(p_x uuid, p_y uuid) returns boolean
language sql stable security definer set search_path to 'public' as
$$ select exists (select 1 from public.arkadasliklar where durum = 'engelli' and ((a = p_x and b = p_y) or (a = p_y and b = p_x))); $$;

-- İkili DM'de karşı taraf ile benim aramda engel var mı? (grup DM'de engel mesaj yazmayı kısıtlamaz)
create or replace function public.dm_engelli(p_dm uuid, p_uye uuid) returns boolean
language sql stable security definer set search_path to 'public' as
$$ select exists (
     select 1 from public.dm_kanallari k join public.dm_uyeleri d on d.dm_id = k.id and d.uye_id <> p_uye
     where k.id = p_dm and k.tur = 'ikili' and public.engelli_mi(p_uye, d.uye_id)); $$;

-- ===== Politikalar (yalnızca okuma; yazma işlevlerle) =====
create policy arkadasliklar_oku on public.arkadasliklar for select to authenticated
  using (benim_uyem(a) or (benim_uyem(b) and durum <> 'engelli'));
create policy dm_kanallari_oku on public.dm_kanallari for select to authenticated using (dm_uyesi(id));
create policy dm_uyeleri_oku on public.dm_uyeleri for select to authenticated using (dm_uyesi(dm_id));
create policy dm_mesajlari_oku on public.dm_mesajlari for select to authenticated using (dm_uyesi(dm_id));
create policy dm_mesajlari_yaz on public.dm_mesajlari for insert to authenticated
  with check (benim_uyem(uye_id) and dm_uyesi(dm_id) and not susturuldu_mu(uye_id) and not dm_engelli(dm_id, uye_id));
create policy dm_mesajlari_guncelle on public.dm_mesajlari for update to authenticated
  using (benim_uyem(uye_id)) with check (benim_uyem(uye_id));

-- ===== Mesaj korumaları ve bildirim =====
create or replace function public.dm_mesaj_degismez() returns trigger language plpgsql set search_path to 'public' as
$$
begin
  if new.id <> old.id or new.dm_id <> old.dm_id or new.uye_id <> old.uye_id or new.olusturma <> old.olusturma then
    raise exception 'Bu alanlar değiştirilemez';
  end if;
  if old.silindi and not new.silindi then raise exception 'Silinen mesaj geri getirilemez'; end if;
  if new.metin <> old.metin then
    if old.silindi then raise exception 'Silinen mesaj düzenlenemez'; end if;
    new.duzenleme := now();
  end if;
  return new;
end $$;
drop trigger if exists dm_mesaj_degismez_tr on public.dm_mesajlari;
create trigger dm_mesaj_degismez_tr before update on public.dm_mesajlari for each row execute function public.dm_mesaj_degismez();

create or replace function public.dm_mesaj_sonrasi() returns trigger language plpgsql security definer set search_path to 'public', 'extensions' as
$$
declare g text;
begin
  update public.dm_kanallari set son_mesaj = new.olusturma where id = new.dm_id;
  if exists (select 1 from public.push_abonelikleri) then
    select deger into g from public.push_ayar where anahtar = 'bildir_gizli';
    if g is not null then
      perform net.http_post(
        url := 'https://ehjslrbgazmakeucvquk.supabase.co/functions/v1/bildir',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-gizli', g),
        body := jsonb_build_object('dm_mesaj_id', new.id),
        timeout_milliseconds := 5000);
    end if;
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists dm_mesaj_sonrasi_tr on public.dm_mesajlari;
create trigger dm_mesaj_sonrasi_tr after insert on public.dm_mesajlari for each row execute function public.dm_mesaj_sonrasi();

-- ===== Arkadaşlık =====
create or replace function public.arkadas_istek(p_hedef uuid) returns text
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim(); h public.uyeler; mevcut public.arkadasliklar;
begin
  if ben is null then raise exception 'Üye değilsin'; end if;
  select * into h from public.uyeler where id = p_hedef and not silindi and oda_id = (select oda_id from public.uyeler where id = ben);
  if not found or h.id = ben then raise exception 'Kişi bulunamadı'; end if;
  if public.engelli_mi(ben, p_hedef) then raise exception 'Bu kişiye istek gönderemezsin'; end if;
  select * into mevcut from public.arkadasliklar where durum <> 'engelli' and least(a, b) = least(ben, p_hedef) and greatest(a, b) = greatest(ben, p_hedef);
  if found then
    if mevcut.durum = 'kabul' then return 'zaten'; end if;
    if mevcut.a = ben then return 'bekliyor'; end if;
    update public.arkadasliklar set durum = 'kabul' where id = mevcut.id;  -- karşı taraf zaten istek atmıştı
    return 'kabul';
  end if;
  if (select count(*) from public.arkadasliklar where a = ben and durum = 'bekliyor') >= 50 then raise exception 'En fazla 50 bekleyen istek olabilir'; end if;
  insert into public.arkadasliklar (a, b, durum) values (ben, p_hedef, 'bekliyor');
  return 'bekliyor';
end $$;

create or replace function public.arkadas_yanit(p_id uuid, p_kabul boolean) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim();
begin
  if p_kabul then
    update public.arkadasliklar set durum = 'kabul' where id = p_id and b = ben and durum = 'bekliyor';
  else
    delete from public.arkadasliklar where id = p_id and b = ben and durum = 'bekliyor';
  end if;
end $$;

-- Gönderilen isteği geri al ya da arkadaşlıktan çıkar
create or replace function public.arkadas_sil(p_hedef uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim();
begin
  delete from public.arkadasliklar where durum <> 'engelli' and ((a = ben and b = p_hedef) or (a = p_hedef and b = ben));
end $$;

create or replace function public.engelle(p_hedef uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim();
begin
  if ben is null or ben = p_hedef or not exists (select 1 from public.uyeler where id = p_hedef) then raise exception 'Kişi bulunamadı'; end if;
  delete from public.arkadasliklar where durum <> 'engelli' and ((a = ben and b = p_hedef) or (a = p_hedef and b = ben));
  insert into public.arkadasliklar (a, b, durum) values (ben, p_hedef, 'engelli') on conflict (a, b) do nothing;
end $$;

create or replace function public.engel_kaldir(p_hedef uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim();
begin
  delete from public.arkadasliklar where a = ben and b = p_hedef and durum = 'engelli';
end $$;

-- ===== DM =====
create or replace function public.dm_ac(p_hedef uuid) returns uuid
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim(); anahtar text; v_id uuid;
begin
  if ben is null then raise exception 'Üye değilsin'; end if;
  if p_hedef = ben or not exists (select 1 from public.uyeler h where h.id = p_hedef and not h.silindi and h.oda_id = (select oda_id from public.uyeler where id = ben)) then
    raise exception 'Kişi bulunamadı';
  end if;
  if public.engelli_mi(ben, p_hedef) then raise exception 'Bu kişiye mesaj gönderemezsin'; end if;
  anahtar := least(ben, p_hedef)::text || '-' || greatest(ben, p_hedef)::text;
  select id into v_id from public.dm_kanallari where ikili_anahtar = anahtar;
  if v_id is not null then return v_id; end if;
  insert into public.dm_kanallari (tur, olusturan, ikili_anahtar) values ('ikili', ben, anahtar)
    on conflict (ikili_anahtar) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.dm_kanallari where ikili_anahtar = anahtar; return v_id; end if;
  insert into public.dm_uyeleri (dm_id, uye_id) values (v_id, ben), (v_id, p_hedef);
  return v_id;
end $$;

create or replace function public.dm_grup_olustur(p_ad text, p_uyeler uuid[]) returns uuid
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim(); v_ad text := nullif(trim(coalesce(p_ad, '')), ''); digerleri uuid[]; v_id uuid; u uuid;
begin
  if ben is null then raise exception 'Üye değilsin'; end if;
  select array_agg(distinct x) into digerleri from unnest(coalesce(p_uyeler, '{}')) x where x <> ben;
  if coalesce(array_length(digerleri, 1), 0) < 2 or array_length(digerleri, 1) > 9 then raise exception 'Grup DM için 2-9 kişi seç (en fazla 10 kişi)'; end if;
  if v_ad is not null and char_length(v_ad) > 40 then raise exception 'Grup adı en fazla 40 karakter olabilir'; end if;
  foreach u in array digerleri loop
    if not exists (select 1 from public.uyeler h where h.id = u and not h.silindi and h.oda_id = (select oda_id from public.uyeler where id = ben)) then raise exception 'Kişi bulunamadı'; end if;
    if public.engelli_mi(ben, u) then raise exception 'Engelli bir kişiyi gruba ekleyemezsin'; end if;
  end loop;
  insert into public.dm_kanallari (tur, ad, olusturan) values ('grup', v_ad, ben) returning id into v_id;
  insert into public.dm_uyeleri (dm_id, uye_id) select v_id, x from unnest(digerleri || ben) x;
  return v_id;
end $$;

create or replace function public.dm_grup_uye_ekle(p_dm uuid, p_uye uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare ben uuid := public.uye_kimligim();
begin
  if not exists (select 1 from public.dm_kanallari where id = p_dm and tur = 'grup' and olusturan = ben) then raise exception 'Yalnızca grubu kuran kişi ekleyebilir'; end if;
  if (select count(*) from public.dm_uyeleri where dm_id = p_dm) >= 10 then raise exception 'Grup en fazla 10 kişi olabilir'; end if;
  if public.engelli_mi(ben, p_uye) or not exists (select 1 from public.uyeler h where h.id = p_uye and not h.silindi and h.oda_id = (select oda_id from public.uyeler where id = ben)) then
    raise exception 'Bu kişi eklenemez';
  end if;
  insert into public.dm_uyeleri (dm_id, uye_id) values (p_dm, p_uye) on conflict do nothing;
end $$;

-- Gruptan ayrılma: işlev yerine kendi üyeliğini silme politikası (yalnızca grup DM'de)
create or replace function public.dm_grup_mu(p_dm uuid) returns boolean
language sql stable security definer set search_path to 'public' as
$$ select exists (select 1 from public.dm_kanallari where id = p_dm and tur = 'grup'); $$;
revoke execute on function public.dm_grup_mu(uuid) from public, anon;
grant execute on function public.dm_grup_mu(uuid) to authenticated;
create policy dm_uyeleri_ayril on public.dm_uyeleri for delete to authenticated using (benim_uyem(uye_id) and dm_grup_mu(dm_id));

create or replace function public.dm_okundu(p_dm uuid) returns void
language plpgsql security definer set search_path to 'public' as
$$
begin
  update public.dm_uyeleri set son_okuma = now() where dm_id = p_dm and uye_id = public.uye_kimligim();
end $$;

create or replace function public.dm_okunmamis() returns table (dm_id uuid, n integer)
language sql stable security definer set search_path to 'public' as
$$
  select d.dm_id, count(m.id)::int
  from public.dm_uyeleri d
  join public.dm_mesajlari m on m.dm_id = d.dm_id and m.olusturma > d.son_okuma and m.uye_id <> d.uye_id and not m.silindi
  where d.uye_id = public.uye_kimligim()
  group by d.dm_id;
$$;

-- ===== Yetkiler: yazma işlevleri yalnızca giriş yapmış kullanıcıya =====
revoke execute on function public.uye_kimligim(), public.dm_uyesi(uuid), public.engelli_mi(uuid, uuid), public.dm_engelli(uuid, uuid),
  public.arkadas_istek(uuid), public.arkadas_yanit(uuid, boolean), public.arkadas_sil(uuid), public.engelle(uuid), public.engel_kaldir(uuid),
  public.dm_ac(uuid), public.dm_grup_olustur(text, uuid[]), public.dm_grup_uye_ekle(uuid, uuid), public.dm_okundu(uuid),
  public.dm_okunmamis(), public.dm_mesaj_sonrasi(), public.dm_mesaj_degismez() from public, anon;
grant execute on function public.uye_kimligim(), public.dm_uyesi(uuid), public.engelli_mi(uuid, uuid), public.dm_engelli(uuid, uuid),
  public.arkadas_istek(uuid), public.arkadas_yanit(uuid, boolean), public.arkadas_sil(uuid), public.engelle(uuid), public.engel_kaldir(uuid),
  public.dm_ac(uuid), public.dm_grup_olustur(text, uuid[]), public.dm_grup_uye_ekle(uuid, uuid), public.dm_okundu(uuid),
  public.dm_okunmamis() to authenticated;

-- Not: canlıya parça parça uygulandı (021a-f); engelle() içinde silme için arkadas_sil çağrılır.
-- ===== Gerçek zamanlı =====
alter publication supabase_realtime add table public.dm_mesajlari, public.dm_uyeleri, public.dm_kanallari, public.arkadasliklar;
