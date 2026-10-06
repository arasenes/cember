-- Aşama 2: mesajlara resim eki (özel depolama kovası + üyelik tabanlı erişim)

-- 1) Mesaj sütunları
alter table public.mesajlar
  add column ek_yol text,
  add column ek_tur text,
  add column ek_boyut int,
  add column ek_genislik int,
  add column ek_yukseklik int;

-- Yalnızca resim içeren mesaj metinsiz olabilir
alter table public.mesajlar drop constraint mesajlar_metin_check;
alter table public.mesajlar
  add constraint mesajlar_metin_uzunluk check (char_length(metin) <= 4000),
  add constraint mesajlar_bos_olamaz check (char_length(metin) > 0 or ek_yol is not null),
  add constraint mesajlar_ek_tutarli check (
    (ek_yol is null and ek_tur is null and ek_boyut is null and ek_genislik is null and ek_yukseklik is null)
    or (ek_yol is not null
        and ek_tur in ('image/webp', 'image/jpeg', 'image/png', 'image/gif')
        and ek_boyut between 1 and 5242880
        and ek_genislik between 1 and 10000
        and ek_yukseklik between 1 and 10000)),
  add constraint mesajlar_ek_yol_bicim check (
    ek_yol is null
    or ek_yol ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|gif)$');

-- 2) Ek alanları sonradan değiştirilemez
create or replace function public.mesaj_degismez() returns trigger language plpgsql set search_path = public as $$
begin
  if new.id <> old.id or new.kanal_id <> old.kanal_id or new.uye_id <> old.uye_id or new.olusturma <> old.olusturma then
    raise exception 'Bu alanlar değiştirilemez';
  end if;
  if new.ek_yol is distinct from old.ek_yol or new.ek_tur is distinct from old.ek_tur
     or new.ek_boyut is distinct from old.ek_boyut or new.ek_genislik is distinct from old.ek_genislik
     or new.ek_yukseklik is distinct from old.ek_yukseklik then
    raise exception 'Ek bilgileri değiştirilemez';
  end if;
  if new.metin <> old.metin and not public.benim_uyem(old.uye_id) then
    raise exception 'Başkasının mesajı düzenlenemez';
  end if;
  if new.metin <> old.metin then new.duzenleme := now(); end if;
  return new;
end $$;

-- 3) Yeni mesajın eki, yalnızca aynı odanın aynı kanalının klasörüne işaret edebilir
-- (drop policy yerine alter policy: aynı politikanın koşulu genişletilir)
alter policy mesajlar_yaz on public.mesajlar
  with check (public.benim_uyem(uye_id)
    and public.uye_mi(public.kanal_odasi(kanal_id))
    and exists (select 1 from public.kanallar k where k.id = kanal_id and k.tur = 'yazili')
    and (ek_yol is null or ek_yol like public.kanal_odasi(kanal_id)::text || '/' || kanal_id::text || '/%'));

-- 4) Depolama kovası: özel, 5 MB, yalnızca resim türleri (SVG bilerek yok)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ekler', 'ekler', false, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/gif'];

-- Yol biçimi: <oda_id>/<kanal_id>/<uuid>.<uzantı>. Geçerli biçim, kanalın o odaya ait olması ve çağıranın üyeliği aranır.
create function public.ek_yol_oda(p_yol text) returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when p_yol ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|gif)$'
         and public.kanal_odasi(split_part(p_yol, '/', 2)::uuid) = split_part(p_yol, '/', 1)::uuid
    then split_part(p_yol, '/', 1)::uuid
    else null
  end;
$$;
revoke all on function public.ek_yol_oda(text) from public, anon;
grant execute on function public.ek_yol_oda(text) to authenticated;

create policy ekler_yukle on storage.objects for insert to authenticated
  with check (bucket_id = 'ekler' and public.uye_mi(public.ek_yol_oda(name)));
create policy ekler_oku on storage.objects for select to authenticated
  using (bucket_id = 'ekler' and public.uye_mi(public.ek_yol_oda(name)));
create policy ekler_sil on storage.objects for delete to authenticated
  using (bucket_id = 'ekler'
         and (owner_id = auth.uid()::text or public.sahip_mi(public.ek_yol_oda(name))));
-- güncelleme politikası yok: yüklenen dosyanın üzerine yazılamaz
