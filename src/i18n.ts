// Hafif çeviri altyapısı: Türkçe kaynak dildir, eksik anahtar Türkçeye düşer.
// Yeni arayüz metinleri buraya eklenir; mevcut ekranlar aşamalı çevrilir.
export type Dil = "tr" | "en";
const ANAHTAR = "cember-dil";

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

const EN: Partial<Record<Anahtar, string>> = {
  "palet.yer": "Search channels, servers or commands…",
  "palet.bos": "No matching results",
  "palet.baslik": "Command palette",
  "palet.kanal": "Channel",
  "palet.ses": "Voice room",
  "palet.sunucu": "Server",
  "palet.komut": "Command",
  "palet.ipucu": "↑↓ select · Enter open · Esc close",
  "komut.arama": "Search messages",
  "komut.ayarlar": "App settings",
  "komut.sunucuAyar": "Server settings",
  "komut.dm": "Direct messages",
  "komut.arkadaslar": "Friends",
  "komut.sunucuKur": "Join a server with an invite",
  "komut.profil": "My profile",
  "sekme.sunucu": "Server",
  "sekme.mesajlar": "Messages",
  "sekme.arkadaslar": "Friends",
  "sekme.uyeler": "Members",
  "sekme.ben": "Me",
  "ayar.dil": "Language",
};

export function dilOku(): Dil {
  try {
    const d = localStorage.getItem(ANAHTAR);
    if (d === "en" || d === "tr") return d;
    return "tr";
  } catch { return "tr"; }
}
export function dilYaz(d: Dil) { try { localStorage.setItem(ANAHTAR, d); } catch { /* yok say */ } }

import { EN_METIN } from "./i18n.en";

/** Türkçe metni anahtar olarak kullanır; İngilizce seçiliyse sözlükten çevirir, yoksa olduğu gibi bırakır. */
export function t(tr: string): string {
  return dilOku() === "en" ? EN_METIN[tr] ?? tr : tr;
}

export function cevir(k: Anahtar, dil: Dil = dilOku()): string {
  return (dil === "en" ? EN[k] : undefined) ?? TR[k];
}
