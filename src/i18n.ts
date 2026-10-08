// Çok dilli arayüz altyapısı. Kaynak dil Türkçedir: kodda metin Türkçe yazılır, t("Türkçe metin") çağrısı seçili dile çevirir.
// Çeviri tablosu src/i18n.sozluk.ts (satır = [tr, en, de, ar, ru, az, fr, es]). Tabloda olmayan metin Türkçe kalır.
// Değişken içeren metinler için tabloda {ad} yer tutucuları kullanılır; hazır birleştirilmiş Türkçe metin de (ör. "\"genel\" kategorisi açıldı.")
// desenle eşleşip çevrilir, böylece hata ve bildirim metinleri her yerde çevrilmek için tek tek değiştirilmek zorunda kalmaz.
import { SATIRLAR } from "./i18n.sozluk";

export type Dil = "tr" | "en" | "de" | "ar" | "ru" | "az" | "fr" | "es";
export type DilBilgi = { id: Dil; ad: string; bcp: string; rtl: boolean };

/** Sıra, sözlük sütunlarının sırasıdır (tr = 0). Ad, dilin kendi yazısıyla gösterilir. */
export const DILLER: DilBilgi[] = [
  { id: "tr", ad: "Türkçe", bcp: "tr-TR", rtl: false },
  { id: "en", ad: "English", bcp: "en-US", rtl: false },
  { id: "de", ad: "Deutsch", bcp: "de-DE", rtl: false },
  { id: "ar", ad: "العربية", bcp: "ar", rtl: true },
  { id: "ru", ad: "Русский", bcp: "ru-RU", rtl: false },
  { id: "az", ad: "Azərbaycanca", bcp: "az-AZ", rtl: false },
  { id: "fr", ad: "Français", bcp: "fr-FR", rtl: false },
  { id: "es", ad: "Español", bcp: "es-ES", rtl: false },
];
const ANAHTAR = "cember-dil";
const gecerli = (v: unknown): v is Dil => typeof v === "string" && DILLER.some((d) => d.id === v);

/** Seçili dil: kayıtlı tercih, yoksa cihaz dili (desteklenmiyorsa İngilizce). Testlerde Türkçe. */
export function dilOku(): Dil {
  try {
    const d = localStorage.getItem(ANAHTAR);
    if (gecerli(d)) return d;
  } catch { /* özel pencere vb. */ }
  if (import.meta.env.MODE === "test") return "tr";
  return cihazDili();
}

export function cihazDili(): Dil {
  try {
    const liste = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of liste) {
      const ana = String(l ?? "").toLowerCase().split("-")[0];
      if (gecerli(ana)) return ana;
    }
  } catch { /* yoksay */ }
  return "en";
}

export const dilBilgi = (d: Dil = dilOku()): DilBilgi => DILLER.find((x) => x.id === d) ?? DILLER[0];
/** Tarih/saat biçimleri için BCP 47 dil kodu (ör. "tr-TR"). */
export const dilKodu = (): string => dilBilgi().bcp;

/** Sayfanın dil ve yazı yönünü ayarlar (Arapça sağdan sola). Açılışta ve dil değişince çağrılır. */
export function dilUygula(d: Dil = dilOku()): void {
  const kok = document.documentElement;
  kok.lang = d;
  kok.dir = dilBilgi(d).rtl ? "rtl" : "ltr";
}

export function dilYaz(d: Dil) {
  try { localStorage.setItem(ANAHTAR, d); } catch { /* yok say */ }
  dilUygula(d);
}

// ---------- çeviri ----------
type Tablo = { tam: Map<string, string>; desen: { re: RegExp; sablon: string }[] };
const onbellek = new Map<Dil, Tablo>();

function tabloKur(d: Dil): Tablo {
  const kolon = DILLER.findIndex((x) => x.id === d);
  const tam = new Map<string, string>();
  const desen: Tablo["desen"] = [];
  for (const satir of SATIRLAR) {
    const hedef = satir[kolon];
    if (!hedef) continue;
    tam.set(satir[0], hedef);  // anahtar yer tutucu içerse de birebir eşleşme önce denenir
    if (/\{\w+\}/.test(satir[0])) {
      const kacis = satir[0].replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{\w+\}/g, "(.+?)");
      // Yer tutucu adları sırayla yakalanır: hedef şablondaki {ad} ilgili yakalamaya bağlanır
      const adlar = [...satir[0].matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      desen.push({ re: new RegExp("^" + kacis + "$", "s"), sablon: hedef + "\u0000" + adlar.join(",") });
    } else {
      tam.set(satir[0], hedef);
    }
  }
  const t: Tablo = { tam, desen };
  onbellek.set(d, t);
  return t;
}

function doldur(sablon: string, p?: Record<string, string | number>): string {
  return p ? sablon.replace(/\{(\w+)\}/g, (_, k: string) => (k in p ? String(p[k]) : `{${k}}`)) : sablon;
}

/** Türkçe metni seçili dile çevirir. p: {ad} yer tutucularının değerleri. Çeviri yoksa Türkçe metin döner. */
export function t(tr: string, p?: Record<string, string | number>, dil: Dil = dilOku()): string {
  if (dil === "tr") return doldur(tr, p);
  const tablo = onbellek.get(dil) ?? tabloKur(dil);
  const tam = tablo.tam.get(tr);
  if (tam !== undefined) return doldur(tam, p);
  for (const { re, sablon } of tablo.desen) {
    const m = re.exec(tr);
    if (!m) continue;
    const [hedef, adlar] = sablon.split("\u0000");
    const degerler: Record<string, string> = {};
    adlar.split(",").forEach((ad, i) => { degerler[ad] = m[i + 1]; });
    // Yakalanan parçalar (kanal adı, kişi adı…) kendi başına tabloda varsa onlar da çevrilir
    return hedef.replace(/\{(\w+)\}/g, (_, k: string) => degerler[k] ?? `{${k}}`);
  }
  return doldur(tr, p);
}

/** Onay penceresi: metin seçili dile çevrilir. */
export const onayla = (metin: string): boolean => window.confirm(t(metin));

// ---------- eski anahtarlı metinler (komut paleti, sekmeler) ----------
const TR = {
  "palet.yer": "Kanal, sunucu veya komut ara…",
  "palet.bos": "Eşleşen sonuç yok",
  "palet.baslik": "Komut paleti",
  "palet.kanal": "Kanal",
  "palet.ses": "Sesli oda",
  "palet.sunucu": "Sunucu",
  "palet.komut": "Komut",
  "palet.ipucu": "↑↓ seç · Enter aç · Esc kapat",
  "komut.arama": "Mesajlarda ara",
  "komut.ayarlar": "Uygulama ayarları",
  "komut.sunucuAyar": "Sunucu ayarları",
  "komut.dm": "Özel mesajlar",
  "komut.arkadaslar": "Arkadaşlar",
  "komut.sunucuKur": "Davetle sunucuya katıl",
  "komut.profil": "Profilim",
  "sekme.sunucu": "Sunucu",
  "sekme.mesajlar": "Mesajlar",
  "sekme.arkadaslar": "Arkadaşlar",
  "sekme.uyeler": "Üyeler",
  "sekme.ben": "Ben",
  "ayar.dil": "Dil",
} as const;
export type Anahtar = keyof typeof TR;
export const cevir = (k: Anahtar, dil: Dil = dilOku()): string => t(TR[k], undefined, dil);
/** Çeviri tablosuna girmesi gereken eski anahtarlı metinler (tablo üretimi için). */
export const ANAHTARLI_METINLER: string[] = Object.values(TR);

// ---------- hesap bazlı kayıt (cihazlar arası aynı dil) ----------
import { supabase } from "./supabase";

export async function dilBuluttanOku(kullaniciId: string): Promise<Dil | null> {
  try {
    const { data } = await supabase.from("kullanici_ayarlari").select("dil").eq("user_id", kullaniciId).maybeSingle();
    return gecerli(data?.dil) ? data.dil : null;
  } catch { return null; }
}
export async function dilBulutaYaz(kullaniciId: string, d: Dil): Promise<void> {
  try { await supabase.from("kullanici_ayarlari").upsert({ user_id: kullaniciId, dil: d }, { onConflict: "user_id" }); } catch { /* ağ yoksa yerel tercih yeter */ }
}
