# Çember teması

Koyu **kömür** tema (nötr gri zeminler), **turuncu** (`#ff9f1c`) vurgu, turkuaz (`#5ee0c1`) ikincil (bahsetme, çevrimiçi). Değerlerin tamamı `tema.css` içinde CSS değişkeni olarak var; **renk/ölçü uydurma, oradan kullan.**

- Kurulum: `tema.css` → `src/tema.css`, `main.tsx` içinde `import "./tema.css"`. Mevcut `src/styles.css` renklerini bu değişkenlere bağla (ör. eski zemin → `var(--zemin-ana)`); uygulamayı baştan yazma, değişkenleri değiştirerek taşı.
- Yazı: başlıklar **Bricolage Grotesque** 600–700, metin **Figtree** 400–700. Gövde 15 px, küçük yazı 12–13 px.
- Düzen (masaüstü 1440 px): sunucu şeridi 72 · kanal listesi 264 · sohbet esnek · üye listesi 248. Üst çubuk 56 px. Telefonda alt sekme çubuğu (Sunucu, Mesajlar, Arkadaşlar, Bildirim, Ben) ve sol üstte menü düğmesi.
- Dokunma hedefi en az 44 px. İkonlar 2 px çizgili SVG (`.cb-ikon`), emoji ikon yerine kullanma. İkon düğmelerine `aria-label`.
- Kontrast: açık yazı yalnızca koyu zemin üstünde; vurgu (`--vurgu`) zemininin üstüne `--vurgu-yazi` koy. Durumu yalnızca renkle anlatma (nokta + metin/ikon).
- Roller/kişi renkleri: sahip `--altin`, moderatör `--mavi`, diğerleri `--yazi`; avatar zeminleri `--vurgu`, `--bahsetme`, `--mavi`, `--uyari`, `--mor`.
- Bahsetme: `--bahsetme-zemin` üstünde `--bahsetme` (turkuaz) yazı. Çevrimiçi nokta turkuaz, boşta altın, meşgul `--uyari`. Okunmamış çizgisi `--uyari`. Konuşan kişi: avatar etrafında `--vurgu` halka.

## Ekranlar (`tasarim/` klasöründe, tarayıcıda açılır)
`Main.dc.html` sohbet · `DM.dc.html` özel mesaj/arkadaş · `Ses.dc.html` sesli oda · `Yonetim.dc.html` sunucu ayarları · `Telefon.dc.html` telefon. Yerleşimi ve ölçüleri doğrudan bu dosyalardaki inline stillerden oku; React bileşenine çevirirken sabit px değerleri yerine yukarıdaki değişkenleri ve esnek (flex/grid) yerleşimi kullan.
