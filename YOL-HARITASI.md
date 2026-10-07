# Çember — Discord Özellik Yol Haritası

Hedef: Discord'un özelliklerini Çember'e eklemek. Her satır `[x]` zaten var, `[ ]` eksik.
Teknoloji: React + Supabase (RLS + realtime) + LiveKit. Yeni her tablo RLS ile gelmeli, migration `supabase/migrations/015_...` ve sonrası olarak yazılmalı, testler `npx vitest run` ile geçmeli.

## 1. Mesaj özellikleri
- [x] Yazılı kanallar, mesaj gönder/sil, düzenle (`duzenleme`), resim/dosya eki
- [x] Emoji tepkileri (`tepkiler`), emoji seçici
- [x] Konular / yanıt dizileri (`ust_mesaj_id`, `KonuPaneli`)
- [x] Sabitlenmiş mesajlar (`sabit`)
- [x] @bahsetme otomatik tamamlama (Chat.tsx ~satır 132); etiketli mesaj bildirimi
- [x] **Mesaja alıntılı yanıt** (konu açmadan): `mesajlar.yanit_id uuid references mesajlar`, üstte alıntı kartı
- [x] **Mesaj arama**: `mesajlar.metin` üzerinde `tsvector` (turkish) + GIN dizin, arama kutusu, kanal/kişi/tarih süzgeci
- [x] **"Yazıyor…" göstergesi**: Supabase Realtime presence/broadcast, kanal başına
- [x] **Anket**: `anketler`, `anket_secenekleri`, `anket_oylari` tabloları; mesaj türü "anket"
- [x] **GIF**: Tenor/Giphy API anahtarı (edge function üzerinden), seçici (kod hazır; `GIPHY_API_KEY` ya da `TENOR_API_KEY` Supabase sırrı eklenince çalışır)
- [x] **Bağlantı önizleme** (Open Graph): edge function `onizleme`, `mesajlar.onizleme jsonb`
- [x] Mesaj iletme, Markdown (kalın/italik/kod/alıntı), spoiler `||metin||`
- [x] Okunmamış işareti ve "buradan itibaren okunmadı" çizgisi (`kanal_okuma(uye_id, kanal_id, son_okuma)`)

## 2. Özel mesaj ve sosyal
- [x] Profil, avatar, hakkında, durum (çevrimiçi/meşgul/rahatsız etme)
- [ ] **Özel mesajlar (DM)**: `dm_kanallari(id, tur 'ikili'|'grup')`, `dm_uyeleri`, mesajlar için `mesajlar.kanal_id` yerine ayrı `dm_mesajlari` ya da `kanallar.tur='dm'`; RLS yalnızca üyelere
- [ ] **Grup DM** (en fazla 10 kişi)
- [ ] **Arkadaş listesi**: `arkadasliklar(a, b, durum 'bekliyor'|'kabul')`, istek gönder/kabul/engelle
- [ ] **Engelleme / susturma** (kişi bazlı)
- [ ] Özel durum metni ve "Boşta" otomatik durumu (5 dk hareketsiz)
- [ ] Profil bannerı ve rozetler

## 3. Sunucu yönetimi
- [x] Roller: sahip / moderatör / üye; susturma, yasaklama (ad + IP), kanal şifresi
- [x] Kanal ekle/sil/sırala, kanal açıklaması
- [ ] **Kanal kategorileri**: `kategoriler(oda_id, ad, sira)`, `kanallar.kategori_id`, daraltılabilir gruplar
- [ ] **Özel roller ve izinler**: `roller(oda_id, ad, renk, izinler bigint)`, `uye_rolleri`; izin bitleri (mesaj yaz, dosya, yönet, yasakla, ses konuş…); kanal bazlı izin geçersiz kılma
- [ ] **Çoklu sunucu**: bugün tek oda (`odalar` 1 satır, `katil` ilk odayı alıyor). `oda_id` zaten tablolarda var; arayüzde sunucu listesi ve sunucu oluşturma gerek
- [ ] **Davet bağlantıları**: `davetler(kod, oda_id, bitis, kullanim_limiti)`, `/davet/<kod>` sayfası
- [ ] **Denetim kaydı**: `denetim_kaydi(oda_id, eyleyen, eylem, hedef, zaman)`
- [ ] Yavaş mod (kanal başına saniye), otomatik moderasyon (yasaklı kelime), zaman aşımı
- [ ] Hoş geldin mesajı, sunucu simgesi, sunucu bannerı
- [ ] Bot/webhook: kanala gelen webhook adresi (edge function)

## 4. Ses ve video
- [x] Sesli kanallar (LiveKit), mikrofon aç/kapat, gürültü engelleme, ekran paylaşımı (web + Android)
- [x] Telefon sesi ekran paylaşımıyla (APK 1.0.8, test bekliyor)
- [ ] **Bas-konuş (push-to-talk)** ve tuş atama
- [ ] **Kişi başı ses düzeyi** (sağ tık/uzun bas): izleyici tarafında `audio.volume`
- [ ] **Kamera paylaşımı** (`setCameraEnabled`), kamera ızgarası
- [ ] **Sağırlaştır** (kendi çıkışını kapat) ve sunucu susturma
- [ ] Sesli kanalda metin sohbeti, "konuşuyor" halkası (kısmen var: `konusanlar`)
- [ ] Sahne kanalı (konuşmacı/dinleyici), davet-ile-bağlan
- [ ] Müzik botu (LiveKit agent ya da ingress)

## 5. Uygulama / altyapı
- [x] Web push, APK, güncelleme uyarısı, tema, yazı boyutu
- [ ] APK bildirimleri (Firebase; bkz. DEVIR-NOTU.md)
- [ ] Klavye kısayolları, komut paleti (Ctrl+K)
- [ ] Çeviri (TR/EN), erişilebilirlik denetimi
- [ ] Kullanım limitleri ve LiveKit maliyet izleme

## Önerilen sıra
1. Alıntılı yanıt, yazıyor göstergesi, mesaj arama, Markdown (küçük, hızlı kazanç)
2. DM + arkadaş listesi
3. Ses: bas-konuş, kişi başı ses, kamera, sağırlaştır
4. Kategoriler, özel roller/izinler, davet bağlantıları, çoklu sunucu
5. Anket, GIF, bağlantı önizleme, denetim kaydı
