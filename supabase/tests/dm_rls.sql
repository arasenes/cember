-- NOT: canlı projede çalıştırılmadı (auth.users'a geçici satır yazar); SQL editöründe ya da bir Supabase branch'inde çalıştır.
-- Aşama 2 yetki testi (DM, grup DM, arkadaşlık, engelleme). SQL editöründe çalıştır; sonunda bilerek hata verip
-- her şeyi geri alır (hata metni raporu içerir). "FAIL" satırı olmamalı.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); ud uuid := gen_random_uuid();
  o1 uuid; o2 uuid; ma uuid; mb uuid; mc uuid; md uuid;
  dm_ab uuid; dm_g uuid; msg uuid; msg_b uuid; rapor text := ''; n int; yeni_id uuid; durum_ text;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (ua,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@t.invalid'),
    (ub,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@t.invalid'),
    (uc,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@t.invalid'),
    (ud,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','d@t.invalid');
  insert into odalar(ad,davet_kodu) values ('T1','T-DM-1') returning id into o1;
  insert into odalar(ad,davet_kodu) values ('T2','T-DM-2') returning id into o2;
  insert into uyeler(oda_id,user_id,takma_ad,rol) values (o1,ua,'Ayse','uye') returning id into ma;
  insert into uyeler(oda_id,user_id,takma_ad,rol) values (o1,ub,'Bora','uye') returning id into mb;
  insert into uyeler(oda_id,user_id,takma_ad,rol) values (o1,uc,'Cem','uye') returning id into mc;
  insert into uyeler(oda_id,user_id,takma_ad,rol) values (o2,ud,'Deniz','sahip') returning id into md;

  -- A, B ile DM açar ve yazar
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  dm_ab := public.dm_ac(mb);
  rapor := rapor||E'OK: A-B DM açıldı\n';
  if public.dm_ac(mb) = dm_ab then rapor := rapor||E'OK: aynı çift için ikinci DM açılmadı\n'; else rapor := rapor||E'FAIL: çift DM\n'; end if;
  insert into dm_mesajlari(dm_id,uye_id,metin) values (dm_ab,ma,'merhaba B') returning id into msg;
  rapor := rapor||E'OK: A mesaj yazdı\n';
  begin insert into dm_mesajlari(dm_id,uye_id,metin) values (dm_ab,mb,'taklit'); rapor := rapor||E'FAIL: A, B adına yazdı\n';
  exception when others then rapor := rapor||E'OK: başkası adına yazma reddedildi\n'; end;
  begin perform public.dm_ac(md); rapor := rapor||E'FAIL: başka odadaki kişiyle DM açıldı\n';
  exception when others then rapor := rapor||E'OK: başka odadaki kişiyle DM reddedildi\n'; end;
  begin insert into dm_uyeleri(dm_id,uye_id) values (dm_ab,mc); rapor := rapor||E'FAIL: doğrudan üye eklendi\n';
  exception when others then rapor := rapor||E'OK: doğrudan dm_uyeleri yazısı reddedildi\n'; end;
  begin insert into dm_kanallari(tur) values ('grup'); rapor := rapor||E'FAIL: doğrudan DM kanalı açıldı\n';
  exception when others then rapor := rapor||E'OK: doğrudan dm_kanallari yazısı reddedildi\n'; end;

  -- B görür; C ve D göremez, yazamaz
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from dm_mesajlari; rapor := rapor||'B mesaj sayısı (1): '||n||E'\n';
  select count(*) into n from dm_okunmamis() where dm_id = dm_ab; rapor := rapor||'B okunmamış DM (1): '||n||E'\n';
  update dm_mesajlari set silindi = true where id = msg; get diagnostics n = row_count;
  rapor := rapor||'B, A''nın mesajını sildi (0): '||n||E'\n';
  insert into dm_mesajlari(dm_id,uye_id,metin) values (dm_ab,mb,'merhaba A') returning id into msg_b;
  update dm_mesajlari set metin = 'düzenlendi' where id = msg_b;
  select duzenleme is not null into durum_ from dm_mesajlari where id = msg_b; rapor := rapor||'B kendi mesajını düzenledi, duzenleme dolu (true): '||durum_||E'\n';
  update dm_mesajlari set silindi = true where id = msg_b;
  begin update dm_mesajlari set silindi = false where id = msg_b; rapor := rapor||E'FAIL: silinen mesaj geri getirildi\n';
  exception when others then rapor := rapor||E'OK: silinen mesaj geri getirilemez\n'; end;

  foreach durum_ in array array['c','d'] loop
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', case durum_ when 'c' then uc else ud end,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from dm_mesajlari; rapor := rapor||upper(durum_)||' DM mesajlarını görür (0): '||n||E'\n';
    select count(*) into n from dm_kanallari; rapor := rapor||upper(durum_)||' DM kanallarını görür (0): '||n||E'\n';
    select count(*) into n from dm_uyeleri; rapor := rapor||upper(durum_)||' DM üyelerini görür (0): '||n||E'\n';
    begin insert into dm_mesajlari(dm_id,uye_id,metin) values (dm_ab, case durum_ when 'c' then mc else md end,'sizma'); rapor := rapor||E'FAIL: '||durum_||E' DM''e yazdı\n';
    exception when others then rapor := rapor||E'OK: '||durum_||E' üçüncü kişi DM''e yazamaz\n'; end;
  end loop;

  -- Arkadaşlık: C -> B istek, B kabul; A göremez
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true);
  set local role authenticated;
  rapor := rapor||'C->B istek ('||public.arkadas_istek(mb)||E')\n';
  rapor := rapor||'C tekrar istek (bekliyor): '||public.arkadas_istek(mb)||E'\n';
  begin perform public.arkadas_istek(mc); rapor := rapor||E'FAIL: kendine istek\n'; exception when others then rapor := rapor||E'OK: kendine istek reddedildi\n'; end;
  begin perform public.arkadas_istek(md); rapor := rapor||E'FAIL: başka odaya istek\n'; exception when others then rapor := rapor||E'OK: başka odadaki kişiye istek reddedildi\n'; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from arkadasliklar; rapor := rapor||'A (taraf değil) arkadaşlık satırı (0): '||n||E'\n';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  set local role authenticated;
  select id into yeni_id from arkadasliklar where b = mb and durum = 'bekliyor';
  perform public.arkadas_yanit(yeni_id, true);
  select durum into durum_ from arkadasliklar where id = yeni_id; rapor := rapor||'B kabul etti (kabul): '||durum_||E'\n';
  begin update arkadasliklar set durum = 'engelli' where id = yeni_id; get diagnostics n = row_count; rapor := rapor||'doğrudan güncelleme satırı (0): '||n||E'\n';
  exception when others then rapor := rapor||E'OK: doğrudan arkadaşlık güncellemesi reddedildi\n'; end;

  -- Engelleme: B, A'yı engeller; iki yönde de yazma ve istek kapanır; A engelli satırı göremez
  perform public.engelle(ma);
  rapor := rapor||E'OK: B, A''yı engelledi\n';
  begin insert into dm_mesajlari(dm_id,uye_id,metin) values (dm_ab,mb,'engelli iken'); rapor := rapor||E'FAIL: engelleyen yazdı\n';
  exception when others then rapor := rapor||E'OK: engelleyen DM''e yazamaz\n'; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  begin insert into dm_mesajlari(dm_id,uye_id,metin) values (dm_ab,ma,'engellenmişken'); rapor := rapor||E'FAIL: engellenen yazdı\n';
  exception when others then rapor := rapor||E'OK: engellenen DM''e yazamaz\n'; end;
  begin perform public.arkadas_istek(mb); rapor := rapor||E'FAIL: engelliye istek\n'; exception when others then rapor := rapor||E'OK: engelli kişiye istek reddedildi\n'; end;
  select count(*) into n from arkadasliklar where durum = 'engelli'; rapor := rapor||'A, kendisinin engellendiğini görür (0): '||n||E'\n';
  begin perform public.dm_grup_olustur('g', array[mb, mc]); rapor := rapor||E'FAIL: engelli kişili grup\n'; exception when others then rapor := rapor||E'OK: engelli kişiyle grup kurulamaz\n'; end;

  -- Engel kalkınca grup kurulur; grup sınırları
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  set local role authenticated;
  perform public.engel_kaldir(ma);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.dm_grup_olustur('tek', array[mb]); rapor := rapor||E'FAIL: 2 kişilik grup\n'; exception when others then rapor := rapor||E'OK: en az 3 kişi (2 diğer) gerekir\n'; end;
  dm_g := public.dm_grup_olustur('Ekip', array[mb, mc]);
  insert into dm_mesajlari(dm_id,uye_id,metin) values (dm_g,ma,'grup mesajı');
  rapor := rapor||E'OK: grup DM kuruldu ve yazıldı\n';
  begin perform public.dm_grup_uye_ekle(dm_g, md); rapor := rapor||E'FAIL: başka odadan grup üyesi\n'; exception when others then rapor := rapor||E'OK: başka odadaki kişi gruba eklenemez\n'; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',ud,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from dm_mesajlari where dm_id = dm_g; rapor := rapor||'D grup mesajlarını görür (0): '||n||E'\n';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from dm_mesajlari where dm_id = dm_g; rapor := rapor||'C grup mesajlarını görür (1): '||n||E'\n';
  delete from dm_uyeleri where dm_id = dm_ab and uye_id = mc; get diagnostics n = row_count; rapor := rapor||'C başkasının ikili DM üyeliğini sildi (0): '||n||E'\n';
  delete from dm_uyeleri where dm_id = dm_g and uye_id = mc; get diagnostics n = row_count; rapor := rapor||'C gruptan ayrıldı (1): '||n||E'\n';
  select count(*) into n from dm_mesajlari where dm_id = dm_g; rapor := rapor||'C ayrıldıktan sonra grup mesajları (0): '||n||E'\n';

  raise exception E'\n=== DM RLS RAPORU ===\n%', rapor;
end $$;
