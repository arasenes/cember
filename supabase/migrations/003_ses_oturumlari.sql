create table public.ses_oturumlari (
  id uuid primary key default gen_random_uuid(),
  uye_id uuid not null references public.uyeler(id) on delete cascade,
  kanal_id uuid not null references public.kanallar(id) on delete cascade,
  baslangic timestamptz not null default now(),
  son_nabiz timestamptz not null default now()
);
create index ses_oturumlari_kanal_nabiz on public.ses_oturumlari (kanal_id, son_nabiz desc);
create index ses_oturumlari_baslangic on public.ses_oturumlari (baslangic);
alter table public.ses_oturumlari enable row level security;
revoke all on public.ses_oturumlari from anon, authenticated;
create policy ses_oturumlari_kapali on public.ses_oturumlari for select to authenticated using (false);

-- Bağlı kişi 30 sn'de bir çağırır; süre bu nabızlardan hesaplanır
create function public.ses_nabiz(p_oturum uuid) returns void
language sql security definer set search_path = public as $$
  update public.ses_oturumlari o set son_nabiz = now()
  where o.id = p_oturum and public.benim_uyem(o.uye_id);
$$;
revoke all on function public.ses_nabiz(uuid) from public, anon;
grant execute on function public.ses_nabiz(uuid) to authenticated;

-- Bu ay odada kullanılan katılımcı dakikası (yalnızca oda üyeleri görür)
create function public.ses_kullanim(p_oda uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when public.uye_mi(p_oda) then
    coalesce(ceil(sum(extract(epoch from (o.son_nabiz - o.baslangic))) / 60), 0)::int
  else null end
  from public.ses_oturumlari o
  join public.kanallar k on k.id = o.kanal_id
  where k.oda_id = p_oda and o.baslangic >= date_trunc('month', now());
$$;
revoke all on function public.ses_kullanim(uuid) from public, anon;
grant execute on function public.ses_kullanim(uuid) to authenticated;
