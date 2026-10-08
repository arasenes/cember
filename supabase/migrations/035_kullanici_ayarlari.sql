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
