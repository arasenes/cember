export type ProfilAyar = {
  bannerRenk?: string;
  cerceve?: string; // "altin" | "neon" | "ates" | "mor" | "yok"
  unvanRozet?: string;
};

const PROFIL_EK_ANAHTAR = "cember_profil_ozellestirme_v1";

export const CERCEVELER = [
  { kod: "yok", ad: "Varsayılan", stil: "none" },
  { kod: "altin", ad: "Altın Taç", stil: "0 0 0 3px #f59e0b, 0 0 10px #f59e0b" },
  { kod: "neon", ad: "Siber Neon", stil: "0 0 0 3px #06b6d4, 0 0 12px #06b6d4" },
  { kod: "ates", ad: "Alev Kırmızı", stil: "0 0 0 3px #ef4444, 0 0 12px #ef4444" },
  { kod: "mor", ad: "Mistik Mor", stil: "0 0 0 3px #a855f7, 0 0 12px #a855f7" },
];

export const BANNER_RENKLERI = [
  "linear-gradient(135deg, #4f46e5, #06b6d4)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #10b981, #3b82f6)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #1e293b, #0f172a)",
];

export const DURUM_SABLONLARI = [
  { metin: "🎮 Oyundayım", kisa: "Oyun" },
  { metin: "🎧 Müzik dinliyorum", kisa: "Müzik" },
  { metin: "📚 Ders çalışıyorum", kisa: "Ders" },
  { metin: "💻 Kod yazıyorum", kisa: "Kod" },
  { metin: "☕ Mola / Kahve", kisa: "Kahve" },
  { metin: "💤 AFK / Yemekte", kisa: "AFK" },
];

export type BasarimRozeti = {
  id: string;
  simge: string;
  baslik: string;
  aciklama: string;
};

export const BASARIM_ROZETLERI: BasarimRozeti[] = [
  { id: "oncu", simge: "🌟", baslik: "Çember Öncüsü", aciklama: "Topluluğun ilk üyelerinden biri" },
  { id: "seviye-5", simge: "⚡", baslik: "Yükselen Yıldız", aciklama: "Seviye 5 veya üzerine ulaştı" },
  { id: "ses-ustasi", simge: "🎙️", baslik: "Ses Şövalyesi", aciklama: "Sesli odalarda aktif sohbetçi" },
  { id: "gamer", simge: "🎮", baslik: "Oyun Şampiyonu", aciklama: "Mini oyunlarda düellolara katıldı" },
  { id: "muziksever", simge: "🎵", baslik: "Müzik Tutkunu", aciklama: "Oda radyosunu ve müzik çalarını kullandı" },
];

export function profilAyarGetir(uyeId: string): ProfilAyar {
  try {
    const raw = localStorage.getItem(`${PROFIL_EK_ANAHTAR}_${uyeId}`);
    return raw ? JSON.parse(raw) : { bannerRenk: BANNER_RENKLERI[0], cerceve: "yok" };
  } catch {
    return { bannerRenk: BANNER_RENKLERI[0], cerceve: "yok" };
  }
}

export function profilAyarKaydet(uyeId: string, ayar: ProfilAyar): void {
  try {
    localStorage.setItem(`${PROFIL_EK_ANAHTAR}_${uyeId}`, JSON.stringify(ayar));
  } catch { /* yoksay */ }
}
