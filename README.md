# Çember

Arkadaşlara özel, davet kodlu yazılı sohbet (ve ileride sesli oda) uygulaması. Vite + React + TypeScript, arka uç Supabase.

Durum: **Aşama 1** (iskelet, davet kodlu giriş, yazılı sohbet) ve **Aşama 3** (sesli oda: LiveKit + otomatik yedek P2P) hazır. Dosya/emoji (Aşama 2) ve cila (Aşama 4) sonra.

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

Migration'lar `supabase/migrations/` içinde, sırayla çalıştırılır (001, 002). Başlangıç odası için `supabase/seed.sql`. Davet kodunu görmek için SQL editöründe `select davet_kodu from odalar;`.

`supabase/functions/katil` giriş fonksiyonudur: davet kodunu ve takma adı doğrular (yanlış kodda IP başına 10 dakikada 10 deneme sınırı), arka planda anonim bir kullanıcı oluşturur ve oturum döner. JWT doğrulaması kapalı yayınlanır (`verify_jwt: false`) çünkü henüz oturumu olmayan kişi çağırır; kendi doğrulamasını kendisi yapar.

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

## Yayın

Statik site: `npm run build`, `dist/` klasörünü Cloudflare Pages, Vercel ya da Render Static Site'a yükle; iki ortam değişkenini orada tanımla. Mikrofon (Aşama 3) yalnızca HTTPS'te çalışır.
