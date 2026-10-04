-- Yetki (RLS) testi. Supabase SQL editöründe çalıştır. Her şeyi sonunda bilerek hata vererek GERİ ALIR
-- (hata mesajı raporu içerir), yani veritabanında iz bırakmaz.
-- Beklenen: "OK" satırları ve "(0)" beklenen sayıların 0 olması; "FAIL" satırı olmamalı.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  o1 uuid; o2 uuid; k1 uuid; k2 uuid; ma uuid; mb uuid; mc uuid; msg1 uuid; msg2 uuid;
  rapor text := ''; n int;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (ua,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@t.invalid'),
    (ub,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@t.invalid'),
    (uc,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@t.invalid');
  insert into odalar(ad,davet_kodu) values ('T1','T-KOD-1') returning id into o1;
  insert into odalar(ad,davet_kodu) values ('T2','T-KOD-2') returning id into o2;
  insert into kanallar(oda_id,ad) values (o1,'x') returning id into k1;
  insert into kanallar(oda_id,ad) values (o2,'y') returning id into k2;
  insert into uyeler(oda_id,user_id,takma_ad,rol) values (o1,ua,'Ayse','sahip') returning id into ma;
  insert into uyeler(oda_id,user_id,takma_ad,rol) values (o1,ub,'Bora','uye') returning id into mb;
  insert into uyeler(oda_id,user_id,takma_ad,rol) values (o2,uc,'Cem','sahip') returning id into mc;
  insert into mesajlar(kanal_id,uye_id,metin) values (k2,mc,'gizli') returning id into msg2;

  -- B (üye, oda 1)
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from mesajlar; rapor := rapor || 'B diğer odanın mesajlarını görür (0): '||n||E'\n';
  select count(*) into n from kanallar; rapor := rapor || 'B kanal sayısı (1): '||n||E'\n';
  begin insert into mesajlar(kanal_id,uye_id,metin) values (k2,mb,'sizma'); rapor := rapor||E'FAIL: B başka odaya yazdı\n';
  exception when others then rapor := rapor||E'OK: başka odaya yazma reddedildi\n'; end;
  begin insert into mesajlar(kanal_id,uye_id,metin) values (k1,ma,'taklit'); rapor := rapor||E'FAIL: B başkası adına yazdı\n';
  exception when others then rapor := rapor||E'OK: başkası adına yazma reddedildi\n'; end;
  insert into mesajlar(kanal_id,uye_id,metin) values (k1,mb,'<script>alert(1)</script>') returning id into msg1;
  rapor := rapor||E'OK: kendi mesajını yazdı\n';
  begin execute 'select davet_kodu from odalar'; rapor := rapor||E'FAIL: davet_kodu okunabildi\n';
  exception when others then rapor := rapor||E'OK: davet_kodu sütunu kapalı\n'; end;
  delete from uyeler where id = ma; get diagnostics n = row_count;
  rapor := rapor||'B oda sahibini attı mı (0): '||n||E'\n';

  -- A (sahip): B'nin mesajını silebilir ama metnini değiştiremez
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  update mesajlar set silindi = true where id = msg1; get diagnostics n = row_count;
  rapor := rapor||'Sahip başkasının mesajını sildi (1): '||n||E'\n';
  begin update mesajlar set metin='degistirdim' where id = msg1; rapor := rapor||E'FAIL: sahip başkasının metnini değiştirdi\n';
  exception when others then rapor := rapor||E'OK: sahip başkasının metnini düzenleyemez\n'; end;

  -- B başkasının mesajını silemez
  reset role;
  insert into mesajlar(kanal_id,uye_id,metin) values (k1,ma,'ev sahibi') returning id into msg1;
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  set local role authenticated;
  update mesajlar set silindi = true where id = msg1; get diagnostics n = row_count;
  rapor := rapor||'B başkasının mesajını sildi (0): '||n||E'\n';

  -- C (başka oda) oda 1'i göremez
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from mesajlar where kanal_id = k1; rapor := rapor||'C oda-1 mesajları (0): '||n||E'\n';
  select count(*) into n from uyeler where oda_id = o1; rapor := rapor||'C oda-1 üyeleri (0): '||n||E'\n';

  -- anon hiçbir şey göremez
  reset role;
  set local role anon;
  begin execute 'select count(*) from mesajlar'; rapor := rapor||E'FAIL: anon mesaj okudu\n';
  exception when others then rapor := rapor||E'OK: anon mesajlara erişemez\n'; end;
  reset role;
  raise exception E'RAPOR\n%', rapor;
end $$;
