-- Aşama 1: anketler (oluşturma ve oy kullanma yalnızca işlevlerle)
create table if not exists public.anketler (
  id uuid primary key default gen_random_uuid(),
  mesaj_id uuid not null unique references public.mesajlar(id) on delete cascade,
  soru text not null check (char_length(soru) between 1 and 200),
  bitis timestamptz,
  coklu boolean not null default false,
  olusturma timestamptz not null default now()
);
create table if not exists public.anket_secenekleri (
  id uuid primary key default gen_random_uuid(),
  anket_id uuid not null references public.anketler(id) on delete cascade,
  metin text not null check (char_length(metin) between 1 and 100),
  sira integer not null default 0
);
create table if not exists public.anket_oylari (
  anket_id uuid not null references public.anketler(id) on delete cascade,
  uye_id uuid not null references public.uyeler(id) on delete cascade,
  secenek_id uuid not null references public.anket_secenekleri(id) on delete cascade,
  primary key (anket_id, uye_id, secenek_id)
);
create index if not exists anket_secenekleri_anket on public.anket_secenekleri (anket_id, sira);
create index if not exists anket_oylari_secenek on public.anket_oylari (secenek_id);
alter table public.anketler enable row level security;
alter table public.anket_secenekleri enable row level security;
alter table public.anket_oylari enable row level security;

create or replace function public.anket_mesaji(p_anket uuid) returns uuid
language sql stable security definer set search_path to 'public' as
$$ select mesaj_id from public.anketler where id = p_anket; $$;

-- Mesajı görebilen anketi de görür (mesajlar_oku: üyelik + kanal erişimi)
drop policy if exists anketler_oku on public.anketler;
create policy anketler_oku on public.anketler for select to authenticated
  using (exists (select 1 from public.mesajlar m where m.id = anketler.mesaj_id));
drop policy if exists anket_secenekleri_oku on public.anket_secenekleri;
create policy anket_secenekleri_oku on public.anket_secenekleri for select to authenticated
  using (exists (select 1 from public.mesajlar m where m.id = public.anket_mesaji(anket_secenekleri.anket_id)));
drop policy if exists anket_oylari_oku on public.anket_oylari;
create policy anket_oylari_oku on public.anket_oylari for select to authenticated
  using (exists (select 1 from public.mesajlar m where m.id = public.anket_mesaji(anket_oylari.anket_id)));

create or replace function public.anket_olustur(p_kanal uuid, p_soru text, p_secenekler text[], p_sure_dk integer default null, p_coklu boolean default false)
returns uuid language plpgsql security definer set search_path to 'public' as
$$
declare v_uye uuid; v_soru text := trim(coalesce(p_soru, '')); v_secs text[]; v_mesaj uuid; v_anket uuid; i int;
begin
  select u.id into v_uye from public.uyeler u
    where u.user_id = auth.uid() and u.oda_id = public.kanal_odasi(p_kanal) and not u.silindi;
  if v_uye is null or not public.kanal_erisim(p_kanal) then raise exception 'Bu kanala yazamazsın'; end if;
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

-- p_oy=true: oy ver (tek seçimli ankette önceki oy değişir), false: oyu geri çek
create or replace function public.anket_oyla(p_secenek uuid, p_oy boolean default true) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_anket uuid; v_mesaj uuid; v_kanal uuid; v_uye uuid; v_coklu boolean; v_bitis timestamptz;
begin
  select s.anket_id, a.mesaj_id, a.coklu, a.bitis into v_anket, v_mesaj, v_coklu, v_bitis
    from public.anket_secenekleri s join public.anketler a on a.id = s.anket_id where s.id = p_secenek;
  if v_anket is null then raise exception 'Seçenek bulunamadı'; end if;
  select kanal_id into v_kanal from public.mesajlar where id = v_mesaj;
  select u.id into v_uye from public.uyeler u
    where u.user_id = auth.uid() and not u.silindi and u.oda_id = public.kanal_odasi(v_kanal);
  if v_uye is null or not public.kanal_erisim(v_kanal) then raise exception 'Bu ankete erişimin yok'; end if;
  if v_bitis is not null and v_bitis <= now() then raise exception 'Anket sona erdi'; end if;
  if p_oy then
    if not v_coklu then delete from public.anket_oylari where anket_id = v_anket and uye_id = v_uye and secenek_id <> p_secenek; end if;
    insert into public.anket_oylari (anket_id, uye_id, secenek_id) values (v_anket, v_uye, p_secenek) on conflict do nothing;
  else
    delete from public.anket_oylari where anket_id = v_anket and uye_id = v_uye and secenek_id = p_secenek;
  end if;
end $$;
