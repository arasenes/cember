-- Aşama 1: okunmamış durumu sunucuda (cihazlar arası)
create table if not exists public.kanal_okuma (
  uye_id uuid not null references public.uyeler(id) on delete cascade,
  kanal_id uuid not null references public.kanallar(id) on delete cascade,
  son_okuma timestamptz not null default now(),
  primary key (uye_id, kanal_id)
);
alter table public.kanal_okuma enable row level security;
drop policy if exists kanal_okuma_oku on public.kanal_okuma;
create policy kanal_okuma_oku on public.kanal_okuma for select to authenticated using (benim_uyem(uye_id));

-- Yazma yalnızca bu işlevle; geriye gidemez (yalnızca ileri)
create or replace function public.okundu_isaretle(p_kanal uuid, p_zaman timestamptz default now()) returns void
language plpgsql security definer set search_path to 'public' as
$$
declare v_uye uuid;
begin
  select u.id into v_uye from public.uyeler u
    where u.user_id = auth.uid() and u.oda_id = public.kanal_odasi(p_kanal) and not u.silindi;
  if v_uye is null or not public.kanal_erisim(p_kanal) then return; end if;
  insert into public.kanal_okuma (uye_id, kanal_id, son_okuma) values (v_uye, p_kanal, least(p_zaman, now()))
  on conflict (uye_id, kanal_id) do update set son_okuma = greatest(public.kanal_okuma.son_okuma, excluded.son_okuma);
end $$;
