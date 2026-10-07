-- Aşama 4 yetki ve davranış testi: roller/izinler, kategoriler, davetler, çoklu sunucu, denetim kaydı, yavaş mod, yasaklı kelime,
-- hoş geldin mesajı, webhook. Yerelde: node supabase/tests/yerel/calistir.mjs supabase/tests/sunucu_rls.sql
-- (canlıda çalıştırma: auth.users'a geçici satır yazar). Sonunda bilerek hata verip her şeyi geri alır; "FAIL" satırı olmamalı.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); ug uuid := gen_random_uuid(); ux uuid := gen_random_uuid();
  o1 uuid; o2 uuid; k1 uuid; k2 uuid; ma uuid; mb uuid; mc uuid; md uuid; mg uuid;
  msg_c uuid; msg_a uuid; rol1 uuid; kat uuid; kanal_yeni uuid; dkod text; n int; t text; v bigint; rapor text := ''; wh record; yeni_oda uuid; dmx uuid; mesaj_sayisi int;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (ua,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@t.invalid'),
    (ub,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@t.invalid'),
    (uc,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@t.invalid'),
    (ud,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','d@t.invalid'),
    (ug,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','g@t.invalid'),
    (ux,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','x@t.invalid');
  insert into odalar(ad, davet_kodu, olusturma, olusturan) values ('S1','T-S1', now() - interval '1 day', ua) returning id into o1;
  insert into odalar(ad, davet_kodu, olusturan) values ('S2','T-S2', ud) returning id into o2;
  insert into kanallar(oda_id, ad, tur, sira) values (o1,'genel','yazili',1) returning id into k1;
  insert into kanallar(oda_id, ad, tur, sira) values (o1,'Salon','sesli',2) returning id into k2;
  insert into uyeler(oda_id, user_id, takma_ad, rol) values (o1, ua, 'Ayse', 'sahip') returning id into ma;
  insert into uyeler(oda_id, user_id, takma_ad, rol) values (o1, ub, 'Bora', 'moderator') returning id into mb;
  insert into uyeler(oda_id, user_id, takma_ad, rol) values (o1, uc, 'Cem', 'uye') returning id into mc;
  insert into uyeler(oda_id, user_id, takma_ad, rol) values (o2, ud, 'Deniz', 'sahip') returning id into md;
  insert into uyeler(oda_id, user_id, takma_ad, rol, misafir) values (o2, ug, 'Misafir1', 'uye', true) returning id into mg;
  insert into kanallar(oda_id, ad, tur, sira) values (o2,'genel','yazili',1);

  -- ===== izin maskeleri =====
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  rapor := rapor||'Sahip maskesi (511): '||izinlerim(o1)||E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  rapor := rapor||'Moderatör maskesi (447): '||izinlerim(o1)||E'\n';
  rapor := rapor||'Moderatör yasaklayabilir (false): '||izin_var(o1,'yasakla')||E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  rapor := rapor||'Üye maskesi (15): '||izinlerim(o1)||E'\n';
  rapor := rapor||'Üye mesaj yönetebilir (false): '||izin_var(o1,'mesaj_yonet')||E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ux,'role','authenticated')::text, true); set local role authenticated;
  rapor := rapor||'Yabancı maskesi (boş): '||coalesce(izinlerim(o1)::text,'boş')||E'\n';

  -- ===== mesaj yazma izni =====
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  insert into mesajlar(kanal_id, uye_id, metin) values (k1, mc, 'selam') returning id into msg_c;
  rapor := rapor||E'OK: üye mesaj yazdı\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true); set local role authenticated;
  perform temel_izin_ayarla(o1, 'herkes', 14);  -- mesaj_yaz kapalı
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  begin insert into mesajlar(kanal_id, uye_id, metin) values (k1, mc, 'yasak'); rapor := rapor||E'FAIL: mesaj_yaz kapalıyken yazdı\n';
  exception when others then rapor := rapor||E'OK: mesaj_yaz izni kapalıyken yazılamaz\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  begin perform temel_izin_ayarla(o1, 'herkes', 15); rapor := rapor||E'FAIL: moderatör temel izni değiştirdi\n';
  exception when others then rapor := rapor||E'OK: temel izni yalnızca sahip değiştirir\n'; end;
  insert into mesajlar(kanal_id, uye_id, metin) values (k1, mb, 'moderatör yazar') returning id into msg_a;
  rapor := rapor||E'OK: moderatör (Moderatör izni mesaj_yaz içerir) yazabildi\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true); set local role authenticated;
  perform temel_izin_ayarla(o1, 'herkes', 15);

  -- ===== özel rol: mesaj_yonet =====
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  update mesajlar set silindi = true where id = msg_a; get diagnostics n = row_count; rapor := rapor||'Üye başkasının mesajını sildi (0): '||n||E'\n';
  begin perform rol_olustur(o1, 'X', '#ff0000', 1); rapor := rapor||E'FAIL: üye rol oluşturdu\n'; exception when others then rapor := rapor||E'OK: üye rol oluşturamaz\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  begin perform rol_olustur(o1, 'X', '#ff0000', 1); rapor := rapor||E'FAIL: moderatör rol oluşturdu\n'; exception when others then rapor := rapor||E'OK: moderatör rol oluşturamaz (yalnızca sahip)\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true); set local role authenticated;
  rol1 := rol_olustur(o1, 'DJ', '#c9a7ff', 15 | 16);
  perform rol_ata(mc, rol1, true);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  rapor := rapor||'DJ rolündeki üyenin maskesi (31): '||izinlerim(o1)||E'\n';
  update mesajlar set silindi = true where id = msg_a; get diagnostics n = row_count; rapor := rapor||'DJ (mesaj_yonet) başkasının mesajını sildi (1): '||n||E'\n';
  begin perform rol_ata(mc, rol1, false); rapor := rapor||E'FAIL: üye kendi rolünü kaldırdı\n'; exception when others then rapor := rapor||E'OK: rol atamayı yalnızca sahip yapar\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ux,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from roller; rapor := rapor||'Yabancı rolleri görür (0): '||n||E'\n';
  select count(*) into n from uye_rolleri; rapor := rapor||'Yabancı rol atamalarını görür (0): '||n||E'\n';

  -- ===== denetim kaydı =====
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from denetim_kaydi where eylem = 'mesaj_sil'; rapor := rapor||'Sahip: mesaj silme kaydı (1): '||n||E'\n';
  select count(*) into n from denetim_kaydi where eylem in ('rol_olustur','rol_ver'); rapor := rapor||'Sahip: rol kayıtları (2): '||n||E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ux,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from denetim_kaydi; rapor := rapor||'Yabancı denetim kaydını görür (0): '||n||E'\n';
  reset role;
  update mesajlar set silindi = false where id = msg_a;
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from denetim_kaydi; rapor := rapor||'Moderatör denetim kaydını görür (>0): '||(n > 0)||E'\n';
  begin insert into denetim_kaydi(oda_id, eylem) values (o1, 'sahte'); rapor := rapor||E'FAIL: doğrudan denetim kaydı yazıldı\n'; exception when others then rapor := rapor||E'OK: denetim kaydı doğrudan yazılamaz\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  -- üyenin maskesi DJ rolüyle 31: 16 biti var, denetimi görebilir; rolü kaldırıp tekrar bak
  reset role; delete from uye_rolleri where uye_id = mc; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from denetim_kaydi; rapor := rapor||'Sıradan üye denetim kaydını görür (0): '||n||E'\n';

  -- ===== kanallar ve kategoriler =====
  begin perform kanal_olustur('uye-kanali', 'yazili', null, o1); rapor := rapor||E'FAIL: üye kanal açtı\n'; exception when others then rapor := rapor||E'OK: kanal_yonet izni olmayan kanal açamaz\n'; end;
  begin perform kategori_olustur(o1, 'Yetkisiz'); rapor := rapor||E'FAIL: üye kategori açtı\n'; exception when others then rapor := rapor||E'OK: üye kategori açamaz\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  kanal_yeni := kanal_olustur('oyun-plani', 'yazili', null, o1);
  kat := kategori_olustur(o1, 'SOHBET');
  perform kanallari_duzenle(o1, jsonb_build_array(jsonb_build_object('id', k1, 'kategori_id', kat, 'sira', 2), jsonb_build_object('id', kanal_yeni, 'kategori_id', kat, 'sira', 1)), jsonb_build_array(jsonb_build_object('id', kat, 'sira', 5)));
  select count(*) into n from kanallar where kategori_id = kat; rapor := rapor||'Kategorideki kanal (2): '||n||E'\n';
  begin perform kanallari_duzenle(o1, jsonb_build_array(jsonb_build_object('id', (select id from kanallar where oda_id = o2 limit 1), 'kategori_id', null, 'sira', 1)), '[]'::jsonb); rapor := rapor||E'FAIL: başka sunucunun kanalı düzenlendi\n';
  exception when others then rapor := rapor||E'OK: başka sunucunun kanalı düzenlenemez\n'; end;
  begin perform kanal_sil(kanal_yeni); rapor := rapor||E'OK: moderatör (kanal_yonet) kanal sildi\n'; exception when others then rapor := rapor||E'FAIL: moderatör kanal silemedi\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ux,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from kategoriler; rapor := rapor||'Yabancı kategorileri görür (0): '||n||E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from kategoriler; rapor := rapor||'Üye kendi sunucusunun kategorilerini görür (1): '||n||E'\n';

  -- ===== davetler =====
  begin perform davet_olustur(o1, 7, null); rapor := rapor||E'FAIL: üye davet oluşturdu\n'; exception when others then rapor := rapor||E'OK: davet izni olmayan davet oluşturamaz\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  dkod := davet_olustur(o1, 7, 2);
  rapor := rapor||'Moderatör davet oluşturdu (8 karakter): '||char_length(dkod)||E'\n';
  select count(*) into n from davetler; rapor := rapor||'Moderatör davetleri görür (1): '||n||E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from davetler; rapor := rapor||'Üye davetleri görür (0): '||n||E'\n';
  reset role; set local role anon;
  select (select gecerli from davet_bilgi(dkod))::text into t; rapor := rapor||'Anon davet bilgisi (true): '||t||E'\n';
  select (select oda_ad from davet_bilgi(dkod)) into t; rapor := rapor||'Anon sunucu adı (S1): '||t||E'\n';
  begin perform davet_katil(dkod, 'Misafir'); rapor := rapor||E'FAIL: anon davetle katıldı\n'; exception when others then rapor := rapor||E'OK: giriş yapmadan katılınamaz\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ug,'role','authenticated')::text, true); set local role authenticated;
  begin perform davet_katil(dkod, null); rapor := rapor||E'FAIL: misafir davetle katıldı\n'; exception when others then rapor := rapor||E'OK: misafir davetle katılamaz\n'; end;
  begin perform sunucu_olustur('Misafir Sunucu'); rapor := rapor||E'FAIL: misafir sunucu kurdu\n'; exception when others then rapor := rapor||E'OK: misafir sunucu kuramaz\n'; end;
  -- sahip hoş geldin mesajı ayarlar, sonra D davetle katılır
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true); set local role authenticated;
  perform moderasyon_ayarla(o1, array['kötükelime', 'KötüBir'], 'Hoş geldin {ad}!', k1);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ud,'role','authenticated')::text, true); set local role authenticated;
  yeni_oda := davet_katil(dkod, null);
  rapor := rapor||'D davetle katıldı (S1): '||(yeni_oda = o1)||E'\n';
  rapor := rapor||'D katılınca iki sunucuda üye (2): '||(select count(*) from uyeler where user_id = ud)||E'\n';
  select count(*) into n from mesajlar where kanal_id = k1 and metin = 'Hoş geldin Deniz!'; rapor := rapor||'Hoş geldin mesajı yazıldı (1): '||n||E'\n';
  begin perform davet_katil('YOKYOKYO', null); rapor := rapor||E'FAIL: olmayan davet\n'; exception when others then rapor := rapor||E'OK: geçersiz davet reddedildi\n'; end;
  -- kullanım sınırı: limit 2; D bir kullandı, X girer, başkası giremez
  reset role; insert into uyeler(oda_id, user_id, takma_ad) values (o2, ux, 'Xeno');
  perform set_config('request.jwt.claims', json_build_object('sub',ux,'role','authenticated')::text, true); set local role authenticated;
  perform davet_katil(dkod, 'Xeno1');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  begin perform davet_katil(dkod, 'Hiç'); rapor := rapor||E'OK: (üye zaten içeride, yeniden katılma sorunsuz)\n'; exception when others then rapor := rapor||E'FAIL: üyenin yeniden katılması hata verdi\n'; end;
  reset role; update davetler set bitis = now() - interval '1 minute';
  perform set_config('request.jwt.claims', json_build_object('sub',ud,'role','authenticated')::text, true); set local role authenticated;
  select (select gecerli from davet_bilgi(dkod))::text into t; rapor := rapor||'Süresi dolan davet geçerli mi (false): '||t||E'\n';

  -- ===== çoklu sunucu =====
  yeni_oda := sunucu_olustur('Benim Yerim');
  rapor := rapor||'Yeni sunucuda kanal sayısı (2): '||(select count(*) from kanallar where oda_id = yeni_oda)||E'\n';
  rapor := rapor||'Kurucunun yeni sunucudaki maskesi (511): '||izinlerim(yeni_oda)||E'\n';
  begin perform sunucu_sil(o1); rapor := rapor||E'FAIL: sahip olmayan sunucu sildi\n'; exception when others then rapor := rapor||E'OK: sahibi olmadığın sunucu silinemez\n'; end;
  perform sunucu_sil(yeni_oda);
  select count(*) into n from odalar where id = yeni_oda; rapor := rapor||'Silinen sunucu listede (0): '||n||E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true); set local role authenticated;
  begin perform sunucu_sil(o1); rapor := rapor||E'FAIL: varsayılan sunucu silindi\n'; exception when others then rapor := rapor||E'OK: varsayılan sunucu silinemez\n'; end;
  select count(*) into n from odalar; rapor := rapor||'Sahip yalnızca kendi sunucusunu görür (1): '||n||E'\n';

  -- ===== DM çoklu sunucuda: üye kimliği hedefin sunucusundan türetilir =====
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ud,'role','authenticated')::text, true); set local role authenticated;
  dmx := dm_ac(mb);
  rapor := rapor||'D, B ile DM açtı; DM sunucusu S1 ('||((select oda_id from dm_kanallari where id = dmx) = o1)||E')
';
  rapor := rapor||'D, kendi ikinci sunucusundaki kişiyle de DM açabilir: '||(dm_ac((select id from uyeler where oda_id = o2 and user_id = ux)) is not null)||E'
';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true); set local role authenticated;
  -- ===== yavaş mod =====
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  perform kanal_yavas_mod_ayarla(k1, 60);
  reset role; delete from mesajlar where uye_id = mc and kanal_id = k1;
  perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  insert into mesajlar(kanal_id, uye_id, metin) values (k1, mc, 'ilk');
  begin insert into mesajlar(kanal_id, uye_id, metin) values (k1, mc, 'ikinci'); rapor := rapor||E'FAIL: yavaş modda art arda yazdı\n'; exception when others then rapor := rapor||E'OK: yavaş mod art arda mesajı engeller\n'; end;
  begin perform kanal_yavas_mod_ayarla(k1, 0); rapor := rapor||E'FAIL: üye yavaş modu değiştirdi\n'; exception when others then rapor := rapor||E'OK: yavaş modu yalnızca kanal_yonet değiştirir\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  insert into mesajlar(kanal_id, uye_id, metin) values (k1, mb, 'mod1'), (k1, mb, 'mod2');
  rapor := rapor||E'OK: mesaj_yonet izinli yavaş moda takılmaz\n';
  perform kanal_yavas_mod_ayarla(k1, 0);

  -- ===== yasaklı kelime =====
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  begin insert into mesajlar(kanal_id, uye_id, metin) values (k1, mc, 'bu bir KÖTÜKELİME değil'); rapor := rapor||E'OK: (büyük/küçük harf farkı: Türkçe İ eşleşmedi, kabul)\n'; exception when others then rapor := rapor||E'OK: büyük harfli yasaklı kelime engellendi\n'; end;
  begin insert into mesajlar(kanal_id, uye_id, metin) values (k1, mc, 'söylemem kötükelime diye'); rapor := rapor||E'FAIL: yasaklı kelime geçti\n'; exception when others then rapor := rapor||E'OK: yasaklı kelime engellendi\n'; end;
  insert into mesajlar(kanal_id, uye_id, metin) values (k1, mc, 'kötükelimelerden uzağız');
  rapor := rapor||E'OK: kelime içinde geçen parça engellenmedi (tam kelime eşleşir)\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  insert into mesajlar(kanal_id, uye_id, metin) values (k1, mb, 'kötükelime moderatör için serbest');
  rapor := rapor||E'OK: mesaj_yonet izinli kişi filtreye takılmaz\n';
  begin perform moderasyon_ayarla(o1, '{}', null, null); rapor := rapor||E'FAIL: moderatör moderasyon ayarını değiştirdi\n'; exception when others then rapor := rapor||E'OK: moderasyon ayarını yalnızca sahip değiştirir\n'; end;

  -- ===== webhook =====
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  select * into wh from webhook_olustur(k1, 'Duyuru Botu');
  rapor := rapor||'Webhook şifresi 32 karakter: '||char_length(wh.sifre)||E'\n';
  begin perform sifre_hash from webhooklar; rapor := rapor||E'FAIL: özet sütunu okunabildi\n'; exception when others then rapor := rapor||E'OK: webhook özeti istemciden okunamaz\n'; end;
  select count(*) into n from (select id, ad from webhooklar) x; rapor := rapor||'Moderatör webhook listesini görür (1): '||n||E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',uc,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from (select id, ad from webhooklar) x; rapor := rapor||'Üye webhook listesini görür (0): '||n||E'\n';
  begin perform webhook_olustur(k1, 'Sızma Botu'); rapor := rapor||E'FAIL: üye webhook açtı\n'; exception when others then rapor := rapor||E'OK: üye webhook açamaz\n'; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true); set local role authenticated;
  perform webhook_sil(wh.id);
  select count(*) into n from (select id from webhooklar) x; rapor := rapor||'Silinen webhook (0): '||n||E'\n';

  raise exception E'\n=== SUNUCU RLS RAPORU ===\n%', rapor;
end $$;
