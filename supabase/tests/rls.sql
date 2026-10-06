-- Yetki (RLS) testi. Supabase SQL editöründe çalıştır. Her şeyi sonunda bilerek hata vererek GERİ ALIR
-- (hata mesajı raporu içerir), yani veritabanında iz bırakmaz.
-- Beklenen: "OK" satırları ve "(0)" beklenen sayıların 0 olması; "FAIL" satırı olmamalı.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  o1 uuid; o2 uuid; k1 uuid; k2 uuid; ma uuid; mb uuid; mc uuid; msg1 uuid; msg2 uuid;
  rapor text := ''; n int; yol1 text; yol2 text; yol3 text; yol_k2 text;
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

  -- Resim ekleri (migration 005). Not: storage.objects'ten doğrudan silme Supabase'te kapalıdır, silme API ile yapılır.
  reset role;
  yol1 := o1 || '/' || k1 || '/' || gen_random_uuid() || '.webp';
  yol2 := o1 || '/' || k1 || '/' || gen_random_uuid() || '.png';
  yol3 := o1 || '/' || k1 || '/' || gen_random_uuid() || '.webp';
  yol_k2 := o2 || '/' || k2 || '/' || gen_random_uuid() || '.webp';
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  set local role authenticated;
  begin insert into storage.objects(bucket_id,name,owner_id) values ('ekler', yol1, ub::text); rapor := rapor||E'OK: B kendi odasına resim yükledi\n';
  exception when others then rapor := rapor||E'FAIL: B kendi odasına yükleyemedi: '||sqlerrm||E'\n'; end;
  begin insert into storage.objects(bucket_id,name,owner_id) values ('ekler', yol_k2, ub::text); rapor := rapor||E'FAIL: B başka odaya resim yükledi\n';
  exception when others then rapor := rapor||E'OK: başka odanın klasörüne yükleme reddedildi\n'; end;
  begin insert into storage.objects(bucket_id,name,owner_id) values ('ekler', o1 || '/' || k2 || '/' || gen_random_uuid() || '.webp', ub::text); rapor := rapor||E'FAIL: kanal-oda uyumsuz yol kabul edildi\n';
  exception when others then rapor := rapor||E'OK: kanal-oda uyumsuz yol reddedildi\n'; end;
  begin insert into storage.objects(bucket_id,name,owner_id) values ('ekler', o1 || '/' || k1 || '/kotu.exe', ub::text); rapor := rapor||E'FAIL: geçersiz dosya adı kabul edildi\n';
  exception when others then rapor := rapor||E'OK: geçersiz dosya adı reddedildi\n'; end;
  begin insert into mesajlar(kanal_id,uye_id,metin,ek_yol,ek_tur,ek_boyut,ek_genislik,ek_yukseklik) values (k1,mb,'',yol1,'image/webp',1000,100,100) returning id into msg1;
    rapor := rapor||E'OK: metinsiz resim mesajı yazıldı\n';
  exception when others then rapor := rapor||E'FAIL: resim mesajı yazılamadı: '||sqlerrm||E'\n'; end;
  begin insert into mesajlar(kanal_id,uye_id,metin) values (k1,mb,''); rapor := rapor||E'FAIL: boş mesaj kabul edildi\n';
  exception when others then rapor := rapor||E'OK: metinsiz ve resimsiz mesaj reddedildi\n'; end;
  begin insert into mesajlar(kanal_id,uye_id,metin,ek_yol,ek_tur,ek_boyut,ek_genislik,ek_yukseklik) values (k1,mb,'x',yol_k2,'image/webp',1000,100,100);
    rapor := rapor||E'FAIL: başka odanın resmine bağlanan mesaj kabul edildi\n';
  exception when others then rapor := rapor||E'OK: başka odanın yoluna bağlanan mesaj reddedildi\n'; end;
  begin insert into mesajlar(kanal_id,uye_id,metin,ek_yol,ek_tur,ek_boyut,ek_genislik,ek_yukseklik) values (k1,mb,'x',yol3,'image/svg+xml',1000,100,100);
    rapor := rapor||E'FAIL: svg türü kabul edildi\n';
  exception when others then rapor := rapor||E'OK: svg türü reddedildi\n'; end;
  begin update mesajlar set ek_yol = yol3 where id = msg1; rapor := rapor||E'FAIL: ek yolu sonradan değiştirildi\n';
  exception when others then rapor := rapor||E'OK: ek yolu sonradan değiştirilemez\n'; end;
  select count(*) into n from storage.objects where bucket_id='ekler'; rapor := rapor||'B oda-1 resimlerini görür (1): '||n||E'\n';

  -- C (başka oda) oda-1 resimlerini göremez
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id='ekler' and name = yol1; rapor := rapor||'C oda-1 resmini görür (0): '||n||E'\n';
  begin insert into storage.objects(bucket_id,name,owner_id) values ('ekler', yol3, uc::text); rapor := rapor||E'FAIL: C başka odanın klasörüne yükledi\n';
  exception when others then rapor := rapor||E'OK: C başka odaya yükleyemedi\n'; end;

  -- A (oda-1 sahibi) oda-1 resimlerini görür
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects where bucket_id='ekler' and name = yol1; rapor := rapor||'A oda-1 resmini görür (1): '||n||E'\n';

  -- anon hiçbir şey göremez
  reset role;
  set local role anon;
  begin select count(*) into n from storage.objects where bucket_id = 'ekler'; rapor := rapor||'anon resim sayısı (0): '||n||E'\n';
  exception when others then rapor := rapor||E'OK: anon depolamaya erişemez\n'; end;
  begin execute 'select count(*) from mesajlar'; rapor := rapor||E'FAIL: anon mesaj okudu\n';
  exception when others then rapor := rapor||E'OK: anon mesajlara erişemez\n'; end;
  reset role;
  raise exception E'RAPOR\n%', rapor;
end $$;
