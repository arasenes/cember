import type { Mesaj, Uye } from "../types";

export type DmKanal = { id: string; tur: "ikili" | "grup"; ad: string | null; olusturan: string | null; olusturma: string; son_mesaj: string; oda_id?: string | null };
export type DmUyesi = { dm_id: string; uye_id: string; son_okuma: string };
export type DmMesaj = { id: string; dm_id: string; uye_id: string; metin: string; olusturma: string; duzenleme: string | null; silindi: boolean };
export type Arkadaslik = { id: string; a: string; b: string; durum: "bekliyor" | "kabul" | "engelli"; olusturma: string };

/** Kişiyle ilişkimiz: arkadaş, gelen/giden istek, engelledim ya da hiçbiri. */
export type Iliski = "arkadas" | "gelen" | "giden" | "engelli" | "yok";

export function iliskiBul(arkadasliklar: Arkadaslik[], benId: string, hedefId: string): Iliski {
  for (const r of arkadasliklar) {
    if (r.durum === "engelli" && r.a === benId && r.b === hedefId) return "engelli";
    if (r.durum === "kabul" && ((r.a === benId && r.b === hedefId) || (r.a === hedefId && r.b === benId))) return "arkadas";
    if (r.durum === "bekliyor" && r.a === benId && r.b === hedefId) return "giden";
    if (r.durum === "bekliyor" && r.a === hedefId && r.b === benId) return "gelen";
  }
  return "yok";
}

/** DM listesinde görünen ad: ikilide karşı kişi, grupta grup adı ya da üye adları. */
export function dmBasligi(k: DmKanal, uyeleri: DmUyesi[], uyeHaritasi: Map<string, Uye>, benId: string): string {
  if (k.tur === "grup" && k.ad) return k.ad;
  const digerleri = uyeleri.filter((u) => u.dm_id === k.id && u.uye_id !== benId).map((u) => uyeHaritasi.get(u.uye_id)?.takma_ad ?? "Silinmiş üye");
  if (k.tur === "ikili") return digerleri[0] ?? "Silinmiş üye";
  return digerleri.length ? digerleri.slice(0, 3).join(", ") + (digerleri.length > 3 ? ` +${digerleri.length - 3}` : "") : "Grup";
}

/** İkili DM'de karşı üyenin kimliği. */
export function karsiUye(k: DmKanal, uyeleri: DmUyesi[], benId: string): string | null {
  if (k.tur !== "ikili") return null;
  return uyeleri.find((u) => u.dm_id === k.id && u.uye_id !== benId)?.uye_id ?? null;
}

/** DM mesajını MessageView'in beklediği biçime çevirir (kanal_id yerine dm_id). */
export function mesajaCevir(m: DmMesaj): Mesaj {
  return {
    id: m.id, kanal_id: m.dm_id, uye_id: m.uye_id, metin: m.metin, olusturma: m.olusturma, duzenleme: m.duzenleme, silindi: m.silindi,
    ek_yol: null, ek_tur: null, ek_boyut: null, ek_genislik: null, ek_yukseklik: null, sabit: false, sabit_zaman: null, ust_mesaj_id: null,
  };
}
