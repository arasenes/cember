-- Aşama 1: alıntılı yanıt (yanit_id) ve mesaj iletme (iletilen_ad)
alter table public.mesajlar add column if not exists yanit_id uuid references public.mesajlar(id) on delete set null;
alter table public.mesajlar add column if not exists iletilen_ad text check (iletilen_ad is null or char_length(iletilen_ad) between 1 and 24);
create index if not exists mesajlar_yanit_idx on public.mesajlar (yanit_id) where yanit_id is not null;

-- Alıntılanan mesaj aynı kanalda olmalı
create or replace function public.yanit_gecerli(p_yanit uuid, p_kanal uuid) returns boolean
language sql stable security definer set search_path to 'public' as
$$ select p_yanit is null or exists (select 1 from public.mesajlar m where m.id = p_yanit and m.kanal_id = p_kanal); $$;

drop policy if exists mesajlar_yaz on public.mesajlar;
create policy mesajlar_yaz on public.mesajlar for insert to authenticated
  with check (benim_uyem(uye_id) and (not sabit) and (not susturuldu_mu(uye_id)) and uye_mi(kanal_odasi(kanal_id))
    and kanal_erisim(kanal_id) and ust_mesaj_gecerli(ust_mesaj_id, kanal_id) and yanit_gecerli(yanit_id, kanal_id)
    and (ek_yol is null or ek_yol like kanal_odasi(kanal_id)::text || '/' || kanal_id::text || '/%'));

-- Alıntı bağlantısı ve iletme etiketi sonradan değiştirilemez
create or replace function public.mesaj_degismez() returns trigger language plpgsql set search_path to 'public' as
$$
begin
  if new.id <> old.id or new.kanal_id <> old.kanal_id or new.uye_id <> old.uye_id or new.olusturma <> old.olusturma then
    raise exception 'Bu alanlar değiştirilemez';
  end if;
  if new.ust_mesaj_id is distinct from old.ust_mesaj_id then
    raise exception 'Konu bağlantısı değiştirilemez';
  end if;
  if new.yanit_id is distinct from old.yanit_id and current_user in ('authenticated', 'anon') then
    raise exception 'Yanıt bağlantısı değiştirilemez';
  end if;
  if new.iletilen_ad is distinct from old.iletilen_ad then
    raise exception 'İletme etiketi değiştirilemez';
  end if;
  if new.ek_yol is distinct from old.ek_yol or new.ek_tur is distinct from old.ek_tur
     or new.ek_boyut is distinct from old.ek_boyut or new.ek_genislik is distinct from old.ek_genislik
     or new.ek_yukseklik is distinct from old.ek_yukseklik then
    raise exception 'Ek bilgileri değiştirilemez';
  end if;
  if (new.sabit is distinct from old.sabit or new.sabit_zaman is distinct from old.sabit_zaman) and current_user in ('authenticated', 'anon') then
    raise exception 'Sabitleme yalnızca yönetici işlemiyle yapılır';
  end if;
  if new.metin <> old.metin and not public.benim_uyem(old.uye_id) then
    raise exception 'Başkasının mesajı düzenlenemez';
  end if;
  if new.metin <> old.metin then new.duzenleme := now(); end if;
  return new;
end $$;
