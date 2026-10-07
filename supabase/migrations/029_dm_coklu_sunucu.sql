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
