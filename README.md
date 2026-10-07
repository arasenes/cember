# Çember

Arkadaşlara özel yazılı + sesli sohbet uygulaması (Google ya da misafir girişi). Vite + React + TypeScript, arka uç Supabase.

Durum ve devir bilgisi için **DEVIR-NOTU.md** dosyasına bak.

## Kurulum

```bash
npm install
cp .env.example .env     # değerleri doldur
npm run dev              # http://localhost:5173
npm test                 # birim testleri
npm run build            # üretim derlemesi (dist/)
```

Ortam değişkenleri (yalnızca adlar, değerler `.env` içinde, commit edilmez):

- `VITE_SUPABASE_URL`: Supabase proje adresi
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase "publishable" (eski adıyla anon) anahtarı. Tarayıcıya açık olması normaldir; erişimi RLS kuralları sınırlar.

`service_role` anahtarı hiçbir zaman bu depoda ya da tarayıcıda bulunmaz. Yalnızca Supabase Edge Function ortamında hazır gelir.

## Supabase

Migration'lar `supabase/migrations/` içinde, sırayla çalıştırılır (001-007; canlı veritabanında bunlardan sonra eklenenler için DEVIR-NOTU.md'ye bak). Başlangıç odası için `supabase/seed.sql`. 

`supabase/functions/katil` giriş fonksiyonudur: misafir girişi (`misafir`), misafir çıkışı (`misafir_sil`) ve Google ile kayıt (`google`) işlemlerini yapar; arka planda geçici hesap açar, IP başına deneme sınırı uygular. JWT doğrulaması kapalı yayınlanır (`verify_jwt: false`) çünkü henüz oturumu olmayan kişi çağırır.

Yetki testi: `supabase/tests/rls.sql` dosyasını SQL editöründe çalıştır. Sonunda bilerek hata verip her şeyi geri alır; hata metni raporu içerir ("FAIL" satırı olmamalı).

## Sesli oda (iki motor, otomatik yedek)

Sesli kanala girince önce **LiveKit** denenir. LiveKit kurulu değilse, aylık kotası dolduysa ya da bağlanamazsa (ya da konuşma sırasında kopar) otomatik olarak **doğrudan (P2P) mod**a geçilir: tarayıcılar birbirine bağlanır, kota yoktur, ücretsizdir, 5-6 kişiye kadar rahat çalışır. Aynı sesli odadaki herkes aynı modu kullanır: odada zaten biri varsa onun modu seçilir. Odada "(doğrudan)" yazısı P2P modunu gösterir.

**LiveKit (isteğe bağlı):**
1. cloud.livekit.io'da ücretsiz proje aç; Settings → Keys'ten sunucu adresi, API key ve API secret al.
2. Supabase → Edge Functions → Secrets: `LIVEKIT_URL` (wss://...), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. İsteğe bağlı: `SES_MAX_KISI` (varsayılan 12), `SES_AYLIK_DAKIKA` (varsayılan 5000).
3. Ücretsiz plan ayda 5.000 katılımcı dakikasıdır. Kullanım, bağlı kişilerin 30 saniyelik nabızlarından hesaplanır (yaklaşık). Oda sahibi %80'de uyarı görür.

**P2P için TURN (önerilir, ücretsiz):** Bazı ağlarda (iş yeri, bazı mobil ağlar) doğrudan bağlantı kurulamaz; bunlar için Cloudflare Realtime TURN kullanılır (ayda ilk 1.000 GB ücretsiz).
1. dash.cloudflare.com'da ücretsiz hesap aç; Realtime → TURN Server bölümünden bir TURN anahtarı oluştur.
2. Supabase Secrets: `CF_TURN_KEY_ID` (anahtarın kimliği) ve `CF_TURN_API_TOKEN` (anahtarın API token'ı).
TURN tanımlı değilse yalnızca STUN kullanılır; çoğu bağlantı yine kurulur.

İlgili dosyalar: `supabase/migrations/003_ses_oturumlari.sql`, `004_ses_sinyal_politikalari.sql`, fonksiyonlar `ses-token` ve `turn-bilgi`. P2P sinyalleşmesi özel Realtime kanalından (`ses:<kanal_id>`) geçer; yalnızca odanın üyeleri girebilir. Bu değerler tarayıcıya ve depoya girmez. Mikrofon yalnızca https'te çalışır.

İsteğe bağlı ortam değişkenleri (site): `VITE_SES_MAX_KISI` (P2P kişi sınırı, varsayılan 6), `VITE_SES_AYLIK_DAKIKA` (LiveKit uyarı sınırı, varsayılan 5000).

P2P'nin nasıl sınandığı: `harness/` klasöründe sahte Realtime ile üç sekmeli bir deney düzeneği vardır (`npx vite --config harness/vite.config.ts`).

## Resim ve ekran görüntüsü gönderme

Mesaja resim eklemenin üç yolu var: 📎 düğmesiyle dosya seçmek, mesaj kutusuna **Ctrl+V** ile ekran görüntüsü yapıştırmak, ya da resmi sohbetin üstüne sürükleyip bırakmak. Gönderilmeden önce önizleme görünür; resim tek başına ya da yazıyla birlikte gidebilir. Resme tıklayınca büyür (Esc ile kapanır).

- Biçimler: PNG, JPEG, WebP, GIF. SVG ve diğer dosyalar bilerek kabul edilmez.
- Gönderilmeden önce tarayıcıda uzun kenarı 1600 pikseli geçmeyecek şekilde küçültülür ve WebP'ye çevrilir (yaklaşık 100-300 KB). Bu işlem fotoğraflardaki konum gibi EXIF bilgilerini de siler. GIF olduğu gibi gider (animasyon bozulmasın), en fazla 5 MB.
- Resimler `ekler` adlı **özel** bir Supabase Storage kovasında tutulur; yol biçimi `<oda>/<kanal>/<uuid>.<uzantı>`. Yalnızca o odanın üyeleri okuyabilir, görüntüleme bir saatlik imzalı bağlantıyla yapılır. Aynı odanın üyesi olmayan biri yükleyemez ve göremez.
- Mesaj silinince (kendi mesajı ya da oda sahibi) resim dosyası da depolamadan silinir.
- Supabase ücretsiz planında depolama 1 GB; ortalama bir resim 200 KB ise yaklaşık 5.000 resme yeter.
- Kurulum: `supabase/migrations/005_resim_ekleri.sql` dosyasını çalıştır. Test: `supabase/tests/rls.sql` artık depolama kurallarını da sınar.

## Profil

Sol alttaki adına (ya da üye listesinde / mesajdaki ad ve fotoğrafa) tıklayınca profil penceresi açılır. Kendi profilinde **fotoğraf, takma ad, renk ve "hakkımda"** (en fazla 120 karakter) değiştirilebilir; başkasınınkini yalnızca görürsün. Değişiklikler diğer üyelerde anında güncellenir.

- Fotoğraf tarayıcıda ortadan kare kesilir, 256×256'ya küçültülür ve WebP'ye çevrilir (yaklaşık 10-40 KB; EXIF bilgisi silinir). Fotoğrafı olmayanlarda adın baş harfi gösterilir.
- Fotoğraflar `avatarlar` adlı **özel** kovada tutulur (yol: `<oda>/<üye>/<uuid>.webp`); yalnızca o odanın üyeleri görür, herkes yalnızca kendi klasörüne yükleyebilir. Yeni fotoğraf yüklenince eskisi silinir.
- Takma ad 2-24 karakter olmalı ve odada benzersizdir; başkasında kullanılıyorsa kayıt reddedilir. Üye kimliği, oda ve rol değiştirilemez (veritabanı tetikleyicisi korur).
- Kurulum: `supabase/migrations/006_profil.sql`. Test: `supabase/tests/rls.sql` profil kurallarını da sınar.

## Ekran paylaşımı (dizi/film birlikte izleme)

Sesli odaya katılınca ses çubuğunda **🖥️ Ekranı paylaş** düğmesi çıkar. Kalite seçilir (720p tasarruflu, varsayılan; ya da 1080p), tarayıcı hangi sekme/pencere/ekranın paylaşılacağını sorar. Odadaki herkes yayını sohbetin üstünde bir video paneliyle izler; ses, tam ekran ve ses düzeyi için tarayıcının kendi video denetimleri kullanılır. Yayın yapan kişi, üye listesinde ve sesli oda listesinde 🖥️ ile görünür. Aynı anda tek kişi paylaşabilir.

- **Ses:** Chrome/Edge'de paylaşım penceresinde **Chrome Sekmesi**'ni seçip **Sekme sesini paylaş**'ı işaretle; yoksa izleyenler görüntüyü sessiz görür. Windows'ta "Tüm ekran" seçilirse sistem sesi de paylaşılabilir. Echo olmaması için kulaklık kullan.
- **Telefon:** tarayıcılar telefondan ekran paylaşmaya izin vermez; telefon yalnızca **izleyebilir** (düğme görünmez). Paylaşım için bilgisayar gerekir.
- **Netflix, Disney+, Prime gibi korumalı (DRM) siteler** tarayıcıdan paylaşılınca görüntü siyah gelebilir ve bu hizmetlerin kullanım şartlarına aykırı olabilir; kendi dosyaların ya da korumasız kaynaklar sorunsuz çalışır.
- **Motorlar:** LiveKit modunda yayın LiveKit üzerinden gider. Ücretsiz planda aylık **50 GB indirme** sınırı var (720p'de izleyici başına saatte yaklaşık 0,8 GB; yani iki izleyiciyle kabaca 30 saat). Sınır dolunca ya da LiveKit yoksa otomatik **doğrudan (P2P) mod** devreye girer: kotasız ve ücretsizdir, ama paylaşan kişinin internet yüklemesi izleyici sayısıyla çarpılır (720p'de izleyici başına ~1,8 Mbps; 1080p'de ~3,5 Mbps).
- Doğrudan modda ekran için ses bağlantılarından ayrı, paylaşanın başlattığı bağlantılar kurulur (`ekran-*` sinyalleri); ekran paylaşımı bilmeyen eski sürümler bunları yok sayar. LiveKit tarafında ek bir sunucu değişikliği gerekmez (jeton zaten yayın yetkisi taşır).
- Test: `harness/motor.html` ile iki-üç sekmeli gerçek tarayıcı denemesi yapıldı (doğrudan mod); LiveKit yolu gerçek bir LiveKit sunucusu olmadan bu ortamda sınanamadı, iki cihazla elle denemek gerekir.

## Güvenlik notları

- Mesajlar düz metin olarak gösterilir (HTML enjekte edilemez); `MessageView.test.tsx` bunu sınar.
- Bir kullanıcı yalnızca üyesi olduğu odanın kanal, üye ve mesajlarını okuyabilir; yalnızca kendi adına yazar. Oda sahibi herhangi bir mesajı silebilir (metnini değiştiremez) ve üyeyi atabilir.
- `odalar.davet_kodu` sütunu istemciye kapalıdır.
- Mesajlar uçtan uca şifreli **değildir**.

## Bilinen sınırlar (Aşama 1)

- Aynı takma adla başka tarayıcıdan tekrar girilemez; oturumunu kaybeden üyeyi oda sahibi atınca yeniden katılabilir (üye atma arayüzü Aşama 4'te; şimdilik SQL editöründen `delete from uyeler where takma_ad = '...'`).
- Odaya ilk giren kişi sahip olur.
- Sesli odada yeniden bağlanma ve bildirimler Aşama 4'te.
- Mesaj düzenleme arayüzü yok (veritabanı hazır).
- Bir mesajda tek resim gönderilebilir; resim dışındaki dosyalar (PDF vb.) henüz yok.

## Yayın

Statik site: `npm run build`, `dist/` klasörünü Cloudflare Pages, Vercel ya da Render Static Site'a yükle; iki ortam değişkenini orada tanımla. Mikrofon (Aşama 3) yalnızca HTTPS'te çalışır.
