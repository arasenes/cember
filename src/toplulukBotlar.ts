import type { Uye } from "./types";

/**
 * Çember topluluk üyeleri (Botlar)
 * Gerçek kullanıcı gibi görünmeleri için gerçekçi isimler, yüksek çözünürlüklü fotoğraflar ve durumlar tanımlanmıştır.
 */
export const TOPLULUK_BOTLARI: Uye[] = [
  {
    id: "cember-kullanici-aras",
    oda_id: "",
    user_id: null,
    takma_ad: "Aras",
    rol: "moderator",
    avatar_yol: "/avatarlar/aras.jpg",
    renk: "#10b981",
    hakkinda: "Çember kurucu ekibi · Yayında",
    durum: "cevrimici",
    durum_metin: "🎙️ Sesli Sohbette",
    son_gorulme: "2026-10-29T10:00:00.000Z",
    bot: false,
  },
  {
    id: "cember-kullanici-selin",
    oda_id: "",
    user_id: null,
    takma_ad: "Selin",
    rol: "uye",
    avatar_yol: "/avatarlar/selin.jpg",
    renk: "#818cf8",
    hakkinda: "Yayın açık · Valorant rekabetçi",
    durum: "cevrimici",
    durum_metin: "🎮 Canlı Yayında",
    son_gorulme: "2026-10-29T10:00:00.000Z",
    bot: false,
  },
  {
    id: "cember-kullanici-kaan",
    oda_id: "",
    user_id: null,
    takma_ad: "Kaan",
    rol: "uye",
    avatar_yol: "/avatarlar/kaan.jpg",
    renk: "#38bdf8",
    hakkinda: "Yazılım geliştirici · Lofi beats",
    durum: "cevrimici",
    durum_metin: "🎧 Müzik Dinliyor",
    son_gorulme: "2026-10-29T10:00:00.000Z",
    bot: false,
  },
];

/** Veritabanından gelen bot veya silinmiş kayıtları gerçekçi kullanıcı görünümüne dönüştürür */
export function botKullaniciyaDonustur(u: Uye): Uye {
  if (u.silindi) return u;
  const ad = u.takma_ad?.toLowerCase() || "";
  if (ad.includes("bot") || ad.includes("cemberai") || u.bot) {
    return {
      ...u,
      takma_ad: "Kaan",
      avatar_yol: u.avatar_yol || "/avatarlar/kaan.jpg",
      renk: u.renk || "#38bdf8",
      durum: u.durum || "cevrimici",
      durum_metin: u.durum_metin || "🎧 Müzik Dinliyor",
      hakkinda: u.hakkinda || "Yazılım geliştirici · Çember aktif üye",
      bot: false,
    };
  }
  return u;
}

/** Sunucuya Aras, Selin ve Kaan'ı gerçek kullanıcılar gibi dahil eder */
export function toplulukUyeleriniHarmanla(odaId: string, mevcutUyeler: Uye[]): Uye[] {
  const donusturulen = mevcutUyeler.map(botKullaniciyaDonustur);
  const isimler = new Set(donusturulen.map((u) => u.takma_ad.toLowerCase()));

  const eklenecekler = TOPLULUK_BOTLARI
    .filter((b) => !isimler.has(b.takma_ad.toLowerCase()))
    .map((b) => ({ ...b, oda_id: odaId }));

  return [...donusturulen, ...eklenecekler];
}
