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
