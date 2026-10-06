-- Yönetim paneli: oda sahibi (ve moderatör) üyeyi atabilir, susturabilir, sesli odadan atıp taşıyabilir;
-- yalnızca sahip banlayabilir, moderatör atayabilir. Atma/ban/yasak kaldırma işlemleri `yonet` Edge Function'ında yapılır
-- (auth kullanıcısı silmek yönetici API'si ister).

-- 0) Roller: sahip | moderator | uye
alter table public.uyeler drop constraint if exists uyeler_rol_check;
alter table public.uyeler add constraint uyeler_rol_check check (rol in ('sahip', 'moderator', 'uye'));

create or replace function public.yonetici_mi(p_oda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.uyeler where oda_id = p_oda and user_id = auth.uid() and rol in ('sahip','moderator'))
$$;
revoke all on function public.yonetici_mi(uuid) from public, anon;
grant execute on function public.yonetici_mi(uuid) to authenticated;

-- Rol ve susturma yalnızca güvenli (security definer) işlemlerle değişir
create or replace function public.uye_degismez() returns trigger
language plpgsql set search_path = public as $$
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

-- Yönetici başkasının mesajını da silebilir (silindi=true)
alter policy mesajlar_guncelle on public.mesajlar
  using (public.benim_uyem(uye_id) or public.yonetici_mi(public.kanal_odasi(kanal_id)))
  with check (public.benim_uyem(uye_id) or public.yonetici_mi(public.kanal_odasi(kanal_id)));

-- 1) Susturma: bitiş zamanı dolana kadar üye mesaj yazamaz
alter table public.uyeler add column susturma_bitis timestamptz;

create function public.susturuldu_mu(p_uye uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.uyeler where id = p_uye and susturma_bitis is not null and susturma_bitis > now());
$$;
revoke all on function public.susturuldu_mu(uuid) from public, anon;
grant execute on function public.susturuldu_mu(uuid) to authenticated;

alter policy mesajlar_yaz on public.mesajlar
  with check (public.benim_uyem(uye_id)
    and not public.susturuldu_mu(uye_id)
    and public.uye_mi(public.kanal_odasi(kanal_id))
    and exists (select 1 from public.kanallar k where k.id = kanal_id and k.tur = 'yazili'));

-- 2) Katılım IP'si (yalnızca sunucu görür) ve yasak listesi
create table public.uye_ip (
  uye_id uuid primary key references public.uyeler(id) on delete cascade,
  ip text not null
);
alter table public.uye_ip enable row level security;
revoke all on public.uye_ip from anon, authenticated;

create table public.yasaklar (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.odalar(id) on delete cascade,
  takma_ad text not null,
  ip text,
  sebep text check (sebep is null or char_length(sebep) <= 100),
  olusturma timestamptz not null default now()
);
create unique index yasaklar_oda_takma_ad_uniq on public.yasaklar (oda_id, lower(takma_ad));
alter table public.yasaklar enable row level security;
revoke all on public.yasaklar from anon, authenticated;
grant select (id, oda_id, takma_ad, sebep, olusturma) on public.yasaklar to authenticated;
create policy yasaklar_sahip_oku on public.yasaklar for select to authenticated using (public.sahip_mi(oda_id));

-- 3) Sesli oda komutları (sunucu yazar, yalnızca hedef üye okur; Realtime ile iletilir)
create table public.yonetim_komutlari (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.odalar(id) on delete cascade,
  hedef_uye uuid not null references public.uyeler(id) on delete cascade,
  tur text not null check (tur in ('ses-at', 'tasi')),
  kanal_id uuid references public.kanallar(id) on delete cascade,
  olusturma timestamptz not null default now()
);
alter table public.yonetim_komutlari enable row level security;
revoke all on public.yonetim_komutlari from anon, authenticated;
grant select on public.yonetim_komutlari to authenticated;
create policy komut_hedef_oku on public.yonetim_komutlari for select to authenticated using (public.benim_uyem(hedef_uye));
alter publication supabase_realtime add table public.yonetim_komutlari;

-- 4) Yönetim işlemleri
create function public.yonet_hedef(p_uye uuid) returns public.uyeler
language plpgsql stable security definer set search_path = public as $$
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

create function public.yonet_sustur(p_uye uuid, p_dakika int) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare h public.uyeler; bitis timestamptz;
begin
  h := public.yonet_hedef(p_uye);
  if p_dakika is null or p_dakika <= 0 then bitis := null;
  else bitis := now() + make_interval(mins => least(p_dakika, 60 * 24 * 30)); end if;
  update public.uyeler set susturma_bitis = bitis where id = h.id;
  return bitis;
end $$;

create function public.yonet_mesajlari_sil(p_uye uuid) returns int
language plpgsql security definer set search_path = public as $$
declare h public.uyeler; n int;
begin
  h := public.yonet_hedef(p_uye);
  update public.mesajlar set silindi = true where uye_id = h.id and silindi = false;
  get diagnostics n = row_count;
  return n;
end $$;

create function public.yonet_rol(p_uye uuid, p_moderator boolean) returns void
language plpgsql security definer set search_path = public as $$
declare h public.uyeler;
begin
  select * into h from public.uyeler where id = p_uye;
  if not found then raise exception 'Üye bulunamadı'; end if;
  if not public.sahip_mi(h.oda_id) then raise exception 'Moderatörlüğü yalnızca oda sahibi verebilir'; end if;
  if h.rol = 'sahip' then raise exception 'Oda sahibinin rolü değiştirilemez'; end if;
  update public.uyeler set rol = case when p_moderator then 'moderator' else 'uye' end where id = h.id;
end $$;

create function public.yonet_kod_yenile(p_oda uuid) returns text
language plpgsql security definer set search_path = public as $$
declare yeni text;
begin
  if not public.sahip_mi(p_oda) then raise exception 'Bu işlem için yetkin yok'; end if;
  yeni := upper(replace(gen_random_uuid()::text, '-', ''));
  yeni := substr(yeni, 1, 6) || '-' || substr(yeni, 7, 6);
  update public.odalar set davet_kodu = yeni where id = p_oda;
  return yeni;
end $$;

revoke all on function public.yonet_hedef(uuid), public.yonet_sustur(uuid, int), public.yonet_mesajlari_sil(uuid),
  public.yonet_rol(uuid, boolean), public.yonet_kod_yenile(uuid) from public, anon;
grant execute on function public.yonet_sustur(uuid, int), public.yonet_mesajlari_sil(uuid),
  public.yonet_rol(uuid, boolean), public.yonet_kod_yenile(uuid) to authenticated;
