-- deneme_kaydet (039) testi. Yerelde: node supabase/tests/yerel/calistir.mjs supabase/tests/deneme_atomik.sql
-- Sonunda bilerek hata verip her şeyi geri alır; "FAIL" satırı olmamalı.
-- Not: gerçek paralellik tek bağlantılı yerel ortamda sınanamaz; kilit (advisory lock) ve sayım mantığı sınanır.
do $$
declare
  r boolean; n int; rapor text := '';
begin
  -- Limit 3: ilk üç kayıt geçer, dördüncüsü reddedilir ve satır eklenmez
  r := deneme_kaydet('9.9.9.9', 3); rapor := rapor || case when r then 'PASS' else 'FAIL' end || ' 1. kayıt geçer' || E'\n';
  r := deneme_kaydet('9.9.9.9', 3); rapor := rapor || case when r then 'PASS' else 'FAIL' end || ' 2. kayıt geçer' || E'\n';
  r := deneme_kaydet('9.9.9.9', 3); rapor := rapor || case when r then 'PASS' else 'FAIL' end || ' 3. kayıt geçer' || E'\n';
  r := deneme_kaydet('9.9.9.9', 3); rapor := rapor || case when not r then 'PASS' else 'FAIL' end || ' 4. kayıt reddedilir' || E'\n';
  select count(*) into n from giris_denemeleri where ip = '9.9.9.9';
  rapor := rapor || case when n = 3 then 'PASS' else 'FAIL' end || ' reddedilen deneme satır eklemez (3): ' || n || E'\n';

  -- IP'ler birbirinden bağımsız
  r := deneme_kaydet('8.8.8.8', 3); rapor := rapor || case when r then 'PASS' else 'FAIL' end || ' başka IP etkilenmez' || E'\n';

  -- Pencere dışındaki eski kayıtlar sayılmaz
  insert into giris_denemeleri (ip, zaman) values ('7.7.7.7', now() - interval '11 minutes'), ('7.7.7.7', now() - interval '12 minutes');
  r := deneme_kaydet('7.7.7.7', 1); rapor := rapor || case when r then 'PASS' else 'FAIL' end || ' eski kayıtlar sayılmaz' || E'\n';
  r := deneme_kaydet('7.7.7.7', 1); rapor := rapor || case when not r then 'PASS' else 'FAIL' end || ' pencere içindeki kayıt sayılır' || E'\n';

  -- Yetki: yalnızca service_role çalıştırabilir
  rapor := rapor || case when not has_function_privilege('anon', 'public.deneme_kaydet(text,int,int)', 'execute') then 'PASS' else 'FAIL' end || ' anon çalıştıramaz' || E'\n';
  rapor := rapor || case when not has_function_privilege('authenticated', 'public.deneme_kaydet(text,int,int)', 'execute') then 'PASS' else 'FAIL' end || ' authenticated çalıştıramaz' || E'\n';
  rapor := rapor || case when has_function_privilege('service_role', 'public.deneme_kaydet(text,int,int)', 'execute') then 'PASS' else 'FAIL' end || ' service_role çalıştırabilir' || E'\n';

  raise exception E'\n=== DENEME ATOMIK RAPORU ===\n%', rapor;
end $$;
