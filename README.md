# Çember

Arkadaşlara özel, davet kodlu yazılı sohbet (ve ileride sesli oda) uygulaması. Vite + React + TypeScript, arka uç Supabase.

Durum: **Aşama 1** (iskelet, davet kodlu giriş, yazılı sohbet). Dosya/emoji (Aşama 2), sesli oda (Aşama 3) ve cila (Aşama 4) sonra.

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

## Güvenlik notları

- Mesajlar düz metin olarak gösterilir (HTML enjekte edilemez); `MessageView.test.tsx` bunu sınar.
- Bir kullanıcı yalnızca üyesi olduğu odanın kanal, üye ve mesajlarını okuyabilir; yalnızca kendi adına yazar. Oda sahibi herhangi bir mesajı silebilir (metnini değiştiremez) ve üyeyi atabilir.
- `odalar.davet_kodu` sütunu istemciye kapalıdır.
- Mesajlar uçtan uca şifreli **değildir**.

## Bilinen sınırlar (Aşama 1)

- Aynı takma adla başka tarayıcıdan tekrar girilemez; oturumunu kaybeden üyeyi oda sahibi atınca yeniden katılabilir (üye atma arayüzü Aşama 4'te; şimdilik SQL editöründen `delete from uyeler where takma_ad = '...'`).
- Odaya ilk giren kişi sahip olur.
- Sesli odalar listede görünür ama pasiftir.
- Mesaj düzenleme arayüzü yok (veritabanı hazır).

## Yayın

Statik site: `npm run build`, `dist/` klasörünü Cloudflare Pages, Vercel ya da Render Static Site'a yükle; iki ortam değişkenini orada tanımla. Mikrofon (Aşama 3) yalnızca HTTPS'te çalışır.
