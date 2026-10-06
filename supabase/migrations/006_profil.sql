-- Profil düzenleme: profil fotoğrafı, "hakkımda" metni, takma ad ve renk değiştirme

-- 1) Sütunlar ve kısıtlar
alter table public.uyeler
  add column avatar_yol text,
  add column hakkinda text;

alter table public.uyeler
  add constraint uyeler_avatar_yol_bicim check (
    avatar_yol is null
    or avatar_yol ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'),
  add constraint uyeler_hakkinda_uzunluk check (hakkinda is null or char_length(hakkinda) <= 120),
  add constraint uyeler_renk_bicim check (renk ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint uyeler_takma_ad_temiz check (takma_ad = btrim(takma_ad) and takma_ad !~ '[[:cntrl:]]');

-- 2) Üye kendi satırında yalnızca bu alanları değiştirebilir (kimlik, oda ve rol sabit)
grant update (takma_ad, renk, avatar_yol, hakkinda) on public.uyeler to authenticated;

create or replace function public.uye_degismez() returns trigger language plpgsql set search_path = public as $$
begin
  if new.id <> old.id or new.oda_id <> old.oda_id or new.user_id <> old.user_id or new.rol <> old.rol then
    raise exception 'Bu alanlar değiştirilemez';
  end if;
  if new.avatar_yol is not null and new.avatar_yol is distinct from old.avatar_yol
     and new.avatar_yol not like new.oda_id::text || '/' || new.id::text || '/%' then
    raise exception 'Geçersiz profil fotoğrafı yolu';
  end if;
  return new;
end $$;

-- 3) Profil fotoğrafı kovası: özel, 1 MB, yalnızca WebP/JPEG. Yol: <oda_id>/<uye_id>/<uuid>.<webp|jpg>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatarlar', 'avatarlar', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/webp', 'image/jpeg'];

-- Yol biçimi geçerliyse ve o üye gerçekten o odadaysa üye kimliğini / oda kimliğini döndürür
create function public.avatar_yol_uye(p_yol text) returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when p_yol ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
         and exists (select 1 from public.uyeler
                     where id = split_part(p_yol, '/', 2)::uuid and oda_id = split_part(p_yol, '/', 1)::uuid)
    then split_part(p_yol, '/', 2)::uuid
    else null
  end;
$$;
create function public.avatar_yol_oda(p_yol text) returns uuid
language sql stable security definer set search_path = public as $$
  select case when public.avatar_yol_uye(p_yol) is not null then split_part(p_yol, '/', 1)::uuid else null end;
$$;
revoke all on function public.avatar_yol_uye(text), public.avatar_yol_oda(text) from public, anon;
grant execute on function public.avatar_yol_uye(text), public.avatar_yol_oda(text) to authenticated;

create policy avatar_yukle on storage.objects for insert to authenticated
  with check (bucket_id = 'avatarlar' and public.benim_uyem(public.avatar_yol_uye(name)));
create policy avatar_oku on storage.objects for select to authenticated
  using (bucket_id = 'avatarlar' and public.uye_mi(public.avatar_yol_oda(name)));
create policy avatar_sil on storage.objects for delete to authenticated
  using (bucket_id = 'avatarlar'
         and (public.benim_uyem(public.avatar_yol_uye(name)) or public.sahip_mi(public.avatar_yol_oda(name))));
-- güncelleme politikası yok: her değişiklikte yeni dosya yüklenir, eskisi silinir
