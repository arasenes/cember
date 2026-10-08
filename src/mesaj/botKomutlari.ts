// Çember Bot komutları (sunucuda çalışır: 036_cember_bot.sql). Burada yalnızca yazı alanındaki öneri listesi için tanımlıdır.
export type BotKomutu = { ad: string; ornek: string; aciklama: string };

export const BOT_KOMUTLARI: BotKomutu[] = [
  { ad: "/yardim", ornek: "/yardim", aciklama: "Komut listesi" },
  { ad: "/zar", ornek: "/zar 20", aciklama: "Zar at (varsayılan 6 yüzlü)" },
  { ad: "/yazitura", ornek: "/yazitura", aciklama: "Yazı tura at" },
  { ad: "/sec", ornek: "/sec pizza, hamburger", aciklama: "Seçeneklerden birini seç" },
  { ad: "/8top", ornek: "/8top bu akşam oyun var mı?", aciklama: "Sihirli 8 top" },
  { ad: "/saat", ornek: "/saat", aciklama: "Şu an saat kaç" },
  { ad: "/kim", ornek: "/kim", aciklama: "Şansı yaver giden kişi" },
];

/** "/" ile başlayan, henüz boşluk içermeyen yazıya uyan komutlar (öneri listesi). */
export function komutOner(metin: string): BotKomutu[] {
  if (!metin.startsWith("/") || /\s/.test(metin)) return [];
  const q = metin.toLowerCase();
  return BOT_KOMUTLARI.filter((k) => k.ad.startsWith(q));
}
