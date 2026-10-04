alter function public.mesaj_degismez() set search_path = public;
alter function public.uye_degismez() set search_path = public;
create policy giris_denemeleri_kimse on public.giris_denemeleri for select to authenticated using (false);
