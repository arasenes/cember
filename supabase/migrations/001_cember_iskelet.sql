create extension if not exists pgcrypto;

create table public.odalar (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (char_length(ad) between 1 and 60),
  davet_kodu text not null unique,
  olusturan uuid,
  olusturma timestamptz not null default now()
);

create table public.uyeler (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.odalar(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  takma_ad text not null check (char_length(takma_ad) between 2 and 24),
  renk text not null default '#E8A33D',
  rol text not null default 'uye' check (rol in ('sahip','uye')),
  son_gorulme timestamptz not null default now(),
  olusturma timestamptz not null default now(),
  unique (oda_id, user_id)
);
create unique index uyeler_oda_takma_ad_uniq on public.uyeler (oda_id, lower(takma_ad));

create table public.kanallar (
  id uuid primary key default gen_random_uuid(),
  oda_id uuid not null references public.odalar(id) on delete cascade,
  ad text not null check (char_length(ad) between 1 and 40),
  tur text not null default 'yazili' check (tur in ('yazili','sesli')),
  sira int not null default 0
);

create table public.mesajlar (
  id uuid primary key default gen_random_uuid(),
  kanal_id uuid not null references public.kanallar(id) on delete cascade,
  uye_id uuid not null references public.uyeler(id) on delete cascade,
  metin text not null check (char_length(metin) between 1 and 4000),
  olusturma timestamptz not null default now(),
  duzenleme timestamptz,
  silindi boolean not null default false
);
create index mesajlar_kanal_zaman on public.mesajlar (kanal_id, olusturma desc);

create table public.tepkiler (
  id uuid primary key default gen_random_uuid(),
  mesaj_id uuid not null references public.mesajlar(id) on delete cascade,
  uye_id uuid not null references public.uyeler(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  unique (mesaj_id, uye_id, emoji)
);

create table public.giris_denemeleri (
  id bigserial primary key,
  ip text not null,
  zaman timestamptz not null default now()
);
create index giris_denemeleri_ip_zaman on public.giris_denemeleri (ip, zaman);

-- Yardımcı fonksiyonlar (RLS içinde özyineleme olmasın diye security definer)
create function public.uye_mi(p_oda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.uyeler where oda_id = p_oda and user_id = auth.uid());
$$;
create function public.sahip_mi(p_oda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.uyeler where oda_id = p_oda and user_id = auth.uid() and rol = 'sahip');
$$;
create function public.benim_uyem(p_uye uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.uyeler where id = p_uye and user_id = auth.uid());
$$;
create function public.kanal_odasi(p_kanal uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select oda_id from public.kanallar where id = p_kanal;
$$;
create function public.mesaj_odasi(p_mesaj uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select k.oda_id from public.mesajlar m join public.kanallar k on k.id = m.kanal_id where m.id = p_mesaj;
$$;
revoke all on function public.uye_mi(uuid), public.sahip_mi(uuid), public.benim_uyem(uuid), public.kanal_odasi(uuid), public.mesaj_odasi(uuid) from public, anon;
grant execute on function public.uye_mi(uuid), public.sahip_mi(uuid), public.benim_uyem(uuid), public.kanal_odasi(uuid), public.mesaj_odasi(uuid) to authenticated;

-- Sahip için davet kodunu getiren fonksiyon (kod sütunu diğer üyelere kapalı)
create function public.davet_kodu_getir(p_oda uuid) returns text
language sql stable security definer set search_path = public as $$
  select davet_kodu from public.odalar where id = p_oda and public.sahip_mi(p_oda);
$$;
revoke all on function public.davet_kodu_getir(uuid) from public, anon;
grant execute on function public.davet_kodu_getir(uuid) to authenticated;

-- Mesajın değişmez alanlarını koru
create function public.mesaj_degismez() returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.kanal_id <> old.kanal_id or new.uye_id <> old.uye_id or new.olusturma <> old.olusturma then
    raise exception 'Bu alanlar değiştirilemez';
  end if;
  if new.metin <> old.metin and not public.benim_uyem(old.uye_id) then
    raise exception 'Başkasının mesajı düzenlenemez';
  end if;
  if new.metin <> old.metin then new.duzenleme := now(); end if;
  return new;
end $$;
create trigger mesaj_degismez_tr before update on public.mesajlar for each row execute function public.mesaj_degismez();

-- Üye güncellemesinde yalnızca son_gorulme değişebilir
create function public.uye_degismez() returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.oda_id <> old.oda_id or new.user_id <> old.user_id
     or new.takma_ad <> old.takma_ad or new.rol <> old.rol or new.renk <> old.renk then
    raise exception 'Bu alanlar değiştirilemez';
  end if;
  return new;
end $$;
create trigger uye_degismez_tr before update on public.uyeler for each row execute function public.uye_degismez();

alter table public.odalar enable row level security;
alter table public.uyeler enable row level security;
alter table public.kanallar enable row level security;
alter table public.mesajlar enable row level security;
alter table public.tepkiler enable row level security;
alter table public.giris_denemeleri enable row level security;

-- davet_kodu sütunu istemciye kapalı
revoke all on public.odalar from anon, authenticated;
grant select (id, ad, olusturan, olusturma) on public.odalar to authenticated;
create policy odalar_oku on public.odalar for select to authenticated using (public.uye_mi(id));

revoke all on public.uyeler from anon, authenticated;
grant select on public.uyeler to authenticated;
grant update (son_gorulme) on public.uyeler to authenticated;
grant delete on public.uyeler to authenticated;
create policy uyeler_oku on public.uyeler for select to authenticated using (public.uye_mi(oda_id));
create policy uyeler_kendi_guncelle on public.uyeler for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy uyeler_sahip_at on public.uyeler for delete to authenticated using (public.sahip_mi(oda_id) and rol <> 'sahip');

revoke all on public.kanallar from anon, authenticated;
grant select on public.kanallar to authenticated;
create policy kanallar_oku on public.kanallar for select to authenticated using (public.uye_mi(oda_id));

revoke all on public.mesajlar from anon, authenticated;
grant select, insert, update on public.mesajlar to authenticated;
create policy mesajlar_oku on public.mesajlar for select to authenticated using (public.uye_mi(public.kanal_odasi(kanal_id)));
create policy mesajlar_yaz on public.mesajlar for insert to authenticated
  with check (public.benim_uyem(uye_id)
    and public.uye_mi(public.kanal_odasi(kanal_id))
    and exists (select 1 from public.kanallar k where k.id = kanal_id and k.tur = 'yazili'));
create policy mesajlar_guncelle on public.mesajlar for update to authenticated
  using (public.benim_uyem(uye_id) or public.sahip_mi(public.kanal_odasi(kanal_id)))
  with check (public.benim_uyem(uye_id) or public.sahip_mi(public.kanal_odasi(kanal_id)));

revoke all on public.tepkiler from anon, authenticated;
grant select, insert, delete on public.tepkiler to authenticated;
create policy tepkiler_oku on public.tepkiler for select to authenticated using (public.uye_mi(public.mesaj_odasi(mesaj_id)));
create policy tepkiler_ekle on public.tepkiler for insert to authenticated
  with check (public.benim_uyem(uye_id) and public.uye_mi(public.mesaj_odasi(mesaj_id)));
create policy tepkiler_sil on public.tepkiler for delete to authenticated using (public.benim_uyem(uye_id));

revoke all on public.giris_denemeleri from anon, authenticated;

-- Realtime
alter publication supabase_realtime add table public.mesajlar, public.tepkiler, public.uyeler;
alter table public.mesajlar replica identity full;
alter table public.tepkiler replica identity full;
alter table public.uyeler replica identity full;
