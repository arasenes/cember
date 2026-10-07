# Çember — Devir Notu (7 Ekim 2026, güncel)

Arkadaşlar için Discord benzeri sohbet + sesli oda uygulaması. Yönetici: Aras (bronzaras@gmail.com). Kullanıcı kısa Türkçe yanıt istiyor.

## Altyapı
- **Kod:** GitHub `arasenes/cember` (main). Vite + React 19 + TypeScript, supabase-js, livekit-client, vitest. Bu oturumdaki tüm `src/` ve `android-ayar/` değişiklikleri GitHub'a yüklendi (güncel kaynak = GitHub main). `git clone https://github.com/arasenes/cember` ile başla.
- **Yayın:** Render statik site `srv-db1223ugekts73bqrbgg` → https://cember.onrender.com (main'e her commit ~20 sn'de yayına girer).
- **Backend:** Supabase proje `ehjslrbgazmakeucvquk` (veritabanı, auth, edge function'lar: `katil`, `ses-token`, `bildir`).
- **Sesli oda / ekran paylaşımı:** LiveKit (`ses-token` token üretir). LiveKit olmazsa `p2p.ts` ile doğrudan (ücretsiz) moda düşer; bu modda mikrofon zorunlu.
- **Android APK:** Capacitor sarmalayıcı, `https://cember.onrender.com` adresini yükler (appId `com.cember.chat`). GitHub Actions `.github/workflows/apk.yml` derler (tetikleyici: `capacitor.config.json`, `android-ayar/**`, workflow dosyası). Her derlemede `npx cap add android` sıfırdan çalışır, ardından `android-ayar/uygula.py` manifest/Gradle/Kotlin ayarlarını uygular. Sürüm = Actions çalıştırma numarası. İndirme: https://github.com/arasenes/cember/releases/download/apk-son/cember.apk
- **Son APK:** #8 (1.0.8) başarılı. (#7 21 sn'de başarısız oldu, #8 aynı değişiklikleri içeriyor.)

## Giriş sistemi
- Yalnızca **Google ile giriş** ve **geçici misafir hesabı**. Davet kodu ve yönetici kodu girişi kaldırıldı.
- Yönetici = `uyeler.rol='sahip'`; `katil` (v13) yalnızca doğrulanmış `bronzaras@gmail.com` hesabına ilk kayıtta `sahip` verir.
- Misafirler sahte `@cember.invalid` e-postayla açılır, çıkışta silinir; mesajları "Silinmiş üye" kalır.
- Supabase Auth URL Configuration'da `com.cember.chat://**` yönlendirmesi ekli.

## Bu oturumda yapılanlar
1. **Güncelleme uyarısı** (`guncelleme.ts`, `GuncellemeBandi.tsx`): yeni APK çıkınca uygulama içinde şerit.
2. **Yönetici kodu kaldırıldı**, bronzaras@gmail.com yönetici yapıldı; tüm kullanıcı/mesajlar kullanıcı tarafından silindi.
3. **Animasyonlu giriş ekranı** (`Gate.tsx`).
4. **Web push bildirimleri**: `public/sw.js`, `src/push.ts`, Ayarlar > Bildirimler; sunucu: `pg_net` tetikleyicisi → `bildir` edge function (VAPID anahtarları Supabase `push_ayar` tablosunda).
5. **Ekran paylaşımı iyileştirmeleri**: izleme paneli küçüldü (`styles.css` `.ekran-panel video` max-height), akıcılık için `degradationPreference: "maintain-framerate"` ve bit hızı artışı (`ekranOrtak.ts`: 720p 2.5 Mbps, 1080p 4.5 Mbps), bilgisayar paylaşımında ses yoksa uyarı (`voice.ts`: "Sistem/Sekme sesini paylaş" kutusu işaretlenmeli).
6. **Telefon sesi ekran paylaşımına eklendi** (`android-ayar/yerel/EkranYakalaPlugin.kt`): LiveKit `ScreenAudioCapturer` (AudioPlaybackCapture) ile telefonun sesi ekran katılımcısının mikrofon kanalına karışıyor; mikrofon izni istiyor; `uygula.py` servis türünü `mediaProjection|microphone` yaptı ve `FOREGROUND_SERVICE_MICROPHONE` ekledi. **Gerçek cihazda henüz doğrulanmadı.**
7. **APK'da Google girişi dönüşü düzeltildi**: Chrome özel şema yönlendirmesini (`com.cember.chat://`) engelliyordu. Artık Google girişi bitince site adresine dönülür; `src/UygulamayaDon.tsx` şeridi ("Çember uygulamasından mı geldin? → Uygulamada aç") `intent://giris?...package=com.cember.chat` ile oturumu uygulamaya taşır. `src/girisDonus.ts` (main.tsx'te supabase'den önce yüklenir) uygulamada `?access_token=...` bilgisini `#access_token=...` biçimine çevirir. `google.ts` artık her zaman `redirectTo: window.location.origin` kullanır. **Kullanıcı telefonda sonunda girebildi; hangi yoldan girdiği netleşmedi.**
8. **"Oturum geçersiz" hatası düzeltildi**: Bilgisayardan çıkış (`signOut()` varsayılanı global) telefonun sunucu oturumunu da kapatıyordu; sesli odaya katılırken `ses-token` 401 veriyordu. Artık tüm çıkışlar `signOut({ scope: "local" })` (App, Chat, KayitAdi) ve `voice.ts` içindeki `tokenIste()` 401'de önce `refreshSession()` dener, olmazsa yerel çıkış yapıp sayfayı yeniler.
9. Yeni test: `src/girisDonus.test.tsx`. Tüm testler geçiyor (81), `npx tsc --noEmit` temiz.

## Açık işler (öncelik sırasıyla)
1. **Telefon ses paylaşımını gerçek cihazda doğrula** (APK 1.0.8): odadakiler telefonun sesini duyuyor mu? Gitmiyorsa `sesiYayinla()` içindeki `setAudioRecordEnabled` yansıtmalı çağrısı ve mikrofon yayını (`setMicrophoneEnabled(true)`) kontrol edilmeli. DRM'li uygulamalar (Netflix vb.) yakalanamaz.
2. **Telefonda "Katıl" (sesli oda) sonrası düzeltmeyi doğrula**: çıkış-giriş yapıp sesli odaya katılma artık hata vermemeli.
3. **APK bildirimleri (Firebase/FCM):** Firebase projesi açılıp `google-services.json` dosyası `android-ayar/google-services.json` olarak commit edilmeli; Supabase gizli anahtarı `FCM_SERVICE_ACCOUNT` eklenmeli. **GitHub'a yüklenmemiş yerel değişiklik:** `.github/workflows/apk.yml` içindeki npm kurulum satırına `@capacitor/push-notifications@^8.1.3` eklenecek (yerel kopya buluttaki oturumda kaldı; elle ekle). `uygula.py` zaten `google-services.json` varsa kopyalıyor. APK için push kaydı istemci kodu (`push.ts` içinde `yerelPush`) hazır ama Firebase olmadan çalışmaz.
4. **Genel odada duyuru:** yeni özellikleri `genel` kanalına Aras olarak yaz (Google giriş, misafir hesap, APK güncelleme uyarısı, bildirimler, animasyonlu giriş, ekran/ses iyileştirmeleri). Kanal kimliği (`ff861bc3-4f6b-4e24-aca4-7d46c1bb6a5a`) silme sonrası değişmiş olabilir; kontrol et.
5. Uçtan uca bildirim testi (ikinci hesapla mesaj gönderip).
6. P2P modu yalnızca dinleyici olarak girmeyi desteklemiyor (mikrofon şart).
7. Repoda olmayanlar: `supabase/migrations/008–014` (yerelde vardı, bulut oturumunda kaldı; Supabase'de uygulanmış durumda) ve README güncellemesi. `yonetici_kodlari` tablosunda kullanılmayan bir satır duruyor (silme sorgusu zaman aşımına uğradı).
8. Eski "Enes-BRONZ" hesabı `sahip` rolünde (aynı kişi/hesap olabilir); ikinci yönetici istenmiyorsa `uyeler.rol` düşürülmeli.
9. Marka adı: global yayın için `cember.com` alınmış; adaylar Kinnect, Kulisly, Ahbaply, Cirkl, Huddlo (alan adı/marka kontrolü kullanıcıda).
10. Google OAuth uygulama yayın durumu ve test kullanıcıları kontrol edilmeli.

## Çalışma notları
- Supabase SQL: `drop trigger if exists` ve bazı çok ifadeli DDL'ler zaman aşımına uğruyor; tek tek çalıştır.
- Test: `npx vitest run`, tür denetimi: `npx tsc --noEmit`.
- Bu oturumda dosyaları GitHub'a tarayıcı uzantısıyla yükledim (yavaş, kararsız, bazen yükleme takılıyor); VS Code'da doğrudan `git commit` + `push` çok daha hızlı ve güvenilir.
- APK derleme durumu: GitHub > Actions > "Android APK". Yeni APK için `android-ayar/**` altında değişiklik commit'lemek yeterli. Derleme ~2,5 dk.
- LiveKit Android SDK 2.29.0; kaynağı https://raw.githubusercontent.com/livekit/client-sdk-android/v2.29.0/ altında okunabilir.
- Supabase auth tanısı: `auth.sessions`, `auth.users` tablolarını SQL ile sorgulayarak giriş sorunları incelenebilir.
- Gizli bilgiler (VAPID özel anahtarı, `bildir_gizli`) Supabase `push_ayar` tablosunda; bu nota yazılmadı.

## Ek: depo/canlı karşılaştırması (sonraki oturum, 7 Ekim 2026)
- `supabase/functions/katil` ve `bildir` canlıdaki (v13 / v1) kodla eşitlendi; `yonet`, `ses-token`, `turn-bilgi` zaten canlıyla aynıydı. Edge Function'lar depodan otomatik yayınlanmaz, değişince elle yayınla.
- Canlıda ayrıca işi bitmiş `tani` fonksiyonu var (410 döner); silinebilir.
- Canlı veritabanında depoda migration karşılığı olmayan tablolar: `kanal_sifreleri`, `kanal_acik`, `kanal_deneme`, `tepkiler`, `push_abonelikleri`, `push_ayar`. `list_migrations` yalnızca 001-004 ve `012_uye_durumu` gösteriyor; 008-014 `supabase db dump` ile çıkarılıp eklenmeli.
- README güncellendi (davet kodu anlatımları kaldırıldı).
- Güvenlik notları: `katil`'de CORS `*` ve deneme sınırı `x-forwarded-for`'a güveniyor; APK `android-ayar/debug.keystore` ile imzalanıyor (değişirse uygulama silinip yeniden kurulmalı).

### Bu turda eklenenler (henüz yayınlanmadı: push + Supabase yayını bekliyor)
- `supabase/migrations/008_canli_sema_tamamlama.sql`: canlıdan çıkarılan eksik şema (tablolar, sütunlar, işlevler, tetikleyiciler, politikalar). **Canlı veritabanında sınanmadı**; boş bir Supabase projesinde 001-008 sırayla denenmeli. Canlıda hâlâ duran kullanılmayan işlevler: `davet_kodu_getir`, `yonet_kod_yenile`, `ses_kullanim`.
- `katil`: CORS yalnızca `https://cember.onrender.com` ve `http://localhost:5173`; IP için önce `cf-connecting-ip`. **Edge Function'ı Supabase'e elle yayınla** (depodaki dosya canlıya otomatik gitmez).
- `apk.yml`: `@capacitor/push-notifications` eklendi (önceki notta "yüklenmemiş yerel değişiklik" denen madde).
- Mesaj düzenleme arayüzü (kendi mesajında ✏️, Enter kaydeder / Esc iptal); veritabanı tetikleyicisi "(düzenlendi)" zamanını yazar. 2 yeni test.
- Web bildirimine dokununca ilgili kanal açılıyor (`sw.js` → `postMessage` / `?kanal=`). APK'da FCM tarafı Firebase kurulunca ayrıca bağlanmalı.
- Düzeltme: `livekit-client` zaten ayrı (lazy) parça olarak yükleniyor; "kod bölme yapılmadı" notu yanlıştı.
- Yapılmadı (gerçek cihaz/Firebase gerekir): telefon ses paylaşımı doğrulaması, FCM, sesli odada arka plan servisi, resim dışı dosya gönderme, P2P'de yalnızca dinleyici.


## Aşama 1 (mesaj özellikleri): tamamlandı, 7 Ekim 2026
Yeni kod `src/mesaj/` altında; `Chat.tsx` yalnızca bağlar. Her özelliğin birim testi var (135 test geçiyor, `tsc` temiz).
- **Alıntılı yanıt** (`mesajlar.yanit_id`): mesaj araç çubuğunda Yanıtla; yazı alanı üstünde "X kişisine yanıt veriyorsun" çubuğu; mesajda alıntı satırı, tıklayınca o mesaja kayar (yüklü değilse etrafındaki 50 mesajı yükler). RLS: alıntılanan mesaj aynı kanalda olmalı (`yanit_gecerli`).
- **Yazıyor göstergesi**: Realtime broadcast (`yaziyor`), 3 sn'de bir yayın, 5 sn'de söner (`mesaj/yaziyor.ts`).
- **Mesaj arama** (`mesaj_ara` işlevi, `mesajlar.arama` tsvector `turkish` + GIN): kelime önek eşleşmeli; süzgeçler kişi/kanal/tarih/resimli. İşlev SECURITY INVOKER, yani şifreli kanal ve üyelik kuralları aynen geçerli.
- **Markdown + spoiler** (`mesaj/markdown.tsx`): React öğeleriyle üretilir, HTML'e çevrilmez; yalnızca http/https bağlantı.
- **Okunmamış**: `kanal_okuma` + `okundu_isaretle` işlevi; yerel kayıtla birleşir (en yeni geçerli), cihazlar arası çalışır. Kanal açılınca "Yeni mesajlar" çizgisi.
- **Anket** (`anketler`, `anket_secenekleri`, `anket_oylari`): oluşturma ve oy yalnızca `anket_olustur` / `anket_oyla` işlevleriyle (tek oy kuralı, süre, susturma kontrolü sunucuda). Oylar Realtime ile canlı.
- **GIF**: `gif-ara` edge function + `GifSecici`. **Çalışması için Supabase sırlarına `GIPHY_API_KEY` (ya da `TENOR_API_KEY`) eklenmeli**; yoksa seçici "henüz kurulmadı" der. Seçilen GIF bağlantısı mesaj olarak gider (yalnızca giphy/tenor alan adları resim olarak gösterilir).
- **Bağlantı önizleme**: `onizleme` edge function (Open Graph; SSRF korumalı: özel/yerel IP engeli, yönlendirmeler tek tek doğrulanır, 3 sn, 512 KB). Mesaj gönderilince istemci çağırır, sonuç `mesajlar.onizleme`'ye yazılır. **Canlıda gerçek bir bağlantıyla elle denenmedi.** DNS yeniden bağlama (rebinding) için kalan küçük risk: adres doğrulaması ile `fetch` arasında DNS değişebilir.
- **Mesaj iletme**: başka yazılı kanala kopya, "X'ten iletildi" etiketi. Resimli mesajlar iletilmez (ek yolu kanala bağlı).
- Migration'lar canlıya parça parça uygulandı (adları `015a/b/c`, `016a/b`, `017`, `018a-e`, `019a/b`); depodaki `015-019` dosyaları aynı içeriğin birleşik halidir. Güvenlik denetiminde (`get_advisors`) benim eklediğim işlevler için uyarı kalmadı; eski `anon` SECURITY DEFINER uyarıları (`mesaj_bildir` vb.) bu aşamanın dışında.
- `katil`: misafir silinince `kanal_okuma` da silinir. Canlı sürümler: katil v15, onizleme v1, gif-ara v1.
- Elle denenecekler: iki tarayıcıyla yanıt/yazıyor/anket oyu/okunmadı çizgisi; telefon genişliğinde (390 px) taşma; bağlantı önizleme; GIF (anahtar eklenince).
