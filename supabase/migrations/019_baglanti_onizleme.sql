-- Aşama 1: bağlantı önizleme (Open Graph). Yalnızca `onizleme` edge function'ı (servis anahtarı) yazar.
alter table public.mesajlar add column if not exists onizleme jsonb;

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
  if new.onizleme is distinct from old.onizleme and current_user in ('authenticated', 'anon') then
    raise exception 'Önizleme yalnızca sunucu tarafından yazılır';
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
