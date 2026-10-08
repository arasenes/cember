# Çember — Discord özellikleri: Claude Code komutu

Bu dosyayı VS Code'da Claude Code'a şöyle ver: `KOMUT.md, TEMA.md, DEVIR-NOTU.md ve YOL-HARITASI.md dosyalarını oku, KOMUT.md'deki 1. aşamadan başla.`

## Bağlam
- Proje: Çember, arkadaşlar için Discord benzeri sohbet + sesli oda uygulaması. Repo: `arasenes/cember` (main → Render ~20 sn'de yayınlar). Yönetici: Aras. Kullanıcı kısa Türkçe yanıt ister; arayüz metinleri **Türkçe**.
- Teknoloji: Vite + React 19 + TypeScript, supabase-js (RLS + realtime), livekit-client, vitest. Supabase proje `ehjslrbgazmakeucvquk`. Altyapı ve geçmiş: `DEVIR-NOTU.md`. Özellik listesi: `YOL-HARITASI.md`.
- **Tema ve tasarım (birebir referans):** `TEMA.md` ve `tema.css` (renk, yazı, ölçü değişkenleri — önce bunları oku) ve `tasarim/` klasöründeki 5 ekran (`Main`, `DM`, `Ses`, `Yonetim`, `Telefon` `.dc.html`; tarayıcıda açılır, düzen inline stillerde). Önce `tema.css`'i `src/tema.css` olarak ekle, `src/styles.css` renklerini değişkenlere bağla; tüm uygulamayı yeniden yazma, ekran ekran taşı.

## Çalışma kuralları
1. Her aşama ayrı dal/commit dizisi; bitince `npx tsc --noEmit` ve `npx vitest run` **temiz** olmalı. Yeni mantığa test yaz.
2. Her yeni tablo: `supabase/migrations/NNN_ad.sql` (son numaradan devam, 015'ten başla), **RLS açık**, politikalar `auth.uid()` ile; sonra migration'ı Supabase'e uygula (MCP ya da CLI). Tek seferde çok DDL zaman aşımına uğrar: ifadeleri tek tek çalıştır. Çalıştırdıktan sonra `get_advisors` ile güvenlik uyarısı kontrol et.
3. Mevcut davranışı bozma: tek oda varsayımı (`katil`), yasaklama (ad + IP), kanal şifresi, konular, sabitleme, tepkiler, ekran paylaşımı/APK kodu (`android-ayar/`) çalışır kalmalı.
4. `signOut` her zaman `{ scope: "local" }`. Sesli oda token'ı `tokenIste()` üzerinden.
5. Büyük dosyaları (`Chat.tsx`) şişirme: yeni özellik = yeni bileşen/modül (`src/mesaj/…`, `src/dm/…`, `src/ayarlar/…`).
6. Erişilebilirlik: gerçek `<button>`/`<input>`+`<label>`, ikon düğmelerine `aria-label`, odak halkası görünür.
7. Her aşama sonunda `DEVIR-NOTU.md` ve `YOL-HARITASI.md` (`[x]` işaretle) güncelle, commit mesajı Türkçe, push et, Render yayınını doğrula.
8. APK'yı etkileyen değişiklik (`android-ayar/**`) gerekiyorsa ayrı commit; web özellikleri APK gerektirmez.

## Aşama 0 — Palet seçici (herkes kendi temasını seçer)
- `temalar/temalar.css` → `src/temalar.css` (tema.css'ten SONRA import et), `temalar/temalar.ts` → `src/temalar.ts`. 10 palet: Mint Gece, Mor Gece, Derin Mavi, Sıcak Mercan, Açık Tema, Gül Gecesi, Kömür ve Turuncu (varsayılan), Neon Limon, Orman ve Altın, Açık Mercan. Seçim `<html data-tema="…">` ile uygulanır; açık paletlerde `color-scheme: light`.
- `main.tsx`'te render'dan önce `temaUygula(temaOku())` çağır (açılışta renk titremesi olmasın).
- Ayarlar'a "Görünüm" bölümü: palet kartları ızgarası (her kartta 4 renkli önizleme + ad + not), seçili olana işaret, tıklayınca anında uygulanır. Klavyeyle gezilebilir `radiogroup`.
- Kalıcılık: `localStorage` + girişliyse `profiles.tema text` (migration `alter table profiles add column tema text`; kullanıcı yalnızca kendi satırını güncelleyebilsin). Girişte profilden oku, cihazlar arası aynı olsun.
- Kod içinde sabit hex kullanma (avatar renkleri hariç): hepsi `var(--…)` olmalı ki her palet çalışsın. Açık paletlerde her ekranı kontrol et: yazı kontrastı ≥ 4.5:1, durum noktaları yanında yazı/ikon.

## Aşama 1 — Mesaj özellikleri (ekran: Sohbet + Telefon)
- **Alıntılı yanıt:** `mesajlar.yanit_id uuid references mesajlar on delete set null`. Mesaja üzerine gelince araç çubuğu (yanıtla, konu aç, ilet, diğer). Yazı alanı üstünde "X kişisine yanıt veriyorsun" çubuğu; mesajda üstte alıntı satırı, tıklayınca o mesaja kaydır.
- **Yazıyor göstergesi:** Supabase Realtime broadcast/presence, kanal başına, 5 sn zaman aşımı, "Can ve Enes yazıyor…" (3'ten fazlaysa "Birkaç kişi yazıyor…").
- **Mesaj arama:** `mesajlar` üzerinde `tsvector` (`turkish`) üretilmiş sütun + GIN dizin; arama kutusu (üst çubuk), süzgeçler: kişi, kanal, tarih, ekli mi. Sonuca tıklayınca mesaja git.
- **Markdown:** `**kalın**`, `*italik*`, `` `kod` ``, ```` ``` ```` kod bloğu, `> alıntı`, `||spoiler||` (tıklayınca açılır). XSS güvenli: HTML'e çevirme, React öğeleriyle üret; mevcut @bahsetme ve bağlantı işleme bozulmasın.
- **Okunmamış:** `kanal_okuma(uye_id, kanal_id, son_okuma)`; kanal listesinde kalın ad + nokta/sayı rozeti (bahsetme varsa sarı sayı), mesaj listesinde "Yeni mesajlar" çizgisi.
- **Anket:** `anketler(id, mesaj_id, soru, bitis, coklu)`, `anket_secenekleri`, `anket_oylari(anket_id, uye_id, secenek_id)` (tek oy kuralı, değiştirilebilir); realtime yüzde çubukları; oluşturma penceresi (soru + 2–6 seçenek + süre).
- **GIF:** Tenor/Giphy anahtarı Supabase secret'ında, edge function `gif-ara` arar; seçici penceresi; mesaj eki olarak URL.
- **Bağlantı önizleme:** edge function `onizleme` (Open Graph, SSRF'ye karşı yerel/özel IP engelle, 3 sn zaman aşımı); `mesajlar.onizleme jsonb`; kart görünümü.
- **Mesaj iletme:** başka kanala/DM'e kopya, "Enes'ten iletildi" etiketi.
- Kabul: iki tarayıcıyla yanıt, yazıyor, anket oyu ve okunmadı sayacı canlı çalışıyor; telefon genişliğinde (390 px) taşma yok.

## Aşama 2 — Özel mesaj, grup, arkadaşlar (ekran: DM)
- Tablolar: `dm_kanallari(id, tur 'ikili'|'grup', ad, olusturan)`, `dm_uyeleri(dm_id, uye_id)`, DM mesajları için `mesajlar`'ı yeniden kullan (`kanallar.tur='dm'` ve `oda_id` null olabilir ise) **veya** `dm_mesajlari`; hangisinin daha az kod/RLS riski getirdiğini önce incele, kararı DEVIR-NOTU'na yaz. RLS: yalnızca DM üyeleri okur/yazar. Grup en çok 10 kişi.
- `arkadasliklar(a, b, durum 'bekliyor'|'kabul'|'engelli')`; istek gönder/kabul/reddet/engelle; engellenen kişi DM atamaz, bildirimi susar.
- Sol sütun: arama kutusu, "Arkadaşlar (N istek)", DM listesi (okunmamış rozet, durum noktası). Sağ panel: profil kartı (banner, rozetler, hakkında, ortak sunucular, arkadaş/engelle).
- Üye listesinden/mesajdaki adtan "Mesaj gönder". Web push + bildirim sayacı DM'leri de kapsasın.
- Boşta otomatik durum (5 dk hareketsiz), özel durum metni.
- Kabul: A→B istek, kabul, DM, grup DM; üçüncü kişi hiçbir DM'i göremiyor (SQL ile RLS testi yaz).

## Aşama 3 — Ses geliştirmeleri (ekran: Sesli oda)
- **Bas-konuş:** ayarlarda aç/kapat + tuş atama (varsayılan V); telefonda ekranda basılı tut düğmesi. Tuş dinleyicisi yalnızca ses odasındayken ve bir yazı alanında değilken.
- **Kişi başı ses:** her uzak katılımcı için 0–200% kaydırıcı (`audio.volume` ≤1 için, üstü için WebAudio `GainNode`); ayrıca ekran sesi için ayrı kaydırıcı. Düzey `localStorage`'da kişi başına saklanır.
- **Kamera:** `setCameraEnabled`, kamera ızgarası (konuşan kişi vurgulu halka), ekran paylaşımı geniş kutuda; kamera yokken avatar. Bant genişliğini sınırla (720p/30).
- **Sağırlaştır:** kendi çıkışını kapatır (tüm uzak sesler sessiz + mikrofon da kapanır); durum başkalarına görünür. **Sunucuda sustur:** yöneticiler için (LiveKit `mutePublishedTrack` ya da yeni token izni; `ses-token` edge function üzerinden).
- Sesli kanal içi metin sohbeti paneli.
- Mevcut ekran paylaşımı davranışı (APK 1.0.8 telefon sesi) bozulmasın.
- Kabul: iki cihazla bas-konuş, kişi başı ses, kamera aç/kapa, sağırlaştır çalışıyor.

## Aşama 4 — Sunucu yönetimi (ekran: Sunucu ayarları)
- **Kategoriler:** `kategoriler(oda_id, ad, sira)`, `kanallar.kategori_id`; daraltılabilir gruplar, sürükle-bırak sıralama.
- **Özel roller/izinler:** `roller(oda_id, ad, renk, izinler bigint, sira)`, `uye_rolleri`; izin bitleri: mesaj yaz, dosya, sesli konuş, ekran/kamera, mesajları yönet, sustur, yasakla, kanalları yönet, davet. Mevcut `sahip/moderator/uye` rollerini bu sisteme göç ettir (geriye dönük uyumlu). İzin kontrolü **hem RLS'te hem arayüzde**; kanal bazlı geçersiz kılma sonra.
- **Çoklu sunucu:** `katil` ilk odayı almayı bırakır; sol şeritte sunucu listesi, "Sunucu oluştur", sunucu simgesi/ad. Varsayılan sunucu (mevcut oda) kalır.
- **Davet bağlantıları:** `davetler(kod, oda_id, olusturan, bitis, kullanim_limiti, kullanim)`; `/davet/<kod>` sayfası; Google girişten sonra katılım. Önceki davet-kodu girişi kaldırıldı, bunu geri getirme: davet yalnızca sunucuya katılım içindir.
- **Denetim kaydı:** `denetim_kaydi(oda_id, eyleyen, eylem, hedef, ayrinti jsonb, zaman)`; veritabanı tetikleyicileriyle (mesaj silme, rol verme, susturma, yasaklama, kanal ekleme) otomatik yazılır; yalnızca yetkililer okur; süzgeç çipleri.
- Yavaş mod (kanal başına sn), yasaklı kelime, zaman aşımı (timeout), hoş geldin mesajı, webhook adresi (edge function, gizli anahtarlı).
- Kabul: yeni rol oluşturup izin kısıtla → o izin olmayan kullanıcı RLS düzeyinde de engelleniyor (iki hesapla test).

## Aşama 5 — Cila
- Ctrl+K komut paleti, klavye kısayolları, TR/EN dil dosyası altyapısı, LiveKit kullanım/maliyet göstergesi (yöneticiye), APK bildirimi (Firebase) — `DEVIR-NOTU.md` açık işler.

## Her aşama sonunda bana (Aras'a) kısaca yaz
Yapılanlar (3 madde), elle denenecekler, açık kalanlar. Uzun anlatma.
