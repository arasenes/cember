-- Eski davet kodu düzeninden kalan, artık hiçbir yerde çağrılmayan işlevler (davet bağlantıları: davetler tablosu, 026).
drop function if exists public.davet_kodu_getir(uuid);
drop function if exists public.yonet_kod_yenile(uuid);
-- Kullanılmayan yönetici kodu satırları (tablo yalnızca canlıda vardır)
do $$ begin
  if to_regclass('public.yonetici_kodlari') is not null then execute 'delete from public.yonetici_kodlari'; end if;
end $$;
