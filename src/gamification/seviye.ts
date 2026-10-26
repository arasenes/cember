/**
 * Çember Seviye & XP Sistemi
 * Kullanıcıların mesaj yazdıkça, sesli odada kaldıkça veya oyun oynadıkça kazandığı XP ve unvanlar.
 */

export type SeviyeBilgisi = {
  seviye: number;
  xp: number;
  sonrakiSeviyeXp: number;
  mevcutSeviyeXp: number;
  yuzde: number;
  unvan: string;
  rozet: string;
};

export const UNVANLAR = [
  { minSeviye: 1, unvan: "Çırak", rozet: "🌱" },
  { minSeviye: 5, unvan: "Gezgin", rozet: "🧭" },
  { minSeviye: 10, unvan: "Kıdemli", rozet: "⚔️" },
  { minSeviye: 20, unvan: "Usta", rozet: "🛡️" },
  { minSeviye: 35, unvan: "Efsane", rozet: "👑" },
  { minSeviye: 50, unvan: "Çember Muhafızı", rozet: "🔮" },
];

/** Seviyeye göre gereken toplam XP'yi hesaplar (seviye * 100 * 1.5 katsayısı) */
export function seviyeIcinGerekenXp(seviye: number): number {
  if (seviye <= 1) return 0;
  return Math.floor(100 * Math.pow(seviye - 1, 1.5));
}

/** Toplam XP'den seviye ve ilerleme yüzdesini hesaplar */
export function xpToSeviye(toplamXp: number): SeviyeBilgisi {
  const xp = Math.max(0, toplamXp);
  let seviye = 1;
  while (seviyeIcinGerekenXp(seviye + 1) <= xp) {
    seviye++;
  }

  const mevcutSeviyeTabani = seviyeIcinGerekenXp(seviye);
  const sonrakiSeviyeTabani = seviyeIcinGerekenXp(seviye + 1);
  const aralik = sonrakiSeviyeTabani - mevcutSeviyeTabani;
  const seviyeIciXp = xp - mevcutSeviyeTabani;
  const yuzde = aralik > 0 ? Math.min(100, Math.floor((seviyeIciXp / aralik) * 100)) : 100;

  let aktifUnvan = UNVANLAR[0].unvan;
  let aktifRozet = UNVANLAR[0].rozet;
  for (const u of UNVANLAR) {
    if (seviye >= u.minSeviye) {
      aktifUnvan = u.unvan;
      aktifRozet = u.rozet;
    }
  }

  return {
    seviye,
    xp,
    sonrakiSeviyeXp: sonrakiSeviyeTabani,
    mevcutSeviyeXp: seviyeIciXp,
    yuzde,
    unvan: aktifUnvan,
    rozet: aktifRozet,
  };
}

const XP_ANAHTAR = "cember_xp_kayitlari_v1";

export type UyeXpKaydi = {
  uyeId: string;
  ad: string;
  xp: number;
  sonGuncelleme: number;
};

/** Yerel/senkronize XP deposu */
export function xpKayitlariniGetir(): Record<string, UyeXpKaydi> {
  try {
    const raw = localStorage.getItem(XP_ANAHTAR);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function xpKaydet(uyeId: string, ad: string, ekleMiktar: number): SeviyeBilgisi {
  const tumu = xpKayitlariniGetir();
  const eski = tumu[uyeId] ?? { uyeId, ad, xp: 0, sonGuncelleme: Date.now() };
  const yeniXp = eski.xp + ekleMiktar;
  tumu[uyeId] = {
    uyeId,
    ad: ad || eski.ad,
    xp: yeniXp,
    sonGuncelleme: Date.now(),
  };
  try {
    localStorage.setItem(XP_ANAHTAR, JSON.stringify(tumu));
  } catch { /* yoksay */ }
  return xpToSeviye(yeniXp);
}

export function uyeXpGetir(uyeId: string): SeviyeBilgisi {
  const tumu = xpKayitlariniGetir();
  return xpToSeviye(tumu[uyeId]?.xp ?? 0);
}

export function liderlikTablosuGetir(): { sira: number; uyeId: string; ad: string; bilgi: SeviyeBilgisi }[] {
  const tumu = xpKayitlariniGetir();
  return Object.values(tumu)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 20)
    .map((k, index) => ({
      sira: index + 1,
      uyeId: k.uyeId,
      ad: k.ad,
      bilgi: xpToSeviye(k.xp),
    }));
}
