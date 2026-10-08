-- Hesap bazlı dil tercihi (kullanici_ayarlari, 035): cihazlar arası aynı dil.
alter table public.kullanici_ayarlari add column if not exists dil text check (dil is null or dil in ('tr','en','de','ar','ru','az','fr','es'));
