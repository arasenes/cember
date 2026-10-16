-- Hız sınırı yarış koşulu düzeltmesi: "say, sonra ekle" iki ayrı sorguydu; aynı IP'den paralel gelen isteklerin hepsi
-- sayımı limitin altında görüp geçebiliyordu. Sayma ve kaydetme tek işlemde, IP başına kilitle yapılır.
-- Dönüş: true = kaydedildi (limit aşılmadı), false = limit dolu (kayıt eklenmez).
create or replace function public.deneme_kaydet(p_ip text, p_limit int, p_pencere_dk int default 10)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  -- Aynı IP için işlemler sıraya girer (kilit işlem sonunda kalkar)
  perform pg_advisory_xact_lock(hashtext('deneme:' || p_ip));
  select count(*) into n from public.giris_denemeleri
    where ip = p_ip and zaman >= now() - make_interval(mins => p_pencere_dk);
  if n >= p_limit then
    return false;
  end if;
  insert into public.giris_denemeleri (ip) values (p_ip);
  return true;
end;
$$;

revoke all on function public.deneme_kaydet(text, int, int) from public, anon, authenticated;
grant execute on function public.deneme_kaydet(text, int, int) to service_role;
